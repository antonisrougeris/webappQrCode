import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";
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

  return {
    userId,
    items: Array.isArray(doc.data().items) ? doc.data().items : [],
    updatedAt: doc.data().updatedAt || nowIso(),
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

  // ✅ QR validation
  if (product.customQr && !qrDestination) {
    throw new ApiError(400, "qrDestination is required for this product");
  }

  if (!product.customQr && qrDestination) {
    throw new ApiError(400, "This product does not support custom QR");
  }

  const cart = await getCartByUserId(userId);

  const existingIndex = cart.items.findIndex((item) => {
    const sameProduct = item.productId === product.id;
    const sameQr = (item.qrDestination || null) === (qrDestination || null);
    const sameSku = (item.variant?.sku || "") === (variant?.sku || "");
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
      image: Array.isArray(product.images)
        ? product.images[0] || null
        : null,
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
      qrDestination: qrDestination || null,
      customQr: !!product.customQr,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  cart.updatedAt = nowIso();

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(cart, {
    merge: true,
  });

  return cart;
}

/* =========================
   UPDATE ITEM ✅ FIXED
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
  if (idx < 0) throw new ApiError(404, "Cart item not found");

  const current = cart.items[idx];
  const product = await getProductByIdOrSlug(current.productId);

  const resolvedVariant = current.variant
    ? resolveVariantOrThrow(product, current.variant)
    : null;

  assertStockForVariant(product, resolvedVariant, quantity);

  // ✅ ✅ FIX: κρατάει το παλιό QR αν δεν σταλεί νέο
  let nextQrDestination = null;

  if (current.customQr) {
    nextQrDestination = qrDestination || current.qrDestination;

    if (!nextQrDestination) {
      throw new ApiError(
        400,
        "qrDestination is required for this product"
      );
    }
  }

  cart.items[idx] = {
    ...current,
    quantity,
    qrDestination: nextQrDestination,
    updatedAt: nowIso(),
  };

  cart.updatedAt = nowIso();

  await db.collection(COLLECTIONS.CARTS).doc(userId).set(cart, {
    merge: true,
  });

  return cart;
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

  await db.collection(COLLECTIONS.CARTS).doc(userId).set({
    userId,
    items: [],
    updatedAt: nowIso(),
  });
}
