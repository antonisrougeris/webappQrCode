import express from "express";
import {
  register,
  login,
  me,
  saveCheckoutLead,
  accountStatus,
} from "../controllers/auth.controller.js";
import {
  sendEmailVerificationOtp,
  verifyEmailCode,
} from "../controllers/verification.controller.js";
import {
  forgotPassword,
  resetPassword,
} from "../controllers/password-reset.controller.js"; // ✅ ΝΕΟ
import { requireAuth } from "../middleware/auth.js";

import { accountStatusLimiter } from "../middleware/rateLimits.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/checkout-lead", saveCheckoutLead);
router.post("/account-status", accountStatusLimiter, accountStatus);
router.get("/me", requireAuth, me);

router.post("/send-verification", requireAuth, sendEmailVerificationOtp);
router.post("/verify-email", requireAuth, verifyEmailCode);


// ✅ ΝΕΟ — χωρίς requireAuth, γιατί ο χρήστης δεν είναι συνδεδεμένος
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;