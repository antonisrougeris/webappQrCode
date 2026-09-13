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