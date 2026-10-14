import crypto from "crypto";

import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";
import { sendEmail } from "./email.service.js";
import { brandedEmailTemplate } from "./email-template.service.js";
import { processBoxNowReturnWebhookEvent } from "./returns.service.js";


/* ==================================================
   RAW DATA EXTRACTION
================================================== */

/*
 * BOX NOW signs ONLY the raw "data" JSON object.
 *
 * We must NOT do:
 *
 * JSON.stringify(req.body.data)
 *
 * because whitespace / key order may change and the
 * signature would no longer match.
 *
 * This function extracts the exact raw JSON substring
 * belonging to the top-level "data" property.
 */
export function extractRawDataObject(rawBody) {
  const raw =
    Buffer.isBuffer(rawBody)
      ? rawBody.toString("utf8")
      : String(rawBody || "");

  if (!raw.trim()) {
    throw new ApiError(
      400,
      "Missing BOX NOW raw webhook body"
    );
  }

  let inString = false;
  let escaped = false;
  let depth = 0;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      /*
       * At top-level object depth 1,
       * check whether this property is "data".
       */
      if (depth === 1) {
        let j = i + 1;
        let key = "";
        let keyEscaped = false;

        while (j < raw.length) {
          const keyChar = raw[j];

          if (keyEscaped) {
            key += keyChar;
            keyEscaped = false;
            j += 1;
            continue;
          }

          if (keyChar === "\\") {
            keyEscaped = true;
            j += 1;
            continue;
          }

          if (keyChar === "\"") {
            break;
          }

          key += keyChar;
          j += 1;
        }

        if (key === "data") {
          let k = j + 1;

          while (
            k < raw.length &&
            /\s/.test(raw[k])
          ) {
            k += 1;
          }

          if (raw[k] !== ":") {
            continue;
          }

          k += 1;

          while (
            k < raw.length &&
            /\s/.test(raw[k])
          ) {
            k += 1;
          }

          if (raw[k] !== "{") {
            throw new ApiError(
              400,
              "Invalid BOX NOW webhook data object"
            );
          }

          const start = k;

          let objectDepth = 0;
          let objectInString = false;
          let objectEscaped = false;

          for (
            let p = start;
            p < raw.length;
            p += 1
          ) {
            const objectChar = raw[p];

            if (objectInString) {
              if (objectEscaped) {
                objectEscaped = false;
                continue;
              }

              if (objectChar === "\\") {
                objectEscaped = true;
                continue;
              }

              if (objectChar === "\"") {
                objectInString = false;
              }

              continue;
            }

            if (objectChar === "\"") {
              objectInString = true;
              continue;
            }

            if (objectChar === "{") {
              objectDepth += 1;
            }

            if (objectChar === "}") {
              objectDepth -= 1;

              if (objectDepth === 0) {
                return raw.slice(
                  start,
                  p + 1
                );
              }
            }
          }

          throw new ApiError(
            400,
            "Incomplete BOX NOW webhook data object"
          );
        }
      }

      inString = true;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
    }
  }

  throw new ApiError(
    400,
    "BOX NOW webhook does not contain data object"
  );
}


/* ==================================================
   SIGNATURE
================================================== */

export function verifyBoxNowSignature({
  rawBody,
  signature,
  secret: secretOverride,
}) {
  const secret =
    String(
      secretOverride ??
      process.env.BOXNOW_WEBHOOK_SECRET ??
      ""
    ).trim();

  if (!secret) {
    throw new ApiError(
      500,
      "BOX NOW webhook secret is not configured"
    );
  }

  const receivedSignature =
    String(signature || "")
      .trim()
      .toLowerCase();

  if (!receivedSignature) {
    throw new ApiError(
      401,
      "Missing BOX NOW webhook signature"
    );
  }

  const rawData =
    extractRawDataObject(rawBody);

  const expectedSignature =
    crypto
      .createHmac(
        "sha256",
        secret
      )
      .update(
        rawData,
        "utf8"
      )
      .digest("hex")
      .toLowerCase();

  /*
   * timingSafeEqual requires equal length buffers.
   */
  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  const expectedBuffer =
    Buffer.from(
      expectedSignature,
      "utf8"
    );

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    throw new ApiError(
      401,
      "Invalid BOX NOW webhook signature"
    );
  }

  if (
    !crypto.timingSafeEqual(
      receivedBuffer,
      expectedBuffer
    )
  ) {
    throw new ApiError(
      401,
      "Invalid BOX NOW webhook signature"
    );
  }

  return true;
}



