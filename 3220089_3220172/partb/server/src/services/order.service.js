import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";
import {
  getProductByIdOrSlug,
  resolveVariantOrThrow,
  assertStockForVariant,
} from "./product.service.js";
import { getCartByUserId, clearCart } from "./cart.service.js";

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
  return `SK-${Date.now()}`;
}

async function createQrCodesForOrder({
  db,
  ownerId,
  ownerType,
  orderId,
  items,
}) {
  const qrCodes = [];

  for (const item of items) {
    if (!item.customQr) continue;

    const qrId = createId("qr");

    const qrDoc = {
      id: qrId,
      userId: ownerType === "user" ? ownerId : null,
      guestId: ownerType === "guest" ? ownerId : null,
      orderId,
      productId: item.productId,
      productTitle: item.title,
      targetUrl: item.qrDestination || "",
      scans: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await db.collection(COLLECTIONS.QR_CODES).doc(qrId).set(qrDoc);
    qrCodes.push(qrDoc);
  }

  return qrCodes;
}

/* =========================================================
   CHECKOUT
========================================================= */

export async function checkoutCartForOwner({
  ownerId,
  ownerType,
  customer,
  shippingAddress,
  delivery,
  locker,
  notes,
}) {
  const db = getDB();

  if (!ownerId) {
    throw new ApiError(401, "Missing checkout owner");
  }

  const cart = await getCartByUserId(ownerId);

  if (!cart.items?.length) {
    throw new ApiError(400, "Cart is empty");
  }

  if (!customer?.firstName || !customer?.lastName || !customer?.email) {
    throw new ApiError(400, "Missing customer details");
  }

  if (!shippingAddress?.addressLine1 || !shippingAddress?.city) {
    throw new ApiError(400, "Missing shipping address");
  }

  const orderItems = [];
  let subtotal = 0;

  for (const item of cart.items) {
    const product = await getProductByIdOrSlug(item.productId);

    if (!product || product.active === false) {
      throw new ApiError(
        400,
        `Product "${item.title || item.productId}" is unavailable`
      );
    }

    const resolvedVariant = item.variant
      ? resolveVariantOrThrow(product, item.variant)
      : null;

    assertStockForVariant(product, resolvedVariant, item.quantity);

    const unitPrice = toNumber(item.price ?? product.price, 0);
    const lineTotal = unitPrice * toNumber(item.quantity, 0);

    subtotal += lineTotal;

    orderItems.push({
      id: item.id || createId("orderitem"),
      productId: item.productId,
      slug: item.slug || product.slug || product.id,
      title: item.title || product.title,
      image:
        item.image ||
        product.image ||
        (Array.isArray(product.images) ? product.images[0] || null : null),
      quantity: item.quantity,
      unitPrice,
      currency: item.currency || product.currency || "EUR",
      lineTotal,
      variant: item.variant || null,
      qrDestination: item.qrDestination || null,
      customQr: !!item.customQr,
    });
  }

  const shippingCost = calculateShipping(subtotal, delivery);
  const total = subtotal + shippingCost;

  const orderId = createId("order");
  const orderNumber = buildOrderNumber();

  const order = {
    id: orderId,
    orderNumber,
    ownerId,
    ownerType, // "user" | "guest"

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

    qrCodesCreated: orderItems.filter((item) => item.customQr).length,

    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.ORDERS).doc(orderId).set(order);

  const qrCodes = await createQrCodesForOrder({
    db,
    ownerId,
    ownerType,
    orderId,
    items: orderItems,
  });

  await clearCart(ownerId);

  return {
    orderId,
    orderNumber,
    qrCodesCreated: qrCodes.length,
    order,
  };
}

/* =========================================================
   ORDERS LIST FOR USER
========================================================= */

export async function getOrdersForUser(userId) {
  if (!userId) {
    throw new ApiError(401, "Missing user id");
  }

  const db = getDB();

  const snapshot = await db
    .collection(COLLECTIONS.ORDERS)
    .where("ownerId", "==", userId)
    .where("ownerType", "==", "user")
    .get();

  const orders = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  orders.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return orders;
}

/* =========================================================
   SINGLE ORDER FOR USER
========================================================= */

export async function getOrderByIdForUser(userId, orderId) {
  if (!userId) {
    throw new ApiError(401, "Missing user id");
  }

  if (!orderId) {
    throw new ApiError(400, "Missing order id");
  }

  const db = getDB();

  const docSnap = await db.collection(COLLECTIONS.ORDERS).doc(orderId).get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Order not found");
  }

  const order = {
    id: docSnap.id,
    ...docSnap.data(),
  };

  if (order.ownerId !== userId || order.ownerType !== "user") {
    throw new ApiError(403, "You do not have access to this order");
  }

  return order;
}
