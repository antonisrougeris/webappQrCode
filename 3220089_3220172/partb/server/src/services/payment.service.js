import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";

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

export async function markOrderPaidFromVivaWebhook(payload) {
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
    // READ 1: find order
    const found = await findOrderByVivaOrderCode(tx, db, vivaOrderCode);

    if (!found) {
      return;
    }

    const { ref, order } = found;

    // READ 2: check if QR already created for this order
    // Πρέπει να γίνει ΠΡΙΝ από οποιοδήποτε tx.update / tx.set.
    const existingQrSnap = await tx.get(
      db.collection(COLLECTIONS.QR_CODES).where("orderId", "==", order.id)
    );

    if (order.paymentStatus === "paid") {
      console.log("Viva webhook ignored: order already paid", {
        orderId: order.id,
        vivaOrderCode,
      });

      return;
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

    // WRITE 1: mark order paid
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

    // WRITE 2: create QR codes only once
    if (existingQrSnap.empty) {
      for (const item of order.items || []) {
        if (!item.customQr) continue;

        const qrId = createId("qr");

        tx.set(db.collection(COLLECTIONS.QR_CODES).doc(qrId), {
          id: qrId,
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

    // WRITE 3: clear cart only after confirmed payment
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
}
