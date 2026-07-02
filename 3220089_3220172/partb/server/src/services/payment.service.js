import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";

import { sendPaidOrderEmails } from "./order-email.service.js";

import crypto from "crypto";

function getEventData(payload) {
  return payload?.EventData || payload?.eventData || payload?.data || payload;
}

function getVivaField(data, names) {
  for (const name of names) {
    if (data?.[name] !== undefined && data?.[name] !== null) {
      return data[name];
    }
  }

  return null;
}

function toCents(value) {
  const n = Number(value);

  if (!Number.isFinite(n)) return 0;

  // Viva webhook Amount έρχεται σε ευρώ, π.χ. 33.4
  return Math.round(n * 100);
}

function normalizeStatusId(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isSuccessfulVivaPayment(data) {
  const status = normalizeStatusId(
    getVivaField(data, ["StatusId", "statusId", "StatusID", "statusID"])
  );

  const responseCode = String(
    getVivaField(data, ["ResponseCode", "responseCode"]) || ""
  ).trim();

  return status === "F" || status === "5" || responseCode === "00";
}

async function findOrderByVivaOrderCode(tx, db, vivaOrderCode) {
  const snap = await tx.get(
    db
      .collection(COLLECTIONS.ORDERS)
      .where("payment.vivaOrderCode", "==", String(vivaOrderCode))
      .limit(1)
  );

  if (snap.empty) {
    console.warn("Viva webhook ignored: order not found", {
      vivaOrderCode: String(vivaOrderCode),
    });

    return null;
  }

  const doc = snap.docs[0];

  return {
    ref: doc.ref,
    order: {
      id: doc.id,
      ...doc.data(),
    },
  };
}

export async function attachVivaPaymentToOrder({
  orderId,
  vivaOrderCode,
  checkoutUrl,
  raw,
}) {
  if (!orderId) throw new ApiError(400, "Missing order id");
  if (!vivaOrderCode) throw new ApiError(400, "Missing Viva order code");

  const db = getDB();
  const updatedAt = nowIso();

  await db
    .collection(COLLECTIONS.ORDERS)
    .doc(orderId)
    .set(
      {
        paymentProvider: "viva",
        paymentStatus: "pending",
        payment: {
          provider: "viva",
          vivaOrderCode: String(vivaOrderCode),
          checkoutUrl,
          rawCreateOrder: raw || null,
          createdAt: updatedAt,
          updatedAt,
        },
        updatedAt,
      },
      { merge: true }
    );
}

function generateShortId(length = 6) {
  return crypto
    .randomBytes(8)
    .toString("base64url")
    .replace(/[-_]/g, "")
    .slice(0, length);
}

async function generateUniqueShortId(tx, db) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const shortId = generateShortId(6);

    const snap = await tx.get(
      db
        .collection(COLLECTIONS.QR_CODES)
        .where("shortId", "==", shortId)
        .limit(1)
    );

    if (snap.empty) return shortId;
  }

  throw new ApiError(500, "Could not generate unique QR short id");
}

