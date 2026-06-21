/* 3220089_3220172  2025 */

import { Router } from "express";
import { createReview, listCourseReviews } from "../controllers/reviews.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { getReviewStats } from "../controllers/reviews.controller.js";

const router = Router({ mergeParams: true }); // merge για να δέχεται :id από parent

// GET /api/courses/:id/reviews
router.get("/", listCourseReviews);

// POST /api/courses/:id/reviews
router.post("/", requireAuth, createReview);

// for example /api/courses/ID/reviews/stats
router.get("/stats", getReviewStats);

export default router;
