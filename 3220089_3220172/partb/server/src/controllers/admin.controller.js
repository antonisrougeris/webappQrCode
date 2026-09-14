
import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { getStorage } from "firebase-admin/storage";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { ApiError } from "../utils/apiError.js";

import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";

import {
  createId,
  nowIso,
} from "../utils/ids.js";

import {
  reserveUniqueQrShortId,
  writeQrShortIdReservation,
} from "../services/qr-id.service.js";

import {
  sendEmail,
} from "../services/email.service.js";

import {
  uploadQrToStorage,
} from "../utils/uploadQrToStorage.js";

import {
  generatePrintQrImage,
} from "../utils/generatePrintQrImage.js";

import {
  generatePrintSheet,
} from "../utils/generatePrintSheet.js";



const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  dirname(__filename);


/* =========================================================
   COLLECTION NAMES
   ========================================================= */

const ORDERS_COLLECTION =
  COLLECTIONS.ORDERS || "orders";

const PRODUCTS_COLLECTION =
  COLLECTIONS.PRODUCTS || "products";

const USERS_COLLECTION =
  COLLECTIONS.USERS || "users";

const QR_CODES_COLLECTION =
  COLLECTIONS.QR_CODES || "qrCodes";


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeProductId(product) {
  return String(product.id || product.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}


function snapshotToDocs(snapshot) {
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}


/*
 * Firestore dates in the application may currently exist
 * either as:
 *
 * - Firestore Timestamp
 * - ISO string
 * - Date
 *
 * This helper safely converts all of them to milliseconds.
 */
function toMillis(value) {
  if (!value) {
    return 0;
  }

  if (
    typeof value === "object" &&
    typeof value.toMillis === "function"
  ) {
    return value.toMillis();
  }

  if (
    typeof value === "object" &&
    typeof value.seconds === "number"
  ) {
    return value.seconds * 1000;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const parsed = Date.parse(String(value));

  return Number.isNaN(parsed)
    ? 0
    : parsed;
}


function sortNewestFirst(items) {
  return [...items].sort(
    (a, b) =>
      toMillis(b.createdAt) -
      toMillis(a.createdAt)
  );
}


/* =========================================================
   PAYMENT HELPERS
   ========================================================= */

function getPaymentStatus(order) {
  const rawStatus =
    order.paymentStatus ||
    order.payment?.status ||
    order.status ||
    "";

  const status =
    String(rawStatus)
      .trim()
      .toLowerCase();

  if (
    [
      "paid",
      "completed",
      "complete",
      "successful",
      "success",
      "captured",
    ].includes(status)
  ) {
    return "paid";
  }

  if (
    [
      "failed",
      "failure",
      "declined",
      "cancelled",
      "canceled",
      "error",
    ].includes(status)
  ) {
    return "failed";
  }

  /*
   * If your paid orders contain paidAt,
   * we also treat that as proof that payment
   * has already been completed by the backend.
   */
  if (order.paidAt) {
    return "paid";
  }

  return "pending";
}


function isPaidOrder(order) {
  return getPaymentStatus(order) === "paid";
}


/* =========================================================
   SAFE CUSTOMER DATA
   ========================================================= */

function mapCustomer(user) {
  return {
    id: user.id,

    firstName:
      user.firstName || "",

    lastName:
      user.lastName || "",

    email:
      user.email || "",

    emailVerified:
      Boolean(
        user.emailVerified
      ),

    role:
      user.role || "user",

    createdAt:
      user.createdAt || null,

    updatedAt:
      user.updatedAt || null,
  };
}


/* =========================================================
   PRODUCT SEED
   KEEPING YOUR EXISTING FUNCTIONALITY
   ========================================================= */

export const seedProducts = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const productsPath = join(
      __dirname,
      "../../products.json"
    );

    const raw = await readFile(
      productsPath,
      "utf-8"
    );

    const products = JSON.parse(raw);

    const batch = db.batch();

    let count = 0;

    for (const product of products) {
      const id =
        normalizeProductId(product);

      if (!id) continue;

      batch.set(
        db
          .collection(
            PRODUCTS_COLLECTION
          )
          .doc(id),
        {
          id,

          slug:
            product.slug || id,

          title:
            product.title || "",

          shortDescription:
            product.shortDescription || "",

          description:
            product.description || "",

          category:
            product.category || "General",

          price:
            Number(
              product.price || 0
            ),

          currency:
            product.currency || "EUR",

          active:
            product.active ?? true,

          featured:
            product.featured ?? false,

          customQr:
            product.customQr ?? false,

          images:
            Array.isArray(
              product.images
            )
              ? product.images
              : product.image
              ? [product.image]
              : [],

          stock:
            Number(
              product.stock || 0
            ),

          variants:
            Array.isArray(
              product.variants
            )
              ? product.variants
              : [],

          createdAt:
            product.createdAt ||
            nowIso(),

          updatedAt:
            nowIso(),
        },
        {
          merge: true,
        }
      );

      count += 1;
    }

    await batch.commit();

    return ok(res, {
      message:
        `Seeded ${count} products`,

      count,
    });
  }
);


/* =========================================================
   ADMIN - CURRENT USER
   GET /api/admin/me
   ========================================================= */

export const adminMe = asyncHandler(
  async (req, res) => {

    return res.status(200).json({
      user: {
        uid:
          req.user?.uid || null,

        email:
          req.user?.email ||
          req.admin?.email ||
          "",

        role:
          req.admin?.role ||
          "admin",
      },
    });
  }
);


/* =========================================================
   ADMIN DASHBOARD
   GET /api/admin/dashboard
   ========================================================= */

