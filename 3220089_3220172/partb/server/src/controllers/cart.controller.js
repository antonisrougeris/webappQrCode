import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import {
  assertPositiveInteger,
  assertString,
  normalizeVariantInput,
  optionalUrl,
} from "../utils/validators.js";
import {
  addCartItem,
  getCartByUserId,
  removeCartItem,
  updateCartItem,
} from "../services/cart.service.js";

export const getCart = asyncHandler(async (req, res) => {
  const owner = getCartOwner(req);

const cart = await getCartByUserId(owner.id);

  return ok(res, { cart });
});

export const addToCart = asyncHandler(async (req, res) => {
  const productId = assertString(req.body?.productId, "productId");
  const quantity = assertPositiveInteger(req.body?.quantity, "quantity");
  const variant = normalizeVariantInput(req.body?.variant);
  const qrDestination = optionalUrl(req.body?.qrDestination, "qrDestination");

  const owner = getCartOwner(req);

  const cart = await addCartItem({
    userId: owner.id, // 🔥 reuse same field
    productId,
    quantity,
    selectedVariant: variant,
    qrDestination,
  });
  

  return ok(res, { cart }, 201);
});

export const patchCartItem = asyncHandler(async (req, res) => {
  const itemId = assertString(req.params.itemId, "itemId");
  const quantity = assertPositiveInteger(req.body?.quantity, "quantity");
  const qrDestination = optionalUrl(req.body?.qrDestination, "qrDestination");

  const owner = getCartOwner(req);

const cart = await updateCartItem({
  userId: owner.id,
  itemId,
  quantity,
  qrDestination,
});


  return ok(res, { cart });
});

export const deleteCartItem = asyncHandler(async (req, res) => {
  const itemId = assertString(req.params.itemId, "itemId");

  const owner = getCartOwner(req);

const cart = await removeCartItem({
  userId: owner.id,
  itemId,
});


  return ok(res, { cart });
});


function getCartOwner(req) {
  if (req.user?.uid) {
    return { type: "user", id: req.user.uid };
  }

  if (req.guestId) {
    return { type: "guest", id: req.guestId };
  }

  throw new Error("Missing cart identity");
}