/*
 * BOX NOW v1.5 uses a DIFFERENT webhook secret in staging.
 *
 * A stage event may be sent to the same public HTTPS callback URL
 * as production. Verify both keys, but NEVER let a staging event
 * update a production order or send customer email.
 *
 * On an isolated staging server BOXNOW_MODE=stage makes its
 * BOXNOW_WEBHOOK_SECRET the staging key.
 * On production BOXNOW_STAGE_WEBHOOK_SECRET is an optional
 * independent key for BOX NOW's registered stage callback.
 */
export function identifyBoxNowWebhookEnvironment({ rawBody, signature }) {
  const configuredSecret = String(process.env.BOXNOW_WEBHOOK_SECRET || "").trim();
  const stageSecret = String(process.env.BOXNOW_STAGE_WEBHOOK_SECRET || "").trim();
  const mode = String(process.env.BOXNOW_MODE || "mock").trim().toLowerCase();
  const configuredEnvironment = mode === "production" ? "production" : "stage";

  if (!configuredSecret && !stageSecret) {
    throw new ApiError(500, "BOX NOW webhook secrets are not configured");
  }
  if (configuredSecret && stageSecret && configuredSecret === stageSecret) {
    throw new ApiError(500, "BOX NOW staging and production secrets must be different");
  }

  const candidates = [
    { environment: configuredEnvironment, secret: configuredSecret },
    { environment: "stage", secret: stageSecret },
  ].filter((candidate) => candidate.secret);

  for (const candidate of candidates) {
    try {
      verifyBoxNowSignature({ rawBody, signature, secret: candidate.secret });
      return candidate.environment;
    } catch (error) {
      if (error?.statusCode !== 401) throw error;
    }
  }

  throw new ApiError(401, "Invalid BOX NOW webhook signature");
}

const BOXNOW_STAGE_COLLECTION = "boxnow_stage_webhook_events";

// Strictly accept 10-digit BOX NOW IDs, including the staging test parcel.
export function isValidBoxNowStageParcelId(value) {
  return /^[0-9]{10}$/.test(String(value || ""));
}

/*
 * Diagnostic-only staging inbox, without customer PII.
 * Staging events never touch the production orders collection.
 */
async function recordBoxNowStageEvent({
  parcelId, orderNumber, event, eventTime, messageId, receivedAt,
}) {
  if (!isValidBoxNowStageParcelId(parcelId)) {
    throw new ApiError(400, "Invalid BOX NOW staging parcel ID");
  }
  const db = getDB();
  const ref = db.collection(BOXNOW_STAGE_COLLECTION).doc(parcelId);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists ? snap.data() : {};
    if (shouldIgnoreBoxNowEvent(current?.lastEventAt, eventTime)) {
      return {
        processed: false, environment: "stage",
        reason: "duplicate_or_old_event", parcelId,
        event: current?.lastEvent || null,
      };
    }
    const history = [
      ...(Array.isArray(current?.history) ? current.history : []),
      { event, eventTime, messageId: messageId || null, receivedAt },
    ].slice(-30);
    tx.set(ref, {
      environment: "stage",
      parcelId,
      orderNumber: orderNumber || null,
      lastEvent: event,
      lastEventAt: eventTime,
      lastWebhookMessageId: messageId || null,
      lastWebhookReceivedAt: receivedAt,
      history,
      updatedAt: receivedAt,
    }, { merge: true });
    return { processed: true, environment: "stage", parcelId, event, eventTime };
  });
}

export async function getBoxNowStageParcel(parcelId) {
  const id = String(parcelId || "").trim();
  if (!isValidBoxNowStageParcelId(id)) throw new ApiError(400, "Invalid BOX NOW parcel ID");
  const snap = await getDB().collection(BOXNOW_STAGE_COLLECTION).doc(id).get();
  return snap.exists ? { id: snap.id, ...snap.data() } : null;
}


/*
 * An authenticated provider event must also belong to THIS paid
 * production shipment. Never complete an order solely because the
 * signed payload claims its orderNumber.
 *
 * The voucher can be referenced by shipping.boxnow.parcelIds,
 * shipping.parcelId, or shipping.trackingNumber (legacy orders).
 */