export const getAdminDashboard =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      const [
        ordersSnapshot,
        usersSnapshot,
        qrSnapshot,
      ] =
        await Promise.all([
          db
            .collection(
              ORDERS_COLLECTION
            )
            .get(),

          db
            .collection(
              USERS_COLLECTION
            )
            .get(),

          db
            .collection(
              QR_CODES_COLLECTION
            )
            .get(),
        ]);


      const orders =
        snapshotToDocs(
          ordersSnapshot
        );


      const paidOrders =
        orders.filter(
          isPaidOrder
        );


      const revenue =
        paidOrders.reduce(
          (total, order) => {
            return (
              total +
              Number(
                order.total || 0
              )
            );
          },
          0
        );


      const pendingOrders =
        orders.filter(
          (order) =>
            getPaymentStatus(order) ===
            "pending"
        ).length;


      const failedOrders =
        orders.filter(
          (order) =>
            getPaymentStatus(order) ===
            "failed"
        ).length;


      const recentOrders =
        sortNewestFirst(
          orders
        )
          .slice(0, 10)
          .map(
            normalizeOrderForAdmin
          );


      return res
        .status(200)
        .json({
          revenue,

          orders:
            ordersSnapshot.size,

          paidOrders:
            paidOrders.length,

          pendingOrders,

          failedOrders,

          customers:
            usersSnapshot.size,

          qrCodes:
            qrSnapshot.size,

          recentOrders,
        });
    }
  );


/* =========================================================
   NORMALIZE ORDER
   ========================================================= */

function normalizeOrderForAdmin(order) {
  return {
    ...order,

    paymentStatus:
      getPaymentStatus(order),

    customer:
      order.customer || {},

    items:
      Array.isArray(order.items)
        ? order.items
        : [],

    total:
      Number(
        order.total || 0
      ),

    delivery:
      order.delivery || "",

    createdAt:
      order.createdAt || null,

    paidAt:
      order.paidAt || null,
  };
}


/* =========================================================
   ADMIN ORDERS
   GET /api/admin/orders
   ========================================================= */

export const getAdminOrders =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      /*
       * We intentionally don't use Firestore orderBy here yet
       * because your current data may contain mixed timestamp
       * formats (Timestamp / ISO strings).
       *
       * We normalize and sort in Node instead.
       */
      const snapshot =
        await db
          .collection(
            ORDERS_COLLECTION
          )
          .limit(500)
          .get();


      const orders =
        sortNewestFirst(
          snapshotToDocs(snapshot)
        )
          .map(
            normalizeOrderForAdmin
          );


      return res
        .status(200)
        .json({
          orders,
          count:
            orders.length,
        });
    }
  );


/* =========================================================
   SINGLE ORDER
   GET /api/admin/orders/:id
   ========================================================= */

export const getAdminOrder =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const orderId =
        String(
          req.params.id || ""
        ).trim();


      if (!orderId) {
        throw new ApiError(
          400,
          "Order ID is required"
        );
      }


      const document =
        await db
          .collection(
            ORDERS_COLLECTION
          )
          .doc(orderId)
          .get();


      if (!document.exists) {
        throw new ApiError(
          404,
          "Order not found"
        );
      }


      const order =
        normalizeOrderForAdmin({
          id:
            document.id,

          ...document.data(),
        });


      return res
        .status(200)
        .json({
          order,
        });
    }
  );


/* =========================================================
   ADMIN PRODUCTS
   GET /api/admin/products
   ========================================================= */

export const getAdminProducts =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      const snapshot =
        await db
          .collection(
            PRODUCTS_COLLECTION
          )
          .get();


      const products =
        snapshotToDocs(snapshot)
          .map((product) => {

            const images =
              Array.isArray(
                product.images
              )
                ? product.images
                : [];


            return {
              ...product,

              price:
                Number(
                  product.price || 0
                ),

              stock:
                Number(
                  product.stock || 0
                ),

              images,

              /*
               * admin.ts currently expects product.image,
               * while your Firestore product schema uses
               * product.images[].
               */
              image:
                images[0] || "",

              active:
                product.active !==
                false,

              featured:
                Boolean(
                  product.featured
                ),
            };
          })
          .sort(
            (a, b) =>
              String(
                a.title || ""
              ).localeCompare(
                String(
                  b.title || ""
                )
              )
          );


      return res
        .status(200)
        .json({
          products,

          count:
            products.length,
        });
    }
  );


/* =========================================================
   ADMIN CUSTOMERS
   GET /api/admin/customers
   ========================================================= */

export const getAdminCustomers =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      const snapshot =
        await db
          .collection(
            USERS_COLLECTION
          )
          .limit(500)
          .get();


      const customers =
        snapshotToDocs(snapshot)
          .map(
            mapCustomer
          )
          .sort(
            (a, b) =>
              toMillis(
                b.createdAt
              ) -
              toMillis(
                a.createdAt
              )
          );


      return res
        .status(200)
        .json({
          customers,

          count:
            customers.length,
        });
    }
  );


/* =========================================================
   ADMIN QR CODES
   GET /api/admin/qr-codes
   ========================================================= */

export const getAdminQrCodes =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      const snapshot =
        await db
          .collection(
            QR_CODES_COLLECTION
          )
          .limit(500)
          .get();


      const qrCodes =
        sortNewestFirst(
          snapshotToDocs(snapshot)
        )
          .map((qr) => ({

  id:
    qr.id,

  shortId:
    qr.shortId || "",

  status:
    qr.status || "",

  userId:
    qr.userId || null,

  guestId:
    qr.guestId || null,

  orderId:
    qr.orderId || "",

  productId:
    qr.productId || "",

  productTitle:
    qr.productTitle || "",

  sku:
    qr.sku || "",

  inventoryKey:
    qr.inventoryKey || "",

  variant:
    qr.variant || null,

  fulfillmentMode:
    qr.fulfillmentMode || "",

  targetUrl:
    qr.targetUrl || "",

  scans:
    Number(
      qr.scans || 0
    ),

  printStatus:
    qr.printStatus || "",

  printFileUrl:
    qr.printFileUrl || "",

  assignedAt:
    qr.assignedAt || null,

  createdAt:
    qr.createdAt || null,

  updatedAt:
    qr.updatedAt || null,

  lastScannedAt:
    qr.lastScannedAt ||
    null,
}));


      return res
        .status(200)
        .json({
          qrCodes,

          count:
            qrCodes.length,
        });
    }
  );


