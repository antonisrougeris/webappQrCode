import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import { seedProducts } from "../controllers/admin.controller.js";

const router = Router();

router.use(requireAuth, requireAdmin);

router.post("/seed-products", seedProducts);

export default router;