export function isMatchingBoxNowProductionOrder(order, { orderNumber, parcelId }) {
  if (!order || String(order.delivery || order.shipping?.provider || "")
    .trim().toLowerCase() !== "boxnow") return false;

  if (String(order.paymentStatus || "").trim().toLowerCase() !== "paid") return false;

  const storedEnvironment = String(order.shipping?.boxnow?.environment || "")
    .trim().toLowerCase();
  if (storedEnvironment && storedEnvironment !== "production") return false;

  const expectedOrderNumber = String(order.orderNumber || "").trim();
  const claimedOrderNumber = String(orderNumber || "").trim();
  if (claimedOrderNumber && expectedOrderNumber !== claimedOrderNumber) return false;

  const incomingId = String(parcelId || "").trim();
  if (!incomingId) return false;

  const recordedIds = [
    ...(Array.isArray(order.shipping?.boxnow?.parcelIds) ?
      order.shipping.boxnow.parcelIds : []),
    order.shipping?.parcelId,
    order.shipping?.trackingNumber,
  ].filter(Boolean).map(value => String(value).trim());

  return recordedIds.includes(incomingId);
}

export function isBoxNowDeliveryCompletedEvent(event) {
  return String(event || "").trim().toLowerCase() === "delivered";
}

export function appendBoxNowTrackingEvent(history, details) {
  return [...(Array.isArray(history) ? history : []), details].slice(-30);
}

/* ==================================================
   ORDER LOOKUP
================================================== */

async function findBoxNowOrder(
  tx,
  db,
  {
    orderNumber,
    parcelId,
  }
) {
  /*
   * Best lookup:
   * BOX NOW orderNumber is our own Skanare orderNumber.
   */
  if (orderNumber) {
    const snap =
      await tx.get(
        db
          .collection(
            COLLECTIONS.ORDERS
          )
          .where(
            "orderNumber",
            "==",
            String(orderNumber)
          )
          .limit(1)
      );

    if (!snap.empty) {
      return snap.docs[0];
    }
  }

  /*
   * Fallback lookup by BOX NOW parcel id.
   */
  if (parcelId) {
    const snap =
      await tx.get(
        db
          .collection(
            COLLECTIONS.ORDERS
          )
          .where(
            "shipping.boxnow.parcelIds",
            "array-contains",
            String(parcelId)
          )
          .limit(1)
      );

    if (!snap.empty) {
      return snap.docs[0];
    }
  }

  return null;
}




export async function sendDeliveredOrderEmail(orderId) {
  const db = getDB();
  const ref = db
    .collection(COLLECTIONS.ORDERS)
    .doc(String(orderId));

  const snap = await ref.get();

  if (!snap.exists) return;

  const order = {
    id: snap.id,
    ...snap.data(),
  };

  if (order.emails?.deliveredOrderSentAt) {
    return;
  }

  const customerEmail = String(
    order.customer?.email || ""
  ).trim();

  if (!customerEmail) {
    console.warn("BOX NOW delivered email skipped: customer email missing", {
      orderId: order.id,
    });
    return;
  }

  const firstName = String(
    order.customer?.firstName || ""
  ).trim();

  await sendEmail({
    from:
      process.env.EMAIL_ORDER ||
      process.env.EMAIL_FROM,
    to: customerEmail,
    subject: `Your Skanare order ${order.orderNumber || order.id} was delivered`,
    html: brandedEmailTemplate({
      title: "Your order was delivered",
      intro:
        `Hi ${firstName || "there"}, BOX NOW marked your Skanare order as delivered.`,
      body: `
        <div style="background:#f7f7f7;border-radius:16px;padding:18px;margin:22px 0;color:#111;">
          <p style="margin:0 0 8px;"><strong>Order:</strong> ${order.orderNumber || order.id}</p>
          <p style="margin:0;"><strong>Status:</strong> Delivered</p>
        </div>
        <p style="color:#555;line-height:1.7;margin:0 0 18px;">
          Thank you for choosing Skanare. We hope you enjoy your order.
        </p>
        <p style="color:#555;line-height:1.7;margin:0 0 18px;">
          Leave a verified product review and we will send you a
          <strong>one-time 20% discount code</strong> for your next order.
        </p>
        <p style="margin:22px 0;">
          <a
            href="https://skanare.com/products"
            style="display:inline-block;background:#111;color:#fff;padding:14px 20px;text-decoration:none;border-radius:999px;"
          >
            Leave a review
          </a>
        </p>
        <p style="color:#555;line-height:1.7;margin:0;">
          If something is not right, you can start a return from your account
          or contact us at hello@skanare.com.
        </p>
      `,
    }),
  });

  const sentAt = nowIso();

  await ref.set(
    {
      emails: {
        ...(order.emails || {}),
        deliveredOrderSentAt: sentAt,
        deliveredOrderEmail: customerEmail,
      },
      updatedAt: sentAt,
    },
    { merge: true }
  );

  console.info("BOX NOW delivered email sent", {
    orderId: order.id,
  });
}