/* =========================================================
   ADMIN PAYMENTS
   GET /api/admin/payments
   ========================================================= */

export const getAdminPayments =
  asyncHandler(
    async (_req, res) => {

      const db = getDB();

      const snapshot =
        await db
          .collection(
            ORDERS_COLLECTION
          )
          .limit(500)
          .get();


      const orders =
        sortNewestFirst(
          snapshotToDocs(snapshot)
        );


      const payments =
        orders
          .filter(
            (order) =>
              order.payment ||
              order.paymentStatus ||
              order.paidAt
          )
          .map(
            (order) => {

              const payment =
                order.payment || {};


              return {
                orderId:
                  order.id,

                customerEmail:
                  order.customer
                    ?.email ||
                  "",

                status:
                  getPaymentStatus(
                    order
                  ),

                amount:
                  Number(
                    order.total || 0
                  ),

                currency:
                  order.currency ||
                  "EUR",

                vivaOrderCode:
                  payment.vivaOrderCode ||
                  "",

                transactionId:
                  payment.transactionId ||
                  payment.vivaTransactionId ||
                  "",

                checkoutUrl:
                  payment.checkoutUrl ||
                  "",

                createdAt:
                  order.createdAt ||
                  null,

                paidAt:
                  order.paidAt ||
                  null,
              };
            }
          );


      return res
        .status(200)
        .json({
          payments,

          count:
            payments.length,
        });
    }
  );




/* =========================================================
   ADMIN FULFILLMENT / PRODUCT MANAGEMENT
   ========================================================= */

function cleanString(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isInteger(number) ? number : fallback;
}

function cleanImages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) =>
      cleanString(item, 1500)
    )
    .filter(Boolean)
    .slice(0, 20);
}


function cleanVariants(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((variant) => {

      const stock = Math.max(
        0,
        cleanInteger(
          variant?.stock,
          0
        )
      );

      return {
        sku:
          cleanString(
            variant?.sku,
            200
          ),

        size:
          cleanString(
            variant?.size,
            100
          ),

        color:
          cleanString(
            variant?.color,
            100
          ),

        stock,
      };
    })
    .filter(
      (variant) =>
        Boolean(variant.sku)
    )
    .slice(0, 100);
}


function cleanReviews(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((review) => ({
      name:
        cleanString(
          review?.name,
          200
        ),

      rating:
        Math.min(
          5,
          Math.max(
            1,
            cleanInteger(
              review?.rating,
              5
            )
          )
        ),

      comment:
        cleanString(
          review?.comment,
          2000
        ),
    }))
    .filter(
      (review) =>
        review.name ||
        review.comment
    )
    .slice(0, 100);
}


function cleanQrConfig(value) {

  const config =
    value &&
    typeof value === "object"
      ? value
      : {};

  const qrColor =
    cleanString(
      config.qrColor ||
      config.color ||
      "#000000",
      20
    );

  const textColor =
    cleanString(
      config.textColor ||
      qrColor ||
      "#000000",
      20
    );

  return {

    textPrint:
      cleanString(
        config.textPrint ||
        "SCAN ME",
        100
      ),

    textPosition:
      config.textPosition === "top"
        ? "top"
        : "bottom",

    qrColor,

    textColor,

    size:
      Math.max(
        100,
        cleanInteger(
          config.size,
          3540
        )
      ),
  };
}


function safeFileName(value) {
  return String(
    value || "receipt.pdf"
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    )
    .slice(0, 180);
}

function fulfillmentStatus(order) {
  if (!isPaidOrder(order)) return "not_paid";

  const status = String(
    order.fulfillmentStatus || "to_prepare"
  ).toLowerCase();

  const allowed = [
    "to_prepare",
    "preparing",
    "ready",
    "shipped",
    "completed",
    "cancelled",
  ];

  return allowed.includes(status)
    ? status
    : "to_prepare";
}

function buildOrderHistoryEntry(req, action, details = {}) {
  return {
    action,
    at: nowIso(),
    adminUid: req.user?.uid || null,
    adminEmail: req.user?.email || null,
    ...details,
  };
}


/* =========================================================
   FULFILLMENT LIST
   GET /api/admin/fulfillment
   ========================================================= */

export const getAdminFulfillment = asyncHandler(
  async (_req, res) => {
    const db = getDB();

    const snapshot = await db
      .collection(ORDERS_COLLECTION)
      .limit(500)
      .get();

    const paidOrders = sortNewestFirst(
      snapshotToDocs(snapshot).filter(isPaidOrder)
    ).map((order) => ({
      ...normalizeOrderForAdmin(order),
      fulfillmentStatus: fulfillmentStatus(order),
      receipt: order.receipt || null,
      warehouse: order.warehouse || {},
      shipping: order.shipping || {},
    }));

    return res.status(200).json({
      orders: paidOrders,
      count: paidOrders.length,

      summary: {
        toPrepare: paidOrders.filter(
          (order) => order.fulfillmentStatus === "to_prepare"
        ).length,

        preparing: paidOrders.filter(
          (order) => order.fulfillmentStatus === "preparing"
        ).length,

        ready: paidOrders.filter(
          (order) => order.fulfillmentStatus === "ready"
        ).length,

        shipped: paidOrders.filter(
          (order) => order.fulfillmentStatus === "shipped"
        ).length,
      },
    });
  }
);


