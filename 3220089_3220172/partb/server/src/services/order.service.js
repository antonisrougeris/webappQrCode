import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function calculateShipping(subtotal, delivery) {
  if (subtotal >= 50) return 0;
  if (delivery === "boxnow") return 2.0;
  return 3.5;
}

function buildOrderNumber() {
  return `SK-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)
    .toUpperCase()}`;
}

function variantKey(variant) {
  return [variant?.sku || "", variant?.size || "", variant?.color || ""].join(
    "|"
  );
}

function findVariant(product, selectedVariant) {
  const variants = Array.isArray(product.variants) ? product.variants : [];
  if (!variants.length) return { variant: null, index: -1 };

  const selectedKey = variantKey(selectedVariant);
  const index = variants.findIndex(
    (variant) => variantKey(variant) === selectedKey
  );
  if (index < 0)
    throw new ApiError(
      400,
      `Selected variant does not exist for ${product.title}`
    );
  return { variant: variants[index], index };
}

function assertAndDecrementStock(product, variant, variantIndex, quantity) {
  const qty = toNumber(quantity, 0);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    throw new ApiError(400, "Invalid item quantity");
  }

  if (variant) {
    const currentStock = toNumber(variant.stock, 0);
    if (currentStock < qty)
      throw new ApiError(400, `Not enough stock for ${product.title}`);

    const variants = [...(product.variants || [])];
    variants[variantIndex] = { ...variant, stock: currentStock - qty };
    return { variants };
  }

  const currentStock = toNumber(product.stock, 0);
  if (currentStock < qty)
    throw new ApiError(400, `Not enough stock for ${product.title}`);
  return { stock: currentStock - qty };
}

export async function checkoutCartForOwner({
  ownerId,
  ownerType,
  customer,
  shippingAddress,
  delivery,
  locker,
  notes,
}) {
  if (!ownerId) throw new ApiError(401, "Missing checkout owner");

  const db = getDB();
  const orderId = createId("order");
  const orderNumber = buildOrderNumber();
  const createdAt = nowIso();

  const result = await db.runTransaction(async (tx) => {
    const cartRef = db.collection(COLLECTIONS.CARTS).doc(ownerId);
    const cartSnap = await tx.get(cartRef);

    const cart = cartSnap.exists ? cartSnap.data() : { items: [] };
    const cartItems = Array.isArray(cart.items) ? cart.items : [];
    if (!cartItems.length) throw new ApiError(400, "Cart is empty");

    const productRefs = cartItems.map((item) =>
      db.collection(COLLECTIONS.PRODUCTS).doc(String(item.productId))
    );
    const productSnaps = await Promise.all(
      productRefs.map((ref) => tx.get(ref))
    );

    const orderItems = [];
    const stockUpdates = [];
    let subtotal = 0;

    for (let i = 0; i < cartItems.length; i += 1) {
      const item = cartItems[i];
      const productSnap = productSnaps[i];
      if (!productSnap.exists)
        throw new ApiError(400, "Product is unavailable");

      const product = { id: productSnap.id, ...productSnap.data() };
      if (product.active === false)
        throw new ApiError(400, `Product "${product.title}" is unavailable`);

      const quantity = toNumber(item.quantity, 0);
      const { variant, index } = findVariant(product, item.variant);
      const stockPatch = assertAndDecrementStock(
        product,
        variant,
        index,
        quantity
      );
      stockUpdates.push({
        ref: productRefs[i],
        patch: { ...stockPatch, updatedAt: createdAt },
      });

      // IMPORTANT: price always comes from product/variant server-side, never from cart/client.
      const unitPrice = toNumber(variant?.price ?? product.price, 0);
      const lineTotal = unitPrice * quantity;
      subtotal += lineTotal;

      orderItems.push({
        id: item.id || createId("orderitem"),
        productId: product.id,
        slug: product.slug || product.id,
        title: product.title,
        image: Array.isArray(product.images)
          ? product.images[0] || null
          : product.image || null,
        quantity,
        unitPrice,
        currency: product.currency || "EUR",
        lineTotal,
        variant: variant
          ? {
              sku: variant.sku || "",
              size: variant.size || "",
              color: variant.color || "",
            }
          : null,
        qrDestination: item.qrDestination || null,
        customQr: !!item.customQr,
      });
    }

    const shippingCost = calculateShipping(subtotal, delivery);
    const total = subtotal + shippingCost;

    const order = {
      id: orderId,
      orderNumber,
      ownerId,
      ownerType,
      customer: {
        firstName: customer.firstName,
        lastName: customer.lastName,
        email: customer.email,
        phone: customer.phone || "",
      },
      shippingAddress: {
        firstName: shippingAddress.firstName || customer.firstName,
        lastName: shippingAddress.lastName || customer.lastName,
        email: shippingAddress.email || customer.email,
        phone: shippingAddress.phone || customer.phone || "",
        country: shippingAddress.country || "Greece",
        city: shippingAddress.city,
        postalCode: shippingAddress.postalCode || "",
        addressLine1: shippingAddress.addressLine1,
        addressLine2: shippingAddress.addressLine2 || "",
      },
      delivery: delivery || "home",
      locker: locker || null,
      notes: notes || "",
      items: orderItems,
      subtotal,
      shippingCost,
      total,
      currency: "EUR",
      status: "pending",
      paymentStatus: "pending",
      paymentProvider: "manual",
      qrCodesCreated: orderItems.filter((item) => item.customQr).length,
      createdAt,
      updatedAt: createdAt,
    };

    for (const update of stockUpdates) tx.update(update.ref, update.patch);
    tx.set(db.collection(COLLECTIONS.ORDERS).doc(orderId), order);

    return {
      orderId,
      orderNumber,
      qrCodesCreated: order.qrCodesCreated,
      order,
    };
  });

  return result;
}

export async function getOrdersForUser(userId) {
  if (!userId) throw new ApiError(401, "Missing user id");
  const db = getDB();
  const snapshot = await db
    .collection(COLLECTIONS.ORDERS)
    .where("ownerId", "==", userId)
    .where("ownerType", "==", "user")
    .get();

  const orders = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  orders.sort(
    (a, b) =>
      new Date(b.createdAt || 0).getTime() -
      new Date(a.createdAt || 0).getTime()
  );
  return orders;
}

export async function getOrderByIdForUser(userId, orderId) {
  if (!userId) throw new ApiError(401, "Missing user id");
  if (!orderId) throw new ApiError(400, "Missing order id");

  const db = getDB();
  const docSnap = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();
  if (!docSnap.exists) throw new ApiError(404, "Order not found");

  const order = { id: docSnap.id, ...docSnap.data() };
  if (order.ownerId !== userId || order.ownerType !== "user") {
    throw new ApiError(403, "You do not have access to this order");
  }
  return order;
}

export async function getOrderByVivaOrderCodeForUser(userId, vivaOrderCode) {
  if (!userId) throw new ApiError(401, "Missing user id");
  if (!vivaOrderCode) throw new ApiError(400, "Missing Viva order code");

  const db = getDB();

  const snapshot = await db
    .collection(COLLECTIONS.ORDERS)
    .where("ownerId", "==", userId)
    .where("ownerType", "==", "user")
    .where("payment.vivaOrderCode", "==", String(vivaOrderCode))
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new ApiError(404, "Order not found");
  }

  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}
