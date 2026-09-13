import { Router } from "express";

import {
  seedProducts,
  adminMe,
  getAdminDashboard,
  getAdminOrders,
  getAdminOrder,
  getAdminProducts,
  getAdminCustomers,
  getAdminQrCodes,
  getAdminPayments,
} from "../controllers/admin.controller.js";

import {
  requireAuth,
} from "../middleware/auth.js";

import {
  requireAdmin,
} from "../middleware/requireAdmin.js";


const router =
  Router();


/*
 * Everything below /api/admin
 * requires:
 *
 * 1. valid Firebase user
 * 2. role === admin
 */

router.use(
  requireAuth,
  requireAdmin
);


router.get(
  "/me",
  adminMe
);


router.get(
  "/dashboard",
  getAdminDashboard
);


router.get(
  "/orders",
  getAdminOrders
);


router.get(
  "/orders/:id",
  getAdminOrder
);


router.get(
  "/products",
  getAdminProducts
);


router.get(
  "/customers",
  getAdminCustomers
);


router.get(
  "/qr-codes",
  getAdminQrCodes
);


router.get(
  "/payments",
  getAdminPayments
);


/*
 * Existing product seed.
 *
 * Keep it protected by admin.
 */
router.post(
  "/seed-products",
  seedProducts
);


export default router;