export async function markOrderPaidFromVivaWebhook(payload) {
  let paidOrderForEmail = null;
  const data = getEventData(payload);

  const vivaOrderCode = String(
    getVivaField(data, ["OrderCode", "orderCode", "OrderId", "orderId"]) || ""
  );

  const transactionId = String(
    getVivaField(data, [
      "TransactionId",
      "transactionId",
      "TransactionID",
      "transactionID",
    ]) || ""
  );

  const rawStatusId = getVivaField(data, [
    "StatusId",
    "statusId",
    "StatusID",
    "statusID",
  ]);

  const amount = toCents(getVivaField(data, ["Amount", "amount"]));

  console.log("========== PAYMENT WEBHOOK PARSED ==========");
  console.log({
    vivaOrderCode,
    transactionId,
    rawStatusId,
    amount,
    successful: isSuccessfulVivaPayment(data),
  });

  if (!vivaOrderCode || !transactionId) {
    console.warn("Viva webhook ignored: invalid payload", {
      vivaOrderCode,
      transactionId,
      payload,
    });
    return;
  }

  if (!isSuccessfulVivaPayment(data)) {
    console.warn("Viva webhook ignored: payment not successful", {
      vivaOrderCode,
      transactionId,
      statusId: rawStatusId,
    });
    return;
  }

  const db = getDB();
  const paidAt = nowIso();

  await db.runTransaction(async (tx) => {
    const found = await findOrderByVivaOrderCode(tx, db, vivaOrderCode);

    if (!found) {
      console.warn("Webhook transaction stopped: order not found");
      return;
    }

    const { ref, order } = found;

    console.log("Order found for webhook:", {
      id: order.id,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      customerEmail: order.customer?.email,
      hasEmails: Boolean(order.emails?.paidOrderSentAt),
    });

    if (order.paymentStatus === "paid") {
      console.log("Order already paid. Will still attempt email if needed.", {
        orderId: order.id,
        emailsSent: Boolean(order.emails?.paidOrderSentAt),
      });

      paidOrderForEmail = order;
      return;
    }

    const existingQrSnap = await tx.get(
      db.collection(COLLECTIONS.QR_CODES).where("orderId", "==", order.id)
    );

    const expectedAmount = Math.round(Number(order.total || 0) * 100);

    if (amount && expectedAmount && amount !== expectedAmount) {
      throw new ApiError(400, "Viva amount does not match order total", {
        orderId: order.id,
        vivaOrderCode,
        vivaAmount: amount,
        expectedAmount,
      });
    }

    tx.update(ref, {
      status: "paid",
      paymentStatus: "paid",

      "payment.transactionId": transactionId,
      "payment.statusId": rawStatusId || null,
      "payment.amount": amount || expectedAmount,
      "payment.rawWebhook": payload,
      "payment.paidAt": paidAt,
      "payment.updatedAt": paidAt,

      updatedAt: paidAt,
    });

    if (existingQrSnap.empty) {
      for (const item of order.items || []) {
        if (!item.customQr) continue;

        const qrId = createId("qr");
const shortId = await generateUniqueShortId(tx, db);

tx.set(db.collection(COLLECTIONS.QR_CODES).doc(qrId), {
  id: qrId,
  shortId,
  userId: order.ownerType === "user" ? order.ownerId : null,
  guestId: order.ownerType === "guest" ? order.ownerId : null,
  orderId: order.id,
  productId: item.productId,
  productTitle: item.title,
  targetUrl: item.qrDestination || "",
  scans: 0,
  createdAt: paidAt,
  updatedAt: paidAt,
});
      }
    }

    paidOrderForEmail = {
      ...order,
      status: "paid",
      paymentStatus: "paid",
      payment: {
        ...(order.payment || {}),
        transactionId,
        statusId: rawStatusId || null,
        amount: amount || expectedAmount,
        rawWebhook: payload,
        paidAt,
        updatedAt: paidAt,
      },
      updatedAt: paidAt,
    };

    tx.set(
      db.collection(COLLECTIONS.CARTS).doc(order.ownerId),
      {
        userId: order.ownerId,
        items: [],
        updatedAt: paidAt,
      },
      { merge: true }
    );
  });

  console.log("After transaction paidOrderForEmail:", {
    exists: Boolean(paidOrderForEmail),
    orderId: paidOrderForEmail?.id,
    emailAlreadySent: Boolean(paidOrderForEmail?.emails?.paidOrderSentAt),
  });

  if (paidOrderForEmail) {
    try {
      console.log("Calling sendPaidOrderEmails...");
      await sendPaidOrderEmails(paidOrderForEmail);
      console.log("sendPaidOrderEmails completed.");
    } catch (error) {
      console.error("Paid order email failed", {
        orderId: paidOrderForEmail.id,
        message: error?.message,
        stack: error?.stack,
        error,
      });
    }
  }
}
