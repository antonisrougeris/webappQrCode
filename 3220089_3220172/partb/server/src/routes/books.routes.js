/* 3220089_3220172  2025 */

import { Router } from "express";
import { listBooks, getBookById } from "../controllers/books.controller.js";
import bookReviewsRoutes from "./bookReviews.routes.js";

const router = Router();

router.get("/", listBooks);
router.get("/:id", getBookById);
router.use("/:id/reviews", bookReviewsRoutes);

export default router;
