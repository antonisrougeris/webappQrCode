import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createReview,
  listReviews,
  myReviewedProducts,
} from "../controllers/review.controller.js";

const router = Router();

router.get("/mine", requireAuth, myReviewedProducts);
router.get("/:productId", listReviews);
router.post("/:productId", requireAuth, createReview);

export default router;