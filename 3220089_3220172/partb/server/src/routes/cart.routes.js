/* 3220089_3220172  2025 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  listCart,
  addToCart,
  removeFromCart,
} from "../controllers/cart.controller.js";

const router = Router();

router.get("/", requireAuth, listCart);

//  POST { itemType: "book" | "course", itemId: "..." }
router.post("/", requireAuth, addToCart);

//  DELETE /api/cart/:itemId
router.delete("/:itemId", requireAuth, removeFromCart);

export default router;
