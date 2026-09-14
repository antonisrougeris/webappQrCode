import { Router } from "express";

import {
  seedProducts,

  adminMe,
  getAdminDashboard,

  getAdminOrders,
  getAdminOrder,

  getAdminFulfillment,
  updateOrderFulfillment,
  updateOrderChecklist,
  updateOrderShipping,
  updateOrderReceipt,

  getAdminProducts,
  createAdminProduct,
  updateAdminProduct,
  updateAdminProductStock,
  archiveAdminProduct,

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


const router = Router();


router.use(
  requireAuth,
  requireAdmin
);


/* =========================
   ADMIN
   ========================= */

router.get(
  "/me",
  adminMe
);

router.get(
  "/dashboard",
  getAdminDashboard
);


/* =========================
   ORDERS
   ========================= */

router.get(
  "/orders",
  getAdminOrders
);

router.get(
  "/orders/:id",
  getAdminOrder
);


/* =========================
   FULFILLMENT
   ========================= */

router.get(
  "/fulfillment",
  getAdminFulfillment
);

router.patch(
  "/orders/:id/fulfillment",
  updateOrderFulfillment
);

router.patch(
  "/orders/:id/checklist",
  updateOrderChecklist
);

router.patch(
  "/orders/:id/shipping",
  updateOrderShipping
);

router.patch(
  "/orders/:id/receipt",
  updateOrderReceipt
);

router.post(
  "/orders/:id/receipt-file",

  receiptUpload.single(
    "file"
  ),

  uploadOrderReceiptPdf
);


router.post(
  "/orders/:id/ship",
  shipOrderAndNotify
);


/* =========================
   PRODUCTS
   ========================= */

router.get(
  "/products",
  getAdminProducts
);

router.post(
  "/products",
  createAdminProduct
);

router.patch(
  "/products/:id",
  updateAdminProduct
);

router.patch(
  "/products/:id/stock",
  updateAdminProductStock
);

router.post(
  "/products/:id/archive",
  archiveAdminProduct
);

/* =========================
   QR INVENTORY
   ========================= */

router.post(
  "/inventory/generate",
  generateAdminQrStock
);

/* =========================
   CUSTOMERS
   ========================= */

router.get(
  "/customers",
  getAdminCustomers
);


/* =========================
   QR CODES
   ========================= */

router.get(
  "/qr-codes",
  getAdminQrCodes
);


/* =========================
   PAYMENTS
   ========================= */

router.get(
  "/payments",
  getAdminPayments
);


/* =========================
   DEVELOPMENT / SEED
   ========================= */

router.post(
  "/seed-products",
  seedProducts
);


export default router;