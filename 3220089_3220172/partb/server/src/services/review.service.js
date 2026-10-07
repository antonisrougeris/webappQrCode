import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { createId, nowIso } from "../utils/ids.js";
import { getProductByIdOrSlug } from "./product.service.js";
import { recoveryOfferRef } from "./recovery-offer.service.js";
import { sendEmail } from "./email.service.js";
import { brandedEmailTemplate } from "./email-template.service.js";

function orderContainsDeliveredProduct(order, productId) {
  const completed =
    String(order.fulfillmentStatus || "").toLowerCase() === "completed" ||
    String(order.shipping?.status || "").toLowerCase() === "delivered";

  return (
    order.paymentStatus === "paid" &&
    completed &&
    Array.isArray(order.items) &&
    order.items.some(
      (item) =>
        String(item.productId || item.id) ===
        String(productId)
    )
  );
}

export async function getReviewsForProduct(productId) {
  if (!productId) throw new ApiError(400, "Missing product id");

  const db = getDB();
  const product = await getProductByIdOrSlug(productId);
  const snapshot = await db
    .collection(COLLECTIONS.REVIEWS)
    .where("productId", "==", String(product.id))
    .get();

  const storedReviews = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
  const productReviews = Array.isArray(product.reviews) ? product.reviews : [];
  const merged = [...productReviews, ...storedReviews];
  const seen = new Set();

  return merged
    .filter((review) => {
      const key = review.id || `${review.name}|${review.rating}|${review.comment}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

export async function createVerifiedReview(userId, productId, input) {
  if (!userId) throw new ApiError(401, "You must be signed in to review");
  if (!productId) throw new ApiError(400, "Missing product id");

  const db = getDB();
  const product = await getProductByIdOrSlug(productId);
  const ordersSnapshot = await db
    .collection(COLLECTIONS.ORDERS)
    .where("ownerId", "==", userId)
    .where("ownerType", "==", "user")
    .get();

  const completedOrderDoc = ordersSnapshot.docs.find((doc) =>
    orderContainsDeliveredProduct(
      doc.data(),
      product.id
    )
  );

  if (!completedOrderDoc) {
    throw new ApiError(403, "You can review products only after a completed purchase.");
  }

  const existing = await db
    .collection(COLLECTIONS.REVIEWS)
    .where("productId", "==", String(product.id))
    .get();

  if (existing.docs.some((doc) => doc.data().userId === userId)) {
    throw new ApiError(409, "You have already reviewed this product.");
  }

  const completedOrder = {
    id: completedOrderDoc.id,
    ...completedOrderDoc.data(),
  };

  const review = {
    id: createId("review"),
    productId: String(product.id),
    userId,
    name: input.name,
    rating: input.rating,
    comment: input.comment,
    verifiedPurchase: true,
    orderId: completedOrder.id,
    createdAt: nowIso(),
  };

  const customerEmail =
    String(completedOrder.customer?.email || "")
      .trim()
      .toLowerCase();

  if (!customerEmail) {
    throw new ApiError(
      400,
      "Customer email is missing for the review reward"
    );
  }

  const rewardCode =
    `REVIEW20-${completedOrder.id
      .replace(/[^a-zA-Z0-9]/g, "")
      .slice(-8)
      .toUpperCase()}`;

  const rewardCreatedAt = nowIso();
  const rewardExpiresAt =
    new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

  const reward = {
    code: rewardCode,
    email: customerEmail,
    discountPercent: 20,
    status: "active",
    source: "review",
    maxUses: 1,
    minOrderAmount: 0,
    reviewId: review.id,
    orderId: completedOrder.id,
    userId,
    createdAt: rewardCreatedAt,
    updatedAt: rewardCreatedAt,
    expiresAt: rewardExpiresAt,
    reservedOrderId: null,
    usedAt: null,
  };

  const rewardRef =
    recoveryOfferRef(reward.code, db);
  const existingRewardSnap =
    await rewardRef.get();
  const rewardCreated =
    !existingRewardSnap.exists;

  const productRef = db.collection(COLLECTIONS.PRODUCTS).doc(product.id);
  await db.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) {
      throw new ApiError(404, "Product not found");
    }

    const currentReviews = Array.isArray(productSnapshot.data().reviews)
      ? productSnapshot.data().reviews
      : [];

    transaction.set(
      db.collection(COLLECTIONS.REVIEWS).doc(review.id),
      review
    );

    if (rewardCreated) {
      transaction.set(
        rewardRef,
        reward
      );
    }

    transaction.update(productRef, {
      reviews: [...currentReviews, review],
    });
  });

  if (rewardCreated) {
    try {
      await sendEmail({
      from:
        process.env.EMAIL_ORDER ||
        process.env.EMAIL_FROM,
      to: customerEmail,
      subject: "Thank you for your review — here is 20% off",
      html: brandedEmailTemplate({
        title: "Thanks for your review",
        intro:
          "Your verified review is live. Here is your 20% thank-you discount for your next Skanare order.",
        body: `
          <div style="background:#f7f7f7;border-radius:16px;padding:18px;margin:22px 0;text-align:center;">
            <div style="font-size:12px;letter-spacing:1.5px;color:#777;">YOUR CODE</div>
            <div style="font-size:24px;font-weight:800;letter-spacing:2px;margin-top:8px;">${reward.code}</div>
            <p style="color:#555;margin:10px 0 0;">20% off · one use · valid for 30 days</p>
          </div>
        `,
      }),
      });
    } catch (error) {
      console.error("Review reward email failed", {
        reviewId: review.id,
        userId,
        message: error?.message || String(error),
      });
    }
  }

  return {
    review,
    reward: rewardCreated
      ? {
          code: reward.code,
          discountPercent: reward.discountPercent,
          expiresAt: reward.expiresAt,
        }
      : null,
  };
}