/* =========================================================
   UPDATE FULFILLMENT STATUS
   PATCH /api/admin/orders/:id/fulfillment
   ========================================================= */

export const updateOrderFulfillment = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const orderId = cleanString(req.params.id, 200);
    const status = cleanString(req.body?.status, 50).toLowerCase();

    const allowedStatuses = [
      "to_prepare",
      "preparing",
      "ready",
      "shipped",
      "completed",
      "cancelled",
    ];

    if (!allowedStatuses.includes(status)) {
      throw new ApiError(400, "Invalid fulfillment status");
    }

    const ref = db
      .collection(ORDERS_COLLECTION)
      .doc(orderId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(404, "Order not found");
    }

    const order = {
      id: snapshot.id,
      ...snapshot.data(),
    };

    if (!isPaidOrder(order)) {
      throw new ApiError(
        400,
        "Only paid orders can enter fulfillment"
      );
    }

    const previousStatus = fulfillmentStatus(order);

    const update = {
      fulfillmentStatus: status,
      updatedAt: nowIso(),

      history: [
        ...(Array.isArray(order.history) ? order.history : []),

        buildOrderHistoryEntry(
          req,
          "fulfillment_status_changed",
          {
            from: previousStatus,
            to: status,
          }
        ),
      ],
    };

    if (status === "preparing" && !order.processingStartedAt) {
      update.processingStartedAt = nowIso();
    }

    if (status === "ready") {
      update.readyAt = nowIso();
    }

    if (status === "shipped") {
      update.shippedAt = nowIso();
    }

    if (status === "completed") {
      update.completedAt = nowIso();
    }

    await ref.update(update);

    const updated = await ref.get();

    return res.status(200).json({
      success: true,
      order: normalizeOrderForAdmin({
        id: updated.id,
        ...updated.data(),
      }),
    });
  }
);


/* =========================================================
   WAREHOUSE CHECKLIST
   PATCH /api/admin/orders/:id/checklist
   ========================================================= */

export const updateOrderChecklist = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const orderId = cleanString(req.params.id, 200);

    const checklist = {
      productPicked: Boolean(req.body?.productPicked),
      sizeVerified: Boolean(req.body?.sizeVerified),
      qrAttached: Boolean(req.body?.qrAttached),
      qrTested: Boolean(req.body?.qrTested),
      packed: Boolean(req.body?.packed),
    };

    const ref = db
      .collection(ORDERS_COLLECTION)
      .doc(orderId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(404, "Order not found");
    }

    await ref.update({
      warehouse: {
        ...(snapshot.data()?.warehouse || {}),
        checklist,
        updatedAt: nowIso(),
        updatedBy: req.user?.uid || null,
      },

      updatedAt: nowIso(),
    });

    return res.status(200).json({
      success: true,
      checklist,
    });
  }
);


/* =========================================================
   SHIPPING INFORMATION
   PATCH /api/admin/orders/:id/shipping
   ========================================================= */

export const updateOrderShipping = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const orderId = cleanString(req.params.id, 200);

    const ref = db
      .collection(ORDERS_COLLECTION)
      .doc(orderId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(404, "Order not found");
    }

    const current = snapshot.data()?.shipping || {};

    const shipping = {
      ...current,

      carrier:
        cleanString(req.body?.carrier, 100) ||
        current.carrier ||
        "BOX NOW",

      parcelId:
        cleanString(req.body?.parcelId, 200),

      trackingNumber:
        cleanString(req.body?.trackingNumber, 200),

      trackingUrl:
        cleanString(req.body?.trackingUrl, 1000),

      lockerId:
        cleanString(req.body?.lockerId, 200),

      lockerName:
        cleanString(req.body?.lockerName, 300),

      updatedAt: nowIso(),
    };

    await ref.update({
      shipping,
      updatedAt: nowIso(),
    });

    return res.status(200).json({
      success: true,
      shipping,
    });
  }
);


/* =========================================================
   RECEIPT METADATA
   PATCH /api/admin/orders/:id/receipt
   ========================================================= */

export const updateOrderReceipt = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const orderId = cleanString(req.params.id, 200);

    const ref = db
      .collection(ORDERS_COLLECTION)
      .doc(orderId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(404, "Order not found");
    }

    const receipt = {
      ...(snapshot.data()?.receipt || {}),

      number:
        cleanString(req.body?.number, 200),

      mark:
        cleanString(req.body?.mark, 200),

      fileName:
        cleanString(req.body?.fileName, 300),

      storagePath:
        cleanString(req.body?.storagePath, 1000),

      uploaded:
        Boolean(req.body?.uploaded),

      uploadedAt:
        req.body?.uploaded
          ? nowIso()
          : null,

      uploadedBy:
        req.body?.uploaded
          ? req.user?.uid || null
          : null,
    };

    await ref.update({
      receipt,
      updatedAt: nowIso(),
    });

    return res.status(200).json({
      success: true,
      receipt,
    });
  }
);


/* =========================================================
   CREATE PRODUCT
   POST /api/admin/products
   ========================================================= */

