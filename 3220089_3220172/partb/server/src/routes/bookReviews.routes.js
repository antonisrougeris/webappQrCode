/* 3220089_3220172  2025 */

import { Router } from "express";
import { createBookReview, listBookReviews, getBookReviewStats } from "../controllers/reviews.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router({ mergeParams: true });

router.get("/", listBookReviews);
router.get("/stats", getBookReviewStats);
router.post("/", requireAuth, createBookReview);

export default router;
