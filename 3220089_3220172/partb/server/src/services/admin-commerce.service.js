import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";
import { sendEmail } from "./email.service.js";
import { createRecoveryOffer } from "./recovery-offer.service.js";
import {
  getInventoryKey,
  pruneExpiredHolds,
} from "./inventory-reservation.service.js";
import { isReadyQr } from "./stock-availability.service.js";

function toMillis(value) {
  if (!value) return 0;
  if (typeof value === "object" && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (typeof value === "object" && typeof value.seconds === "number") {
    return value.seconds * 1000;
  }
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
  }).format(Number(value || 0));
}

function storeBaseUrl() {
  return String(
    process.env.PUBLIC_BASE_URL ||
    process.env.APP_BASE_URL ||
    "https://skanare.com"
  ).replace(/\/+$/, "");
}

function activeReservationExpiry(items) {
  const values = (Array.isArray(items) ? items : [])
    .map((item) => Date.parse(String(item?.reservationExpiresAt || "")))
    .filter((value) => Number.isFinite(value) && value > Date.now());

  return values.length
    ? new Date(Math.max(...values)).toISOString()
    : null;
}

function cartTotal(items) {
  return (Array.isArray(items) ? items : []).reduce((sum, item) => {
    return sum + Number(item?.price || 0) * Number(item?.quantity || 0);
  }, 0);
}

function cartCustomer(cart, user) {
  const lead = cart?.checkoutLead || {};
  return {
    firstName: lead.firstName || user?.firstName || "",
    lastName: lead.lastName || user?.lastName || "",
    email: lead.email || user?.email || "",
    phone: lead.phone || user?.phone || "",
  };
}

function paymentStatus(order) {
  const status = String(
    order?.paymentStatus ||
    order?.payment?.status ||
    order?.status ||
    ""
  ).trim().toLowerCase();

  if (order?.paidAt || ["paid", "completed", "captured", "success", "successful"].includes(status)) {
    return "paid";
  }

  if (["failed", "cancelled", "canceled", "declined", "error"].includes(status)) {
    return "failed";
  }

  return "pending";
}