export const createAdminProduct =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const title =
        cleanString(
          req.body?.title,
          200
        );

      if (!title) {
        throw new ApiError(
          400,
          "Product title is required"
        );
      }


      const requestedId =
        cleanString(
          req.body?.id ||
          req.body?.slug ||
          title,
          200
        );


      const id =
        normalizeProductId({
          id: requestedId,
        });


      if (!id) {
        throw new ApiError(
          400,
          "Invalid product ID"
        );
      }


      const ref =
        db
          .collection(
            PRODUCTS_COLLECTION
          )
          .doc(id);


      const existing =
        await ref.get();


      if (existing.exists) {
        throw new ApiError(
          409,
          "A product with this ID already exists"
        );
      }


      const price =
        cleanNumber(
          req.body?.price
        );


      if (price < 0) {
        throw new ApiError(
          400,
          "Price cannot be negative"
        );
      }


      const stock =
        cleanInteger(
          req.body?.stock
        );


      if (stock < 0) {
        throw new ApiError(
          400,
          "Stock cannot be negative"
        );
      }


      const images =
        cleanImages(
          req.body?.images
        );


      const variants =
        cleanVariants(
          req.body?.variants
        );


      const reviews =
        cleanReviews(
          req.body?.reviews
        );


      const qrConfig =
        cleanQrConfig(
          req.body?.qrConfig
        );


      const slug =
        normalizeProductId({
          id:
            req.body?.slug ||
            id,
        }) || id;


      const createdAt =
        nowIso();


      const product = {

        id,

        slug,

        title,

        shortDescription:
          cleanString(
            req.body
              ?.shortDescription,
            500
          ),

        description:
          cleanString(
            req.body
              ?.description,
            10000
          ),

        category:
          cleanString(
            req.body?.category,
            200
          ) ||
          "General",

        price,

        currency:
          cleanString(
            req.body?.currency,
            10
          ) ||
          "EUR",

        /*
         * Fallback sellable stock.
         *
         * We keep this because you
         * explicitly want the shop
         * to continue selling even
         * when pre-generated QR
         * inventory reaches zero.
         */
        stock,

        featured:
          Boolean(
            req.body?.featured
          ),

        active:
          req.body?.active !==
          false,

        customQr:
          req.body?.customQr !==
          false,

        qrConfig,

        images,

        variants,

        reviews,

        lowStockThreshold:
          Math.max(
            0,
            cleanInteger(
              req.body
                ?.lowStockThreshold,
              3
            )
          ),

        createdAt,

        updatedAt:
          createdAt,
      };


      await ref.set(
        product
      );


      return res
        .status(201)
        .json({

          success: true,

          product: {
            ...product,

            image:
              images[0] ||
              "",
          },
        });
    }
  );


/* =========================================================
   UPDATE PRODUCT
   PATCH /api/admin/products/:id
   ========================================================= */

export const updateAdminProduct =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const id =
        cleanString(
          req.params.id,
          200
        );


      const ref =
        db
          .collection(
            PRODUCTS_COLLECTION
          )
          .doc(id);


      const snapshot =
        await ref.get();


      if (!snapshot.exists) {
        throw new ApiError(
          404,
          "Product not found"
        );
      }


      const update = {};


      if (
        req.body?.slug !==
        undefined
      ) {

        const slug =
          normalizeProductId({
            id:
              req.body.slug,
          });

        if (!slug) {
          throw new ApiError(
            400,
            "Invalid product slug"
          );
        }

        update.slug =
          slug;
      }


      const stringFields = [
        "title",
        "shortDescription",
        "description",
        "category",
        "currency",
      ];


      for (
        const field
        of stringFields
      ) {

        if (
          req.body?.[field] !==
          undefined
        ) {

          update[field] =
            cleanString(
              req.body[field],
              field ===
              "description"
                ? 10000
                : 500
            );
        }
      }


      if (
        req.body?.price !==
        undefined
      ) {

        const price =
          cleanNumber(
            req.body.price
          );

        if (price < 0) {
          throw new ApiError(
            400,
            "Price cannot be negative"
          );
        }

        update.price =
          price;
      }


      if (
        req.body?.stock !==
        undefined
      ) {

        const stock =
          cleanInteger(
            req.body.stock
          );

        if (stock < 0) {
          throw new ApiError(
            400,
            "Stock cannot be negative"
          );
        }

        update.stock =
          stock;
      }


      if (
        req.body?.active !==
        undefined
      ) {
        update.active =
          Boolean(
            req.body.active
          );
      }


      if (
        req.body?.featured !==
        undefined
      ) {
        update.featured =
          Boolean(
            req.body.featured
          );
      }


      if (
        req.body?.customQr !==
        undefined
      ) {
        update.customQr =
          Boolean(
            req.body.customQr
          );
      }


      if (
        req.body?.images !==
        undefined
      ) {
        update.images =
          cleanImages(
            req.body.images
          );
      }


      if (
        req.body?.variants !==
        undefined
      ) {
        update.variants =
          cleanVariants(
            req.body.variants
          );
      }


      if (
        req.body?.reviews !==
        undefined
      ) {
        update.reviews =
          cleanReviews(
            req.body.reviews
          );
      }


      if (
        req.body?.qrConfig !==
        undefined
      ) {
        update.qrConfig =
          cleanQrConfig(
            req.body.qrConfig
          );
      }


      if (
        req.body
          ?.lowStockThreshold !==
        undefined
      ) {

        update
          .lowStockThreshold =
          Math.max(
            0,
            cleanInteger(
              req.body
                .lowStockThreshold
            )
          );
      }


      update.updatedAt =
        nowIso();


      await ref.update(
        update
      );


      const updated =
        await ref.get();


      const product = {
        id:
          updated.id,

        ...updated.data(),
      };


      return res
        .status(200)
        .json({

          success: true,

          product: {
            ...product,

            image:
              Array.isArray(
                product.images
              )
                ? product
                    .images[0] ||
                  ""
                : "",
          },
        });
    }
  );


/* =========================================================
   STOCK MANAGEMENT
   PATCH /api/admin/products/:id/stock

   body examples:

   { "operation": "add", "quantity": 5 }
   { "operation": "remove", "quantity": 2 }
   { "operation": "set", "quantity": 20 }
   ========================================================= */

