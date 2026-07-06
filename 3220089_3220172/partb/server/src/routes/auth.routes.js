import express from "express";
import { register, login, me, checkEmail } from "../controllers/auth.controller.js";
import {
  sendEmailVerificationOtp,
  verifyEmailCode,
} from "../controllers/verification.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

router.post("/send-verification", requireAuth, sendEmailVerificationOtp);
router.post("/verify-email", requireAuth, verifyEmailCode);

router.post("/check-email", checkEmail);

export default router;