export async function getCommerceOperationsData() {
  const db = getDB();

  const [
    productsSnap,
    cartsSnap,
    ordersSnap,
    usersSnap,
    holdsSnap,
    qrSnap,
  ] = await Promise.all([
    db.collection(COLLECTIONS.PRODUCTS).get(),
    db.collection(COLLECTIONS.CARTS).limit(500).get(),
    db.collection(COLLECTIONS.ORDERS).limit(500).get(),
    db.collection(COLLECTIONS.USERS).limit(500).get(),
    db.collection(COLLECTIONS.INVENTORY_HOLDS).get(),
    db.collection(COLLECTIONS.QR_CODES).get(),
  ]);

  const users = new Map(
    usersSnap.docs.map((doc) => [doc.id, { id: doc.id, ...doc.data() }])
  );

  const nowMs = Date.now();
  const holdsByKey = new Map();

  for (const doc of holdsSnap.docs) {
    const data = doc.data() || {};
    const key = String(data.inventoryKey || "");
    if (!key) continue;

    const active = pruneExpiredHolds(data.holds, nowMs);
    holdsByKey.set(key, active);
  }

  const readyByKey = new Map();
  for (const doc of qrSnap.docs) {
    const qr = doc.data() || {};
    if (!isReadyQr(qr)) continue;
    const key = String(qr.inventoryKey || "");
    if (!key) continue;
    readyByKey.set(key, (readyByKey.get(key) || 0) + 1);
  }

  const activeProducts = productsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((product) => product.active !== false);

  const inventory = [];

  for (const product of activeProducts) {
    const variants = Array.isArray(product.variants) && product.variants.length
      ? product.variants
      : [null];

    for (const variant of variants) {
      const key = getInventoryKey(product.id, variant);
      const holds = holdsByKey.get(key) || [];
      const madeToOrderStock = Number(
        variant ? variant.stock || 0 : product.stock || 0
      );
      const readyQrStock =
        product.customQr && variant?.sku
          ? Number(readyByKey.get(key) || 0)
          : 0;
      const physicalStock = Math.max(0, madeToOrderStock + readyQrStock);
      const reserved = holds.reduce(
        (sum, hold) => sum + Math.max(0, Number(hold.quantity || 0)),
        0
      );

      inventory.push({
        productId: product.id,
        title: product.title || product.id,
        sku: variant?.sku || "",
        size: variant?.size || "",
        color: variant?.color || "",
        inventoryKey: key,
        madeToOrderStock,
        readyQrStock,
        physicalStock,
        reserved,
        available: Math.max(0, physicalStock - reserved),
        cartReserved: holds
          .filter((hold) => hold.phase === "cart")
          .reduce((sum, hold) => sum + Number(hold.quantity || 0), 0),
        paymentReserved: holds
          .filter((hold) => hold.phase === "checkout")
          .reduce((sum, hold) => sum + Number(hold.quantity || 0), 0),
      });
    }
  }

  const carts = cartsSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((cart) => Array.isArray(cart.items) && cart.items.length > 0)
    .map((cart) => {
      const user = users.get(cart.id) || null;
      const customer = cartCustomer(cart, user);
      const reservationExpiresAt = activeReservationExpiry(cart.items);
      const activeReservation = Boolean(reservationExpiresAt);

      return {
        id: cart.id,
        ownerType: user ? "user" : "guest",
        customer,
        items: cart.items,
        itemCount: cart.items.reduce(
          (sum, item) => sum + Number(item.quantity || 0),
          0
        ),
        total: cartTotal(cart.items),
        updatedAt: cart.updatedAt || null,
        checkoutOrderId: cart.checkoutOrderId || null,
        checkoutStartedAt: cart.checkoutStartedAt || null,
        reservationExpiresAt,
        reservationState: activeReservation ? "active" : "expired",
        recovery: cart.recovery || null,
        canEmail: Boolean(customer.email),
      };
    })
    .sort((a, b) => toMillis(b.updatedAt) - toMillis(a.updatedAt));

  const pendingPayments = ordersSnap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .filter((order) => paymentStatus(order) === "pending")
    .map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber || order.id,
      customer: order.customer || {},
      items: Array.isArray(order.items) ? order.items : [],
      total: Number(order.total || 0),
      currency: order.currency || "EUR",
      createdAt: order.createdAt || null,
      updatedAt: order.updatedAt || null,
      checkoutUrl: order.payment?.checkoutUrl || "",
      vivaOrderCode: order.payment?.vivaOrderCode || "",
      reservationExpiresAt: order.stockReservationExpiresAt || null,
      reservationState:
        Date.parse(String(order.stockReservationExpiresAt || "")) > nowMs
          ? "active"
          : "expired",
      recovery: order.recovery || null,
      canEmail: Boolean(order.customer?.email),
    }))
    .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));

  return {
    generatedAt: nowIso(),
    summary: {
      products: activeProducts.length,
      inventoryUnits: inventory.reduce((sum, row) => sum + row.physicalStock, 0),
      availableUnits: inventory.reduce((sum, row) => sum + row.available, 0),
      reservedUnits: inventory.reduce((sum, row) => sum + row.reserved, 0),
      openCarts: carts.length,
      activeCartReservations: carts.filter((cart) => cart.reservationState === "active").length,
      pendingPayments: pendingPayments.length,
      pendingPaymentValue: pendingPayments.reduce((sum, order) => sum + order.total, 0),
    },
    inventory,
    carts,
    pendingPayments,
  };
}

function assertCooldown(entity) {
  const lastSentAt = toMillis(entity?.recovery?.lastSentAt);
  if (lastSentAt && Date.now() - lastSentAt < 15 * 60 * 1000) {
    throw new ApiError(
      429,
      "A recovery email was already sent in the last 15 minutes"
    );
  }
}