export const updateAdminProductStock = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const productId =
      cleanString(req.params.id, 200);

    const operation =
      cleanString(
        req.body?.operation,
        20
      ).toLowerCase();

    const quantity =
      cleanInteger(req.body?.quantity);

    if (
      !["add", "remove", "set"].includes(
        operation
      )
    ) {
      throw new ApiError(
        400,
        "operation must be add, remove or set"
      );
    }

    if (quantity < 0) {
      throw new ApiError(
        400,
        "Quantity cannot be negative"
      );
    }

    const ref = db
      .collection(PRODUCTS_COLLECTION)
      .doc(productId);

    const result =
      await db.runTransaction(
        async (transaction) => {
          const snapshot =
            await transaction.get(ref);

          if (!snapshot.exists) {
            throw new ApiError(
              404,
              "Product not found"
            );
          }

          const product =
            snapshot.data();

          const oldStock =
            cleanInteger(
              product.stock,
              0
            );

          let newStock;

          if (operation === "add") {
            newStock =
              oldStock + quantity;
          } else if (
            operation === "remove"
          ) {
            newStock =
              oldStock - quantity;
          } else {
            newStock = quantity;
          }

          if (newStock < 0) {
            throw new ApiError(
              400,
              `Insufficient stock. Current stock: ${oldStock}`
            );
          }

          transaction.update(ref, {
            stock: newStock,
            updatedAt: nowIso(),
          });

          return {
            oldStock,
            newStock,
          };
        }
      );

    return res.status(200).json({
      success: true,
      productId,
      operation,
      quantity,
      ...result,
    });
  }
);


/* =========================================================
   ARCHIVE PRODUCT
   POST /api/admin/products/:id/archive
   ========================================================= */

export const archiveAdminProduct = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const id = cleanString(
      req.params.id,
      200
    );

    const ref = db
      .collection(PRODUCTS_COLLECTION)
      .doc(id);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(
        404,
        "Product not found"
      );
    }

    await ref.update({
      active: false,
      archivedAt: nowIso(),
      updatedAt: nowIso(),
    });

    return res.status(200).json({
      success: true,
      id,
    });
  }
);


/* =========================================================
   GENERATE PREPRINTED QR STOCK
   POST /api/admin/inventory/generate
   ========================================================= */

