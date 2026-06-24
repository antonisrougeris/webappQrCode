import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { checkoutCartForOwner } from "../services/order.service.js";
import { ApiError } from "../utils/apiError.js";

function getCheckoutOwner(req) {
  if (req.user?.uid) {
    return { type: "user", id: req.user.uid };
  }

  if (req.guestId) {
    return { type: "guest", id: req.guestId };
  }

  throw new ApiError(401, "Missing checkout identity");
}

export const checkout = asyncHandler(async (req, res) => {
  const owner = getCheckoutOwner(req);

  const result = await checkoutCartForOwner({
    ownerId: owner.id,
    ownerType: owner.type,
    customer: req.body?.customer || {},
    shippingAddress: req.body?.shippingAddress || {},
    delivery: req.body?.delivery || "home",
    locker: req.body?.locker || null,
    notes: req.body?.notes || "",
  });

  return ok(res, result, 201);
});
