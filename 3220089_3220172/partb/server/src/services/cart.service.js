import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";
import { normalizeUrlOrThrow } from "../utils/validators.js";
import {
  getProductByIdOrSlug,
  resolveVariantOrThrow,
  assertStockForVariant,
} from "./product.service.js";

/* =========================
   GET CART
========================= */

export async function getCartByUserId(userId) {
  const db = getDB();
  const doc = await db.collection(COLLECTIONS.CARTS).doc(userId).get();

  if (!doc.exists) {
    return {
      userId,
      items: [],
      updatedAt: nowIso(),
    };
  }

  const data = doc.data() || {};

  return {
    userId,
    items: Array.isArray(data.items) ? data.items : [],
    updatedAt: data.updatedAt || nowIso(),
  };
}

/* =========================
   ADD ITEM
========================= */

export async function addCartItem({
  userId,
  productId,
  quantity,
  selectedVariant,
  qrDestination,
}) {
  const db = getDB();

  const product = await getProductByIdOrSlug(productId);

  if (product.active === false) {
    throw new ApiError(400, "Product is inactive");
  }

  const variant = resolveVariantOrThrow(product, selectedVariant);
  assertStockForVariant(product, variant, quantity);

  if (product.customQr && !qrDestination) {
    throw new ApiError(400, "qrDestination is required for this product");
  }

  if (!product.customQr && qrDestination) {
    throw new ApiError(400, "This product does not support custom QR");
  }

  if (qrDestination) {
    normalizeUrlOrThrow(qrDestination, "qrDestination");
  }

  const cart = await getCartByUserId(userId);

  const normalizedQrDestination = qrDestination || null;
  const normalizedSku = variant?.sku || "";

  const existingIndex = cart.items.findIndex((item) => {
    const sameProduct = item.productId === product.id;
    const sameQr = (item.qrDestination || null) === normalizedQrDestination;
    const sameSku = (item.variant?.sku || "") === normalizedSku;

    return sameProduct && sameQr && sameSku;
  });

  if (existingIndex >= 0) {
    const existing = cart.items[existingIndex];
    const nextQty = Number(existing.quantity || 0) + quantity;

    assertStockForVariant(product, variant, nextQty);

    cart.items[existingIndex] = {
      ...existing,
      quantity: nextQty,
      updatedAt: nowIso(),
    };
  } else {
    cart.items.push({
      id: createId("cartitem"),
      productId: product.id,
      slug: product.slug || product.id,
      title: product.title,
      image: Array.isArray(product.images) ? product.images[0] || null : null,

      // Δεν εμπιστευόμαστε ποτέ τιμές από client.
      // Αυτό είναι server snapshot για εμφάνιση cart.
      // Στο checkout πρέπει πάλι να ξαναϋπολογίζονται από product DB.
      price: Number(product.price || 0),
      currency: product.currency || "EUR",

      quantity,
      variant: variant
        ? {
            sku: variant.sku || "",
            size: variant.size || "",
            color: variant.color || "",
          }
        : null,
      qrDestination: normalizedQrDestination,
      customQr: !!product.customQr,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  const nextCart = {
    userId,
    items: cart.items,
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextCart, {
    merge: true,
  });

  return nextCart;
}

/* =========================
   UPDATE ITEM
========================= */

export async function updateCartItem({
  userId,
  itemId,
  quantity,
  qrDestination,
}) {
  const db = getDB();
  const cart = await getCartByUserId(userId);

  const idx = cart.items.findIndex((item) => item.id === itemId);

  if (idx < 0) {
    throw new ApiError(404, "Cart item not found");
  }

  const current = cart.items[idx];
  const product = await getProductByIdOrSlug(current.productId);

  if (product.active === false) {
    throw new ApiError(400, "Product is inactive");
  }

  const resolvedVariant = current.variant
    ? resolveVariantOrThrow(product, current.variant)
    : null;

  assertStockForVariant(product, resolvedVariant, quantity);

  let nextQrDestination = null;

  if (current.customQr) {
    nextQrDestination = qrDestination || current.qrDestination;

    if (!nextQrDestination) {
      throw new ApiError(400, "qrDestination is required for this product");
    }

    normalizeUrlOrThrow(nextQrDestination, "qrDestination");
  } else if (qrDestination) {
    throw new ApiError(400, "This product does not support custom QR");
  }

  cart.items[idx] = {
    ...current,

    // refresh από server product, όχι παλιό/πειραγμένο cart data
    title: product.title,
    slug: product.slug || product.id,
    image: Array.isArray(product.images) ? product.images[0] || null : null,
    price: Number(product.price || 0),
    currency: product.currency || "EUR",

    quantity,
    qrDestination: nextQrDestination,
    updatedAt: nowIso(),
  };

  const nextCart = {
    userId,
    items: cart.items,
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextCart, {
    merge: true,
  });

  return nextCart;
}

/* =========================
   DELETE ITEM
========================= */

export async function removeCartItem({ userId, itemId }) {
  const db = getDB();
  const cart = await getCartByUserId(userId);

  const nextItems = cart.items.filter((item) => item.id !== itemId);

  if (nextItems.length === cart.items.length) {
    throw new ApiError(404, "Cart item not found");
  }

  const nextCart = {
    userId,
    items: nextItems,
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextCart, {
    merge: true,
  });

  return nextCart;
}

/* =========================
   CLEAR CART
========================= */

export async function clearCart(userId) {
  const db = getDB();

  const nextCart = {
    userId,
    items: [],
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextCart, {
    merge: true,
  });

  return nextCart;
}


export async function mergeGuestCartIntoUserCart({ guestId, userId }) {
  if (!guestId || !userId || guestId === userId) {
    return getCartByUserId(userId);
  }

  const db = getDB();

  const guestCart = await getCartByUserId(guestId);
  const userCart = await getCartByUserId(userId);

if (guestCart.copiedFromUserCart && guestCart.sourceUserId === userId) {
  const now = nowIso();

  const nextUserCart = {
    userId,
    items: Array.isArray(guestCart.items)
      ? guestCart.items.map((item) => ({
          ...item,
          updatedAt: now,
        }))
      : [],
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextUserCart);
  await db.collection(COLLECTIONS.CARTS).doc(guestId).delete();

  return nextUserCart;
}
  const mergedItems = [...(userCart.items || [])];

  for (const guestItem of guestCart.items || []) {
    const sameIndex = mergedItems.findIndex((item) => {
      const sameProduct = item.productId === guestItem.productId;
      const sameQr = (item.qrDestination || null) === (guestItem.qrDestination || null);
      const sameSku = (item.variant?.sku || "") === (guestItem.variant?.sku || "");

      return sameProduct && sameQr && sameSku;
    });

    if (sameIndex >= 0) {
      mergedItems[sameIndex] = {
        ...mergedItems[sameIndex],
        quantity:
          Number(mergedItems[sameIndex].quantity || 0) +
          Number(guestItem.quantity || 0),
        updatedAt: nowIso(),
      };
    } else {
      mergedItems.push({
        ...guestItem,
        id: guestItem.id || createId("cartitem"),
        updatedAt: nowIso(),
      });
    }
  }

  const nextUserCart = {
    userId,
    items: mergedItems,
    updatedAt: nowIso(),
  };

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(nextUserCart, {
    merge: true,
  });

  await db.collection(COLLECTIONS.CARTS).doc(guestId).delete();

  return nextUserCart;
}

export async function copyUserCartToGuestCart({ userId, guestId }) {
  if (!userId) throw new ApiError(401, "Missing user id");
  if (!guestId) throw new ApiError(400, "Missing guest id");

  const db = getDB();

  const userCart = await getCartByUserId(userId);
  const now = nowIso();

  const guestCart = {
    userId: guestId,
    sourceUserId: userId,
    copiedFromUserCart: true,
    items: Array.isArray(userCart.items)
      ? userCart.items.map((item) => ({
          ...item,
          id: item.id || createId("cartitem"),
          updatedAt: now,
        }))
      : [],
    updatedAt: now,
  };

  await db.collection(COLLECTIONS.CARTS).doc(guestId).set(guestCart);

  return guestCart;
}