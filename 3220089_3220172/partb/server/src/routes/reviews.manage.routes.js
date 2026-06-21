/* 3220089_3220172  2025 */

import { Router } from "express";
import { updateReview, deleteReview } from "../controllers/reviews.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.patch("/:id", requireAuth, updateReview);
router.delete("/:id", requireAuth, deleteReview);

export default router;
