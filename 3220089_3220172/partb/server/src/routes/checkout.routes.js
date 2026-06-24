import { Router } from "express";
import { optionalAuth } from "../middleware/auth.js";
import { checkout } from "../controllers/checkout.controller.js";

const router = Router();

// allow guest OR logged-in checkout
router.post("/", optionalAuth, checkout);

export default router;
