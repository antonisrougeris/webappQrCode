import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";

import { sendPaidOrderEmails } from "./order-email.service.js";



import {
  reserveUniqueQrShortId,
  writeQrShortIdReservation,
} from "./qr-id.service.js";


import {
  issueOrderReceipt,
} from "./oxygen.service.js";

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

    // Pending checkout may have atomically reserved ready QR codes.
    // For older orders (without inventoryReservations), retain the legacy path.
    const qrAssignments = [];
    const holds = Array.isArray(order.inventoryReservations)
      ? order.inventoryReservations : null;

    if (holds) {
      if (order.inventoryReservationState !== "held") {
        throw new ApiError(409, "Checkout inventory reservation is not held");
      }
      const heldByItem = new Map(holds.map(h => [String(h.orderItemId), h]));
      const allIds = holds.flatMap(h => h.qrIds || []);
      if (new Set(allIds).size !== allIds.length) {
        throw new ApiError(409, "Duplicate reserved QR detected");
      }
      const heldSnaps = await Promise.all(allIds.map(id => tx.get(
        db.collection(COLLECTIONS.QR_CODES).doc(String(id))
      )));
      const heldDocs = new Map(heldSnaps.map(doc => [doc.id, doc]));

      for (const item of order.items || []) {
        if (!item.customQr) continue;
        const hold = heldByItem.get(String(item.id));
        const sku = getItemSku(item);
        const key = buildQrInventoryKey(item);
        const quantity = Number(item.quantity);
        if (!hold || hold.productId !== item.productId || hold.sku !== sku ||
            hold.inventoryKey !== key || !Number.isSafeInteger(quantity) || quantity < 1 ||
            (hold.qrIds || []).length + hold.fallbackQuantity !== quantity) {
          throw new ApiError(409, "Invalid checkout QR reservation");
        }
        for (const id of hold.qrIds || []) {
          const snap = heldDocs.get(String(id));
          const qr = snap?.data();
          if (!snap?.exists || qr.status !== "reserved" ||
              qr.reservationOrderId !== order.id ||
              qr.reservationItemId !== item.id || qr.inventoryKey !== key) {
            throw new ApiError(409, "Reserved QR changed before payment confirmation");
          }
          qrAssignments.push({type: "existing", ref: snap.ref, item, sku,
            inventoryKey: key, qrConfig: buildQrConfig(item)});
        }
        for (let i = 0; i < hold.fallbackQuantity; i += 1) {
          const qrId = createId("qr");
          const {shortId, reservationRef} = await reserveUniqueQrShortId(tx, db);
          qrAssignments.push({type: "new", qrId, shortId, reservationRef,
            item, sku, inventoryKey: key, qrConfig: buildQrConfig(item)});
        }
      }
    } else {
      const existingQrSnap = await tx.get(
        db.collection(COLLECTIONS.QR_CODES).where("orderId", "==", order.id)
      );
      if (existingQrSnap.empty) {
        const selected = new Set();
        for (const item of order.items || []) {
          if (!item.customQr) continue;
          const quantity = Number(item.quantity);
          if (!Number.isSafeInteger(quantity) || quantity < 1) {
            throw new ApiError(409, "Invalid legacy order quantity");
          }
          const sku = getItemSku(item);
          const key = buildQrInventoryKey(item);
          const readySnap = await tx.get(db.collection(COLLECTIONS.QR_CODES)
            .where("status", "==", "available").where("inventoryKey", "==", key));
          const ready = readySnap.docs.filter(doc => !selected.has(doc.ref.path) &&
            ["uploaded", "email_sent"].includes(doc.data().printStatus) &&
            Boolean(doc.data().printFileUrl));
          for (let i = 0; i < quantity; i += 1) {
            const doc = ready[i];
            if (doc) {
              selected.add(doc.ref.path);
              qrAssignments.push({type: "existing", ref: doc.ref, item, sku,
                inventoryKey: key, qrConfig: buildQrConfig(item)});
            } else {
              const qrId = createId("qr");
              const {shortId, reservationRef} = await reserveUniqueQrShortId(tx, db);
              qrAssignments.push({type: "new", qrId, shortId, reservationRef,
                item, sku, inventoryKey: key, qrConfig: buildQrConfig(item)});
            }
          }
        }
      }
    }

    const expectedAmount = Math.round(Number(order.total || 0) * 100);

    if (!amount || !expectedAmount || amount !== expectedAmount) {
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

  // ============================
  // FULFILLMENT
  // ============================

  fulfillmentStatus: "to_prepare",
  ...(holds ? { inventoryReservationState: "consumed" } : {}),

  "warehouse.checklist.productPicked": false,
  "warehouse.checklist.sizeVerified": false,
  "warehouse.checklist.qrAttached": false,
  "warehouse.checklist.qrTested": false,
  "warehouse.checklist.packed": false,

  "receipt.uploaded": false,
  "receipt.sentToCustomer": false,

  "shipping.status": "pending",

  // ============================
  // PAYMENT
  // ============================

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
    reservationOrderId: null,
    reservationItemId: null,
    reservationExpiresAt: null,

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

    // Remove checkoutOrderId or the customer's next checkout will be blocked.
    tx.set(db.collection(COLLECTIONS.CARTS).doc(order.ownerId), {
      userId: order.ownerId, items: [], updatedAt: paidAt,
    });
  });

  console.log("After transaction paidOrderForEmail:", {
    exists: Boolean(paidOrderForEmail),
    orderId: paidOrderForEmail?.id,
    emailAlreadySent: Boolean(paidOrderForEmail?.emails?.paidOrderSentAt),
  });

  if (paidOrderForEmail && process.env.PAYMENT_RECEIPT_MODE !== "manual" &&
      !["issued", "completed"].includes(paidOrderForEmail.invoice?.status)) {
  try {
    const receipt =
      await issueOrderReceipt(
        paidOrderForEmail
      );

    const issuedAt =
      nowIso();

    await getDB()
      .collection(
        COLLECTIONS.ORDERS
      )
      .doc(
        paidOrderForEmail.id
      )
      .set(
        {
          invoice: {
            provider:
              "oxygen",

            status:
              receipt.status ||
              "issued",

            mock:
              Boolean(
                receipt.mock
              ),

            externalId:
              receipt.id ||
              null,

            number:
              receipt.number ||
              null,

            mark:
              receipt.mark ||
              null,

            pdfUrl:
              receipt.pdfUrl ||
              null,

            issuedAt:
              receipt.issuedAt ||
              issuedAt,

            updatedAt:
              issuedAt,
          },

          updatedAt:
            issuedAt,
        },
        {
          merge: true,
        }
      );

    console.log(
      "Order receipt stored",
      {
        orderId:
          paidOrderForEmail.id,

        mock:
          Boolean(
            receipt.mock
          ),
      }
    );
  } catch (error) {
    console.error(
      "Order receipt issue failed",
      {
        orderId:
          paidOrderForEmail.id,

        message:
          error?.message,
      }
    );

    const failedAt =
      nowIso();

    await getDB()
      .collection(
        COLLECTIONS.ORDERS
      )
      .doc(
        paidOrderForEmail.id
      )
      .set(
        {
          invoice: {
            provider:
              "oxygen",

            status:
              "failed",

            error:
              error?.message ||
              "Receipt issue failed",

            updatedAt:
              failedAt,
          },

          updatedAt:
            failedAt,
        },
        {
          merge: true,
        }
      );
  }
}

// Order confirmation is independent of manual or automated invoicing.
// order-email.service.js checks emails.paidOrderSentAt before sending.
if (paidOrderForEmail) {
  try {
    await sendPaidOrderEmails(paidOrderForEmail);
  } catch (error) {
    console.error("Paid order email failed", {
      orderId: paidOrderForEmail.id, message: error?.message,
    });
  }
}

}
