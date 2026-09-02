import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";

import { sendPaidOrderEmails } from "./order-email.service.js";

import {
  reserveUniqueQrShortId,
  writeQrShortIdReservation,
} from "./qr-id.service.js";


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



function sanitizeQrColor(input, fallback = "#000000") {
  const isValidHex = (value) =>
    /^#[0-9a-fA-F]{6}$/.test(String(value || ""));

  if (typeof input === "string") {
    return isValidHex(input) ? input : fallback;
  }

  if (Array.isArray(input)) {
    const validColors = input.filter(isValidHex);

    return validColors.length >= 2
      ? validColors
      : fallback;
  }

  if (
    input &&
    typeof input === "object" &&
    Array.isArray(input.colors)
  ) {
    const validColors = input.colors.filter(isValidHex);

    if (validColors.length >= 2) {
      return {
        type:
          input.type === "radial"
            ? "radial"
            : "linear",

        colors: validColors,

        angle: Number.isFinite(Number(input.angle))
          ? Number(input.angle)
          : 0,
      };
    }
  }

  return fallback;
}

function buildQrConfig(item) {
  return {
    textPrint:
      String(item.qrConfig?.textPrint || "SCAN ME").trim(),

    textPosition:
      item.qrConfig?.textPosition === "top"
        ? "top"
        : "bottom",

    qrColor: sanitizeQrColor(
      item.qrConfig?.qrColor ??
        item.qrConfig?.color
    ),

    textColor: sanitizeQrColor(
      item.qrConfig?.textColor ??
        item.qrConfig?.qrColor ??
        item.qrConfig?.color
    ),

    size:
      Number(item.qrConfig?.size) > 0
        ? Number(item.qrConfig.size)
        : 3540,
  };
}

function getItemSku(item) {
  return String(
    item.sku ??
    item.variant?.sku ??
    ""
  ).trim();
}

function buildQrInventoryKey(item) {
  const sku = getItemSku(item);

  if (sku) {
    return `${item.productId}::${sku}`;
  }

  const size = String(item.variant?.size || "").trim();
  const color = String(item.variant?.color || "").trim();

  return [
    item.productId,
    size || "-",
    color || "-",
  ].join("::");
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


    const qrAssignments = [];

if (existingQrSnap.empty) {
  const alreadySelectedQrRefs = new Set();

  for (const item of order.items || []) {
    if (!item.customQr) continue;

    const quantity = Math.max(
  1,
  Math.trunc(Number(item.quantity || 1))
);

    const sku = getItemSku(item);
    const inventoryKey = buildQrInventoryKey(item);
    const qrConfig = buildQrConfig(item);

    const availableQrQuery = db
  .collection(COLLECTIONS.QR_CODES)
  .where("status", "==", "available")
  .where("inventoryKey", "==", inventoryKey)
  .limit(quantity + alreadySelectedQrRefs.size);

const availableQrSnap = await tx.get(availableQrQuery);

const availableDocs = availableQrSnap.docs.filter(
  (doc) => !alreadySelectedQrRefs.has(doc.ref.path)
);

    for (
      let unitIndex = 0;
      unitIndex < quantity;
      unitIndex += 1
    ) {
      const availableDoc = availableDocs[unitIndex];

      if (availableDoc) {
        alreadySelectedQrRefs.add(
          availableDoc.ref.path
        );

        qrAssignments.push({
          type: "existing",
          ref: availableDoc.ref,
          item,
          sku,
          inventoryKey,
          qrConfig,
        });

        continue;
      }

      const qrId = createId("qr");

      const {
        shortId,
        reservationRef,
      } = await reserveUniqueQrShortId(tx, db);

      qrAssignments.push({
        type: "new",
        qrId,
        shortId,
        reservationRef,
        item,
        sku,
        inventoryKey,
        qrConfig,
      });
    }
  }
}

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

    for (const assignment of qrAssignments) {
  const item = assignment.item;

  const userId =
    order.ownerType === "user"
      ? order.ownerId
      : null;

  const guestId =
    order.ownerType === "guest"
      ? order.ownerId
      : null;

  if (assignment.type === "existing") {
  tx.update(assignment.ref, {
    status: "assigned",

    userId,
    guestId,

    orderId: order.id,

    productId: item.productId,
    productTitle: item.title,

    sku: assignment.sku,

    inventoryKey: assignment.inventoryKey,

    variant: item.variant || null,

    targetUrl:
      item.qrDestination ||
      "https://skanare.com",

    fulfillmentMode: "preprinted",

    assignedAt: paidAt,
    updatedAt: paidAt,
  });

  continue;
}

  const qrRef = db
    .collection(COLLECTIONS.QR_CODES)
    .doc(assignment.qrId);

  writeQrShortIdReservation(
    tx,
    assignment.reservationRef,
    {
      qrId: assignment.qrId,
      shortId: assignment.shortId,
      createdAt: paidAt,
    }
  );

  tx.set(qrRef, {
    id: assignment.qrId,
    shortId: assignment.shortId,

    status: "assigned",

    productId: item.productId,
    productTitle: item.title,

    sku: assignment.sku,

    inventoryKey: assignment.inventoryKey,

    variant: item.variant || null,

    userId,
    guestId,

    orderId: order.id,

    targetUrl:
      item.qrDestination ||
      "https://skanare.com",

    qrConfig: assignment.qrConfig,

    fulfillmentMode: "made_to_order",

    scans: 0,

    createdAt: paidAt,
    assignedAt: paidAt,
    updatedAt: paidAt,
  });
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
