import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { ApiError } from "../utils/apiError.js";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { nowIso } from "../utils/ids.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


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

            targetUrl:
              qr.targetUrl || "",

            scans:
              Number(
                qr.scans || 0
              ),

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

export const createAdminProduct = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const title = cleanString(req.body?.title, 200);

    if (!title) {
      throw new ApiError(400, "Product title is required");
    }

    const requestedId = cleanString(
      req.body?.id || req.body?.slug || title,
      200
    );

    const id = normalizeProductId({
      id: requestedId,
    });

    if (!id) {
      throw new ApiError(400, "Invalid product ID");
    }

    const ref = db
      .collection(PRODUCTS_COLLECTION)
      .doc(id);

    const existing = await ref.get();

    if (existing.exists) {
      throw new ApiError(
        409,
        "A product with this ID already exists"
      );
    }

    const price = cleanNumber(req.body?.price);

    if (price < 0) {
      throw new ApiError(400, "Price cannot be negative");
    }

    const stock = cleanInteger(req.body?.stock);

    if (stock < 0) {
      throw new ApiError(400, "Stock cannot be negative");
    }

    const images = Array.isArray(req.body?.images)
      ? req.body.images
          .map((image) => cleanString(image, 1500))
          .filter(Boolean)
          .slice(0, 20)
      : [];

    const variants = Array.isArray(req.body?.variants)
      ? req.body.variants
      : [];

    const product = {
      id,

      slug:
        normalizeProductId({
          id: req.body?.slug || id,
        }) || id,

      title,

      shortDescription:
        cleanString(req.body?.shortDescription, 500),

      description:
        cleanString(req.body?.description, 10000),

      category:
        cleanString(req.body?.category, 200) ||
        "General",

      price,

      currency:
        cleanString(req.body?.currency, 10) ||
        "EUR",

      stock,

      variants,

      images,

      active:
        req.body?.active !== false,

      featured:
        Boolean(req.body?.featured),

      customQr:
        Boolean(req.body?.customQr),

      sku:
        cleanString(req.body?.sku, 200),

      lowStockThreshold:
        Math.max(
          0,
          cleanInteger(req.body?.lowStockThreshold, 3)
        ),

      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await ref.set(product);

    return res.status(201).json({
      success: true,
      product: {
        ...product,
        image: images[0] || "",
      },
    });
  }
);


/* =========================================================
   UPDATE PRODUCT
   PATCH /api/admin/products/:id
   ========================================================= */

export const updateAdminProduct = asyncHandler(
  async (req, res) => {
    const db = getDB();

    const id = cleanString(req.params.id, 200);

    const ref = db
      .collection(PRODUCTS_COLLECTION)
      .doc(id);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      throw new ApiError(404, "Product not found");
    }

    const allowedFields = [
      "title",
      "shortDescription",
      "description",
      "category",
      "currency",
      "sku",
    ];

    const update = {};

    for (const field of allowedFields) {
      if (req.body?.[field] !== undefined) {
        update[field] = cleanString(
          req.body[field],
          field === "description" ? 10000 : 500
        );
      }
    }

    if (req.body?.price !== undefined) {
      const price = cleanNumber(req.body.price);

      if (price < 0) {
        throw new ApiError(
          400,
          "Price cannot be negative"
        );
      }

      update.price = price;
    }

    if (req.body?.active !== undefined) {
      update.active = Boolean(req.body.active);
    }

    if (req.body?.featured !== undefined) {
      update.featured = Boolean(
        req.body.featured
      );
    }

    if (req.body?.customQr !== undefined) {
      update.customQr = Boolean(
        req.body.customQr
      );
    }

    if (Array.isArray(req.body?.images)) {
      update.images = req.body.images
        .map((image) =>
          cleanString(image, 1500)
        )
        .filter(Boolean)
        .slice(0, 20);
    }

    if (Array.isArray(req.body?.variants)) {
      update.variants = req.body.variants;
    }

    if (
      req.body?.lowStockThreshold !==
      undefined
    ) {
      update.lowStockThreshold = Math.max(
        0,
        cleanInteger(
          req.body.lowStockThreshold
        )
      );
    }

    update.updatedAt = nowIso();

    await ref.update(update);

    const updated = await ref.get();

    const product = {
      id: updated.id,
      ...updated.data(),
    };

    return res.status(200).json({
      success: true,
      product: {
        ...product,
        image:
          Array.isArray(product.images)
            ? product.images[0] || ""
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