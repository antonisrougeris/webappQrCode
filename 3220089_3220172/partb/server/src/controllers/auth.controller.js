import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
  accountExistsByEmail,
} from "../services/auth.service.js";
import { mergeGuestCartIntoUserCart } from "../services/cart.service.js";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { nowIso } from "../utils/ids.js";



function getUserCartId(user) {
  return user?.uid || user?.id || user?.userId || null;
}

async function mergeGuestCartIfNeeded(req, user) {
  const userId = getUserCartId(user);

  if (!req.guestId || !userId) {
    return null;
  }

  return mergeGuestCartIntoUserCart({
    guestId: req.guestId,
    userId,
  });
}

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body || {});
  const cart = await mergeGuestCartIfNeeded(req, user);

  return ok(res, {
    message: "User synced successfully",
    user,
    cart,
  });
});

export const login = asyncHandler(async (req, res) => {
  const user = await loginUser(req.body || {});
  const cart = await mergeGuestCartIfNeeded(req, user);

  return ok(res, {
    message: "Login successful",
    user,
    cart,
  });
});

export const accountStatus = asyncHandler(async (req, res) => {
  const email = String(req.body?.email || "").trim();
  const exists = await accountExistsByEmail(email);

  if (req.guestId && !req.user?.uid) {
    const lead = {
      email,
      firstName: String(req.body?.firstName || "").trim().slice(0, 80),
      lastName: String(req.body?.lastName || "").trim().slice(0, 80),
      phone: String(req.body?.phone || "").trim().slice(0, 40),
      capturedAt: nowIso(),
    };

    await getDB()
      .collection(COLLECTIONS.CARTS)
      .doc(String(req.guestId))
      .set(
        {
          checkoutLead: lead,
          updatedAt: nowIso(),
        },
        { merge: true }
      );
  }

  return ok(res, { exists });
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user?.uid);
  return ok(res, { user });
});

