/* 3220089_3220172  2025 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { checkoutCart } from "../controllers/checkout.controller.js";

const router = Router();

router.post("/", requireAuth, checkoutCart);

export default router;
