import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { checkoutCartForOwner } from "../services/order.service.js";
import { ApiError } from "../utils/apiError.js";
import { checkoutSchema, parseOrThrow } from "../utils/validators.js";

function getCheckoutOwner(req) {
  if (req.user?.uid) return { type: "user", id: req.user.uid };
  if (req.guestId) return { type: "guest", id: req.guestId };
  throw new ApiError(401, "Missing checkout identity");
}

export const checkout = asyncHandler(async (req, res) => {
  const owner = getCheckoutOwner(req);
  const body = parseOrThrow(checkoutSchema, req.body, "Invalid checkout data");

  const result = await checkoutCartForOwner({
    ownerId: owner.id,
    ownerType: owner.type,
    customer: body.customer,
    shippingAddress: body.shippingAddress,
    delivery: body.delivery,
    locker: body.locker || null,
    notes: body.notes || "",
  });

  return ok(res, result, 201);
});