function cartEmailHtml({ customer, items, total, offer }) {
  const name = customer.firstName || "there";
  const checkoutUrl = offer
    ? `${storeBaseUrl()}/checkout?code=${encodeURIComponent(offer.code)}`
    : `${storeBaseUrl()}/checkout`;

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111">
      <h1 style="font-size:28px">Your Skanare cart is waiting</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>You left ${Number(items.length)} item(s) in your cart. Your current cart value is <strong>${escapeHtml(money(total))}</strong>.</p>
      ${offer ? `
        <p>To help you finish your order, here is a private <strong>${offer.discountPercent}% discount</strong> valid for 24 hours.</p>
        <p style="font-size:18px"><strong>Code: ${escapeHtml(offer.code)}</strong></p>
      ` : ""}
      <p><a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 22px;text-decoration:none">Return to checkout</a></p>
      <p style="font-size:12px;color:#777">Stock is not guaranteed after the reservation window expires.</p>
    </div>
  `;
}

function paymentEmailHtml({ order }) {
  const name = order.customer?.firstName || "there";
  const checkoutUrl = String(order.payment?.checkoutUrl || "");

  return `
    <div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;color:#111">
      <h1 style="font-size:28px">Complete your Skanare payment</h1>
      <p>Hi ${escapeHtml(name)},</p>
      <p>Your order <strong>${escapeHtml(order.orderNumber || order.id)}</strong> is still waiting for payment.</p>
      <p>Total: <strong>${escapeHtml(money(order.total))}</strong></p>
      <p><a href="${escapeHtml(checkoutUrl)}" style="display:inline-block;background:#111;color:#fff;padding:14px 22px;text-decoration:none">Continue payment</a></p>
      <p style="font-size:12px;color:#777">The payment link and stock reservation may expire.</p>
    </div>
  `;
}

export async function sendCartRecoveryEmail({
  cartId,
  discountPercent = 0,
  adminUid,
}) {
  const db = getDB();
  const cartRef = db.collection(COLLECTIONS.CARTS).doc(String(cartId));
  const cartSnap = await cartRef.get();

  if (!cartSnap.exists) {
    throw new ApiError(404, "Cart not found");
  }

  const cart = { id: cartSnap.id, ...cartSnap.data() };
  if (!Array.isArray(cart.items) || !cart.items.length) {
    throw new ApiError(400, "Cart is empty");
  }

  assertCooldown(cart);

  const userSnap = await db.collection(COLLECTIONS.USERS).doc(cart.id).get();
  const user = userSnap.exists ? { id: userSnap.id, ...userSnap.data() } : null;
  const customer = cartCustomer(cart, user);

  if (!customer.email) {
    throw new ApiError(400, "This cart does not have a customer email yet");
  }

  const percent = Math.max(0, Math.min(30, Math.round(Number(discountPercent || 0))));
  const offer = percent > 0
    ? await createRecoveryOffer({
        email: customer.email,
        cartId: cart.id,
        discountPercent: percent,
        createdBy: adminUid || null,
      })
    : null;

  const subject = offer
    ? `Your Skanare cart + ${offer.discountPercent}% private discount`
    : "Your Skanare cart is waiting";

  const sent = await sendEmail({
    to: customer.email,
    subject,
    html: cartEmailHtml({
      customer,
      items: cart.items,
      total: cartTotal(cart.items),
      offer,
    }),
  });

  const sentAt = nowIso();
  await cartRef.set(
    {
      recovery: {
        lastSentAt: sentAt,
        lastSentBy: adminUid || null,
        emailId: sent?.id || null,
        count: Number(cart.recovery?.count || 0) + 1,
        offerCode: offer?.code || null,
        discountPercent: offer?.discountPercent || 0,
      },
      updatedAt: sentAt,
    },
    { merge: true }
  );

  return {
    sentAt,
    email: customer.email,
    offer,
  };
}

export async function sendPaymentRecoveryEmail({
  orderId,
  adminUid,
}) {
  const db = getDB();
  const orderRef = db.collection(COLLECTIONS.ORDERS).doc(String(orderId));
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    throw new ApiError(404, "Order not found");
  }

  const order = { id: orderSnap.id, ...orderSnap.data() };

  if (paymentStatus(order) !== "pending") {
    throw new ApiError(400, "Only pending payments can receive this reminder");
  }

  assertCooldown(order);

  if (!order.customer?.email) {
    throw new ApiError(400, "Order does not have a customer email");
  }

  if (!order.payment?.checkoutUrl) {
    throw new ApiError(400, "Viva checkout URL is missing");
  }

  const sent = await sendEmail({
    to: order.customer.email,
    subject: `Complete your Skanare order ${order.orderNumber || ""}`.trim(),
    html: paymentEmailHtml({ order }),
  });

  const sentAt = nowIso();
  await orderRef.set(
    {
      recovery: {
        lastSentAt: sentAt,
        lastSentBy: adminUid || null,
        emailId: sent?.id || null,
        count: Number(order.recovery?.count || 0) + 1,
      },
      updatedAt: sentAt,
    },
    { merge: true }
  );

  return {
    sentAt,
    email: order.customer.email,
  };
}
