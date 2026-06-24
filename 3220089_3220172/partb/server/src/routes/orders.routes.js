import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getOrder, listOrders } from "../controllers/orders.controller.js";

const router = Router();

router.use(requireAuth);

router.get("/", listOrders);
router.get("/:orderId", getOrder);

export default router;