export const generateAdminQrStock =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const productId =
        cleanString(
          req.body?.productId,
          200
        );

      const sku =
        cleanString(
          req.body?.sku,
          200
        );

      const size =
        cleanString(
          req.body?.size,
          100
        );

      const color =
        cleanString(
          req.body?.color,
          100
        );

      const quantity =
        cleanInteger(
          req.body?.quantity
        );


      if (!productId) {
        throw new ApiError(
          400,
          "Product ID is required"
        );
      }


      if (!sku) {
        throw new ApiError(
          400,
          "SKU is required"
        );
      }


      if (
        quantity < 1 ||
        quantity > 100
      ) {
        throw new ApiError(
          400,
          "Quantity must be between 1 and 100"
        );
      }


      const productRef =
        db
          .collection(
            PRODUCTS_COLLECTION
          )
          .doc(productId);


      const productSnap =
        await productRef.get();


      if (
        !productSnap.exists
      ) {
        throw new ApiError(
          404,
          "Product not found"
        );
      }


      const product = {
        id:
          productSnap.id,

        ...productSnap.data(),
      };


      const inventoryKey =
        `${productId}::${sku}`;


      const publicQrBaseUrl =
        process.env
          .QR_PUBLIC_BASE_URL ||
        "https://go.skanare.com";


      const created = [];

      const printLinks = [];


      for (
        let index = 0;
        index < quantity;
        index += 1
      ) {

        const result =
          await db.runTransaction(
            async (tx) => {

              const qrId =
                createId("qr");


              const {
                shortId,
                reservationRef,
              } =
                await reserveUniqueQrShortId(
                  tx,
                  db
                );


              const createdAt =
                nowIso();


              const qrRef =
                db
                  .collection(
                    QR_CODES_COLLECTION
                  )
                  .doc(qrId);


              writeQrShortIdReservation(
                tx,
                reservationRef,
                {
                  qrId,
                  shortId,
                  createdAt,
                }
              );


              tx.set(
                qrRef,
                {
                  id:
                    qrId,

                  shortId,

                  status:
                    "available",

                  productId,

                  productTitle:
                    product.title ||
                    "",

                  sku,

                  inventoryKey,

                  variant: {
                    sku,
                    size,
                    color,
                  },

                  qrConfig:
                    product.qrConfig ||
                    null,

                  userId:
                    null,

                  guestId:
                    null,

                  orderId:
                    null,

                  targetUrl:
                    "https://skanare.com",

                  scans:
                    0,

                  fulfillmentMode:
                    "preprinted",

                  printStatus:
                    "pending",

                  createdAt,

                  updatedAt:
                    createdAt,
                }
              );


              return {
                qrId,
                shortId,

                url:
                  `${publicQrBaseUrl}/${shortId}`,
              };
            }
          );


        created.push(
          result
        );


        try {

          /*
           * Same QR artwork logic
           * as generate-qr-stock.js
           */

          const qrBuffer =
            await generatePrintQrImage(
              result.url,
              {
                qrColor:
                  product
                    .qrConfig
                    ?.qrColor ||
                  product
                    .qrConfig
                    ?.color ||
                  "#000000",

                textColor:
                  product
                    .qrConfig
                    ?.textColor ||
                  product
                    .qrConfig
                    ?.qrColor ||
                  "#000000",

                textPrint:
                  product
                    .qrConfig
                    ?.textPrint ||
                  "SCAN ME",

                textPosition:
                  product
                    .qrConfig
                    ?.textPosition ||
                  "bottom",

                size:
                  product
                    .qrConfig
                    ?.size ||
                  3540,
              }
            );


          const a3Buffer =
            await generatePrintSheet({
              qrBuffer,

              shirtColor:
                color ||
                "Black",
            });


          const uploaded =
            await uploadQrToStorage(
              `stock-${result.qrId}`,
              a3Buffer
            );


          if (
            !uploaded?.url
          ) {
            throw new Error(
              "QR print upload did not return URL"
            );
          }


          const generatedAt =
            nowIso();


          await db
            .collection(
              QR_CODES_COLLECTION
            )
            .doc(
              result.qrId
            )
            .set(
              {
                printStatus:
                  "uploaded",

                printGeneratedAt:
                  generatedAt,

                printFileUrl:
                  uploaded.url,

                updatedAt:
                  generatedAt,
              },
              {
                merge: true,
              }
            );


          printLinks.push({
            qrId:
              result.qrId,

            shortId:
              result.shortId,

            qrUrl:
              result.url,

            printUrl:
              uploaded.url,
          });


        } catch (error) {

          const failedAt =
            nowIso();


          await db
            .collection(
              QR_CODES_COLLECTION
            )
            .doc(
              result.qrId
            )
            .set(
              {
                printStatus:
                  "failed",

                printError:
                  String(
                    error?.message ||
                    error
                  ),

                printFailedAt:
                  failedAt,

                updatedAt:
                  failedAt,
              },
              {
                merge: true,
              }
            );


          throw error;
        }
      }


      /*
       * Send the same kind of
       * admin print email.
       */

      const adminEmail =
        process.env
          .ADMIN_EMAIL;

      const from =
        process.env
          .EMAIL_ORDER ||
        process.env
          .EMAIL_FROM;


      if (
        adminEmail &&
        from &&
        printLinks.length
      ) {

        const linksHtml =
          printLinks
            .map(
              (
                item,
                index
              ) => `
                <div style="
                  margin:20px 0;
                  padding:18px;
                  background:#f7f7f7;
                ">
                  <p>
                    <strong>
                      Print ${index + 1}
                    </strong>
                  </p>

                  <p>
                    QR ID:
                    ${item.shortId}
                  </p>

                  <a
                    href="${item.printUrl}"
                    target="_blank"
                  >
                    Download A3 DTF Print
                  </a>
                </div>
              `
            )
            .join("");


        await sendEmail({
          from,

          to:
            adminEmail,

          subject:
            `QR Stock Print - ${product.title} - ${sku}`,

          html: `
            <h2>
              New QR Stock Ready for Printing
            </h2>

            <p>
              <strong>Product:</strong>
              ${product.title}
            </p>

            <p>
              <strong>SKU:</strong>
              ${sku}
            </p>

            <p>
              <strong>Size:</strong>
              ${size || "-"}
            </p>

            <p>
              <strong>Color:</strong>
              ${color || "-"}
            </p>

            <p>
              <strong>Quantity:</strong>
              ${quantity}
            </p>

            ${linksHtml}
          `,
        });


        const emailSentAt =
          nowIso();


        for (
          const item
          of created
        ) {

          await db
            .collection(
              QR_CODES_COLLECTION
            )
            .doc(
              item.qrId
            )
            .set(
              {
                printStatus:
                  "email_sent",

                adminPrintEmailSentAt:
                  emailSentAt,

                updatedAt:
                  emailSentAt,
              },
              {
                merge: true,
              }
            );
        }
      }


      return res
        .status(201)
        .json({

          success: true,

          count:
            created.length,

          inventoryKey,

          created:
            created.map(
              (item) => ({

                qrId:
                  item.qrId,

                shortId:
                  item.shortId,

                url:
                  item.url,

                printUrl:
                  printLinks
                    .find(
                      (print) =>
                        print.qrId ===
                        item.qrId
                    )
                    ?.printUrl ||
                  null,
              })
            ),
        });
    }
  );


  /* =========================================================
   UPLOAD RECEIPT PDF
   POST /api/admin/orders/:id/receipt-file
   ========================================================= */

export const uploadOrderReceiptPdf =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const orderId =
        cleanString(
          req.params.id,
          200
        );


      if (!req.file) {
        throw new ApiError(
          400,
          "Receipt PDF is required"
        );
      }


      if (
        req.file.mimetype !==
        "application/pdf"
      ) {
        throw new ApiError(
          400,
          "Receipt must be a PDF"
        );
      }


      const orderRef =
        db
          .collection(
            ORDERS_COLLECTION
          )
          .doc(orderId);


      const orderSnap =
        await orderRef.get();


      if (
        !orderSnap.exists
      ) {
        throw new ApiError(
          404,
          "Order not found"
        );
      }


      const order =
        orderSnap.data();


      if (
        !isPaidOrder(order)
      ) {
        throw new ApiError(
          400,
          "Receipt can only be uploaded for a paid order"
        );
      }


      const fileName =
        safeFileName(
          req.file
            .originalname ||
          "receipt.pdf"
        );


      const storagePath =
        `receipts/${orderId}/${Date.now()}-${fileName}`;


      const bucket =
        getStorage()
          .bucket();


      const file =
        bucket.file(
          storagePath
        );


      await file.save(
        req.file.buffer,
        {
          resumable:
            false,

          metadata: {
            contentType:
              "application/pdf",

            metadata: {
              orderId,

              uploadedBy:
                req.user?.uid ||
                "",
            },
          },
        }
      );


      const uploadedAt =
        nowIso();


      const receipt = {

        ...(
          order.receipt ||
          {}
        ),

        number:
          cleanString(
            req.body?.number,
            200
          ),

        mark:
          cleanString(
            req.body?.mark,
            200
          ),

        uploaded:
          true,

        fileName,

        storagePath,

        contentType:
          "application/pdf",

        uploadedAt,

        uploadedBy:
          req.user?.uid ||
          null,

        sentToCustomer:
          false,
      };


      await orderRef.set(
        {
          receipt,

          updatedAt:
            uploadedAt,
        },
        {
          merge: true,
        }
      );


      return res
        .status(200)
        .json({

          success: true,

          receipt,
        });
    }
  );


  /* =========================================================
   SHIP ORDER + SEND CUSTOMER EMAIL
   POST /api/admin/orders/:id/ship
   ========================================================= */

