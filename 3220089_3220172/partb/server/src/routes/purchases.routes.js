/* 3220089_3220172  2025 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { purchaseBook, listMyPurchases, deletePurchase } from "../controllers/purchases.controller.js";

const router = Router();

router.post("/", requireAuth, purchaseBook);
router.get("/my", requireAuth, listMyPurchases);
router.delete("/:id", requireAuth, deletePurchase);

export default router;
