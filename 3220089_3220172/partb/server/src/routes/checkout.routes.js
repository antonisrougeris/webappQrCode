import { Router } from "express";
import {
  requireAuth,
  requireVerifiedEmail,
} from "../middleware/auth.js";
import {
  checkout,
  validateRecoveryOffer,
} from "../controllers/checkout.controller.js";

const router = Router();

router.post(
  "/recovery-offer",
  validateRecoveryOffer
);

router.post(
  "/discount-code",
  validateRecoveryOffer
);

router.post(
  "/",
  requireAuth,
  requireVerifiedEmail,
  checkout
);

export default router;