export const shipOrderAndNotify =
  asyncHandler(
    async (req, res) => {

      const db = getDB();

      const orderId =
        cleanString(
          req.params.id,
          200
        );


      const orderRef =
        db
          .collection(
            ORDERS_COLLECTION
          )
          .doc(orderId);


      const orderSnap =
        await orderRef.get();


      if (
        !orderSnap.exists
      ) {
        throw new ApiError(
          404,
          "Order not found"
        );
      }


      const order = {
        id:
          orderSnap.id,

        ...orderSnap.data(),
      };


      if (
        !isPaidOrder(order)
      ) {
        throw new ApiError(
          400,
          "Only paid orders can be shipped"
        );
      }


      /*
       * Idempotency:
       * pressing the button again
       * must NOT resend the email.
       */

      if (
        order.emails
          ?.shippedOrderSentAt
      ) {

        return res
          .status(200)
          .json({

            success: true,

            alreadySent:
              true,

            message:
              "Order was already shipped and customer was already notified",
          });
      }


      const customerEmail =
        cleanString(
          order.customer?.email,
          320
        );


      if (!customerEmail) {
        throw new ApiError(
          400,
          "Customer email is missing"
        );
      }


      if (
        !order.receipt
          ?.uploaded ||
        !order.receipt
          ?.storagePath
      ) {
        throw new ApiError(
          400,
          "Upload the receipt PDF before shipping"
        );
      }


      if (
        !order.warehouse
          ?.checklist
          ?.packed
      ) {
        throw new ApiError(
          400,
          "Complete the warehouse checklist and mark the order as packed first"
        );
      }


      const from =
        process.env
          .EMAIL_ORDER ||
        process.env
          .EMAIL_FROM;


      if (!from) {
        throw new ApiError(
          500,
          "EMAIL_ORDER / EMAIL_FROM is not configured"
        );
      }


      /*
       * Fetch private receipt PDF
       * from Firebase Storage.
       */

      const bucket =
        getStorage()
          .bucket();


      const receiptFile =
        bucket.file(
          order.receipt
            .storagePath
        );


      const [
        receiptBuffer,
      ] =
        await receiptFile
          .download();


      const shipping =
        order.shipping ||
        {};


      const trackingText =
        shipping.trackingNumber ||
        shipping.parcelId ||
        "—";


      const trackingButton =
        shipping.trackingUrl
          ? `
            <p style="
              margin:28px 0;
            ">
              <a
                href="${shipping.trackingUrl}"
                target="_blank"
                style="
                  display:inline-block;
                  background:#111;
                  color:#fff;
                  padding:14px 20px;
                  text-decoration:none;
                "
              >
                Track your order
              </a>
            </p>
          `
          : "";


      await sendEmail({

        from,

        to:
          customerEmail,

        subject:
          "Your Skanare order is on its way",

        html: `
          <div style="
            font-family:Arial,sans-serif;
            max-width:600px;
            margin:0 auto;
            color:#111;
          ">

            <p style="
              letter-spacing:3px;
              font-weight:700;
            ">
              SKANARE
            </p>

            <h1>
              Your order is on the way.
            </h1>

            <p>
              Hi ${
                order.customer
                  ?.firstName ||
                ""
              },
            </p>

            <p>
              Your Skanare order has been prepared and shipped.
            </p>

            <p>
              <strong>
                Order
              </strong>
              <br>
              ${
                order.orderNumber ||
                order.id
              }
            </p>

            <p>
              <strong>
                Delivery
              </strong>
              <br>
              ${
                shipping.carrier ||
                order.delivery ||
                "BOX NOW"
              }
            </p>

            <p>
              <strong>
                Tracking
              </strong>
              <br>
              ${trackingText}
            </p>

            ${trackingButton}

            <p>
              Your receipt is attached to this email.
            </p>

            <p style="
              margin-top:40px;
            ">
              Thank you for choosing Skanare.
            </p>

          </div>
        `,

        attachments: [
          {
            filename:
              order.receipt
                .fileName ||
              `Skanare-${order.id}-receipt.pdf`,

            content:
              receiptBuffer,
          },
        ],
      });


      const shippedAt =
        nowIso();


      await orderRef.set(
        {

          fulfillmentStatus:
            "shipped",

          shippedAt,

          shipping: {
            ...shipping,

            status:
              "shipped",

            shippedAt,

            updatedAt:
              shippedAt,
          },

          receipt: {
            ...order.receipt,

            sentToCustomer:
              true,

            sentAt:
              shippedAt,
          },

          emails: {
            ...(
              order.emails ||
              {}
            ),

            shippedOrderSentAt:
              shippedAt,
          },

          history: [
            ...(
              Array.isArray(
                order.history
              )
                ? order.history
                : []
            ),

            buildOrderHistoryEntry(
              req,
              "order_shipped",
              {
                customerEmail,
              }
            ),
          ],

          updatedAt:
            shippedAt,
        },
        {
          merge: true,
        }
      );


      return res
        .status(200)
        .json({

          success: true,

          shippedAt,

          customerEmail,
        });
    }
  );