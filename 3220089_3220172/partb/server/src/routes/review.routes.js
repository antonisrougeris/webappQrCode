import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createReview,
  listReviews,
  listHomepageReviews,
  myReviewedProducts,
} from "../controllers/review.controller.js";

const router = Router();

router.get("/mine", requireAuth, myReviewedProducts);
router.get("/homepage", listHomepageReviews);
router.get("/:productId", listReviews);
router.post("/:productId", requireAuth, createReview);

export default router;