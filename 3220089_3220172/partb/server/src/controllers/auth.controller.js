import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import {
  registerUser,
  loginUser,
  getCurrentUser,
} from "../services/auth.service.js";

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body || {});
  return ok(res, {
    message: "User synced successfully",
    user,
  });
});

export const login = asyncHandler(async (req, res) => {
  const user = await loginUser(req.body || {});
  return ok(res, {
    message: "Login successful",
    user,
  });
});

export const me = asyncHandler(async (req, res) => {
  const user = await getCurrentUser(req.user?.uid);
  return ok(res, { user });
});