export function shouldIgnoreBoxNowEvent(previousEventTime, eventTime) {
  if (!previousEventTime) return false;

  const previousTimestamp = Date.parse(previousEventTime);
  const incomingTimestamp = Date.parse(eventTime);

  return (
    Number.isFinite(previousTimestamp) &&
    Number.isFinite(incomingTimestamp) &&
    incomingTimestamp <= previousTimestamp
  );
}

/* ==================================================
   EVENT PROCESSING
================================================== */

export async function processBoxNowWebhook({
  payload,
  rawBody,
}) {
  if (
    !payload ||
    typeof payload !== "object"
  ) {
    throw new ApiError(
      400,
      "Invalid BOX NOW webhook payload"
    );
  }

  /*
   * BOX NOW guide:
   * datasignature = HMAC SHA256 of exact raw data object.
   */
  const environment = identifyBoxNowWebhookEnvironment({
    rawBody,
    signature: payload.datasignature,
  });


  const data =
    payload.data;

  if (
    !data ||
    typeof data !== "object"
  ) {
    throw new ApiError(
      400,
      "Missing BOX NOW webhook data"
    );
  }


  /*
   * Use data.event, NOT parcelState.
   */
  const event =
    String(
      data.event ||
      ""
    )
      .trim()
      .toLowerCase();


  const parcelId =
    String(
      data.parcelId ||
      ""
    ).trim();


  const orderNumber =
    String(
      data.orderNumber ||
      ""
    ).trim();


  const eventTime =
    String(
      data.time ||
      ""
    ).trim();


  const messageId =
    String(
      payload.id ||
      ""
    ).trim();


  if (!event) {
    throw new ApiError(
      400,
      "Missing BOX NOW webhook event"
    );
  }


  if (
    !parcelId &&
    !orderNumber
  ) {
    throw new ApiError(
      400,
      "Missing BOX NOW parcelId/orderNumber"
    );
  }


  if (!eventTime) {
    throw new ApiError(
      400,
      "Missing BOX NOW webhook data.time"
    );
  }


  const parsedEventTime =
    Date.parse(
      eventTime
    );

  if (
    !Number.isFinite(
      parsedEventTime
    )
  ) {
    throw new ApiError(
      400,
      "Invalid BOX NOW webhook data.time"
    );
  }


  const db =
    getDB();

  const receivedAt =
    nowIso();

  if (environment === "stage") {
    const result = await recordBoxNowStageEvent({
      parcelId, orderNumber, event, eventTime, messageId, receivedAt,
    });
    console.info("BOX NOW staging webhook", result);
    return result;
  }

  const result =
    await db.runTransaction(
      async (tx) => {
        const doc =
          await findBoxNowOrder(
            tx,
            db,
            {
              orderNumber,
              parcelId,
            }
          );


        /*
         * Return 200 even when we do not know the order.
         *
         * Otherwise BOX NOW will keep retrying the same
         * webhook for a parcel we cannot process.
         */
        if (!doc) {
          console.warn(
            "BOX NOW webhook order not found",
            {
              orderNumber,
              parcelId,
              event,
              eventTime,
              messageId,
            }
          );

          return {
            processed:
              false,

            reason:
              "order_not_found",
          };
        }


        const order = {
          id:
            doc.id,

          ...doc.data(),
        };


        if (!isMatchingBoxNowProductionOrder(order, { orderNumber, parcelId })) {
          console.warn("BOX NOW production webhook parcel/order mismatch", {
            orderId: order.id,
            orderNumber,
            parcelId,
            event,
          });
          // A 409 causes BOX NOW to retry if this is a legitimate early event
          // arriving before the voucher was committed to Firestore.
          throw new ApiError(409, "BOX NOW parcel does not match a paid production order");
        }

        const previousEventTime =
          order.shipping
            ?.boxnow
            ?.lastEventAt ||
          null;


        /*
         * BOX NOW recommends data.time for duplicate /
         * invalid update filtering.
         *
         * Ignore same or older event.
         */
        if (
          shouldIgnoreBoxNowEvent(
            previousEventTime,
            eventTime
          )
        ) {
            console.log(
              "BOX NOW duplicate/old webhook ignored",
              {
                orderId:
                  order.id,

                parcelId,

                event,

                eventTime,

                previousEventTime,
              }
            );

            return {
              processed:
                false,

              reason:
                "duplicate_or_old_event",

              orderId:
                order.id,
            };
        }


        /*
         * We keep the actual BOX NOW event as the
         * shipping lifecycle status.
         *
         * Before the first webhook it is:
         *
         * created
         *
         * Then:
         *
         * new
         * in-depot
         * final-destination
         * delivered
         * returned
         * ...
         */
        const patch = {
          "shipping.status":
            event,

          "shipping.updatedAt":
            receivedAt,

          "shipping.boxnow.lastEvent":
            event,

          "shipping.boxnow.lastEventAt":
            eventTime,

          "shipping.boxnow.lastWebhookMessageId":
            messageId ||
            null,

          "shipping.boxnow.lastWebhookReceivedAt":
            receivedAt,

          "shipping.boxnow.lastParcelId":
            parcelId ||
            null,

          "shipping.boxnow.eventHistory": appendBoxNowTrackingEvent(
            order.shipping?.boxnow?.eventHistory,
            { event, eventTime, parcelId, messageId: messageId || null, receivedAt }
          ),

          "shipping.boxnow.parcelState":
            data.parcelState ||
            null,

          "shipping.boxnow.eventLocation":
            data.eventLocation ||
            null,

          "shipping.boxnow.additionalInformation":
            data.additionalInformation ||
            null,

          updatedAt:
            receivedAt,
        };


        /*
         * Keep some useful timestamps.
         */
        if (
          isBoxNowDeliveryCompletedEvent(event)
        ) {
          patch[
            "shipping.deliveredAt"
          ] =
            eventTime;

          patch.fulfillmentStatus =
            "completed";

          patch.completedAt =
            eventTime;

          patch.completionSource =
            "boxnow_webhook";

          patch.history = [
            ...(
              Array.isArray(order.history)
                ? order.history
                : []
            ),
            {
              action:
                "order_completed",
              at:
                eventTime,
              source:
                "boxnow_webhook",
              providerEvent:
                event,
              parcelId:
                parcelId || null,
            },
          ];
        }


        if (
          event ===
          "final-destination"
        ) {
          patch[
            "shipping.readyForPickupAt"
          ] =
            eventTime;
        }


        if (
          event ===
          "returned"
        ) {
          patch[
            "shipping.returnedAt"
          ] =
            eventTime;
        }


        if (
          event ===
          "canceled"
        ) {
          patch[
            "shipping.canceledAt"
          ] =
            eventTime;
        }


        tx.update(
          doc.ref,
          patch
        );


        return {
          processed:
            true,

          orderId:
            order.id,

          orderNumber:
            order.orderNumber,

          parcelId,

          event,

          eventTime,
        };
      }
    );


  if (result?.reason === "order_not_found") {
    const returnResult = await processBoxNowReturnWebhookEvent({
      orderNumber,
      parcelId,
      event,
      eventTime,
      messageId,
      data,
      receivedAt,
    });

    if (returnResult) {
      console.log("BOX NOW return webhook processed", returnResult);
      return returnResult;
    }
  }

  console.log(
    "BOX NOW webhook processed",
    result
  );

  /*
   * Email delivery confirmation outside the Firestore transaction.
   * If sending fails, return an error so BOX NOW retries. On retry,
   * the event update is idempotent and this email is attempted again
   * until deliveredOrderSentAt exists.
   */
  if (
    event === "delivered" &&
    result?.orderId
  ) {
    await sendDeliveredOrderEmail(
      result.orderId
    );
  }

  return result;
}