import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { checkout } from "../controllers/checkout.controller.js";

const router = Router();

router.post("/", requireAuth, checkout);

export default router;
