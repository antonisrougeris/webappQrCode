/* 3220089_3220172  2025 */

import { getDB } from "../config/db.js";

function toReviewDoc(snapshot) {
  return snapshot.docs.map((doc) => ({ _id: doc.id, id: doc.id, ...doc.data() }));
}

export async function createReview(req, res, next) {
  try {
    const db = getDB();
    const courseId = String(req.params.id || "");
    const userId = String(req.user?.sub || "");
    const { rating, text } = req.body || {};

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: true, message: "Rating must be between 1 and 5" });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: true, message: "Review text is required" });
    }

    const course = await db.collection("courses").doc(courseId).get();
    if (!course.exists) {
      return res.status(404).json({ error: true, message: "Course not found" });
    }

    const ref = db.collection("reviews").doc();
    await ref.set({
      courseId,
      userId,
      itemType: "course",
      rating,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id });
  } catch (err) {
    next(err);
  }
}

/**
 * LIST COURSE REVIEWS
 * GET /api/courses/:id/reviews
 */
export async function listCourseReviews(req, res, next) {
  try {
    const db = getDB();
    const courseId = String(req.params.id || "");
    const snapshot = await db.collection("reviews").where("courseId", "==", courseId).get();
    const reviews = toReviewDoc(snapshot).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

/**
 * GET COURSE REVIEW STATISTICS
 * GET /api/courses/:id/stats
 */
export async function getReviewStats(req, res, next) {
  try {
    const db = getDB();
    const courseId = String(req.params.id || "");
    const snapshot = await db.collection("reviews").where("courseId", "==", courseId).get();
    const reviews = toReviewDoc(snapshot);

    if (reviews.length === 0) return res.json({ count: 0, averageRating: null });

    const averageRating = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length;
    res.json({ count: reviews.length, averageRating: Math.round(averageRating * 10) / 10 });
  } catch (err) {
    next(err);
  }
}


// BOOK REVIEWS

/**
 * CREATE BOOK REVIEW
 * POST /api/books/:id/reviews
 */
export async function createBookReview(req, res, next) {
  try {
    const db = getDB();
    const bookId = String(req.params.id || "");
    const userId = String(req.user?.sub || "");
    const { rating, text } = req.body || {};

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: true, message: "Rating must be 1-5" });
    }

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: true, message: "Review text is required" });
    }

    const book = await db.collection("books").doc(bookId).get();
    if (!book.exists) {
      return res.status(404).json({ error: true, message: "Book not found" });
    }

    const ref = db.collection("reviews").doc();
    await ref.set({
      bookId,
      userId,
      itemType: "book",
      rating,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ id: ref.id });
  } catch (err) {
    next(err);
  }
}

/**
 * LIST BOOK REVIEWS
 * GET /api/books/:id/reviews
 */
export async function listBookReviews(req, res, next) {
  try {
    const db = getDB();
    const bookId = String(req.params.id || "");
    const snapshot = await db.collection("reviews").where("bookId", "==", bookId).get();
    const reviews = toReviewDoc(snapshot).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

/**
 * GET BOOK REVIEW STATISTICS
 * GET /api/books/:id/reviews/stats
 */
export async function getBookReviewStats(req, res, next) {
  try {
    const db = getDB();
    const bookId = String(req.params.id || "");
    const snapshot = await db.collection("reviews").where("bookId", "==", bookId).get();
    const reviews = toReviewDoc(snapshot);

    if (reviews.length === 0) return res.json({ count: 0, averageRating: null });

    const averageRating = reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length;
    res.json({ count: reviews.length, averageRating: Math.round(averageRating * 10) / 10 });
  } catch (err) {
    next(err);
  }
}


// SHARED UTILITIES (Ownership Based)

/**
 * UPDATE REVIEW (Common for both Books and Courses)
 * PATCH /api/reviews/:id
 */
export async function updateReview(req, res, next) {
  try {
    const db = getDB();
    const reviewId = String(req.params.id || "");
    const userId = String(req.user?.sub || "");
    const { rating, text } = req.body || {};

    const ref = db.collection("reviews").doc(reviewId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: true, message: "Review not found" });

    if (String(snapshot.data().userId) !== userId) {
      return res.status(403).json({ error: true, message: "Forbidden: You don't own this review" });
    }

    const update = {
      ...(rating ? { rating } : {}),
      ...(text ? { text: text.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };

    await ref.update(update);
    res.json({ success: true, message: "Review updated" });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE REVIEW (Common for both Books and Courses)
 * DELETE /api/reviews/:id
 */
export async function deleteReview(req, res, next) {
  try {
    const db = getDB();
    const reviewId = String(req.params.id || "");
    const userId = String(req.user?.sub || "");

    const ref = db.collection("reviews").doc(reviewId);
    const snapshot = await ref.get();
    if (!snapshot.exists) return res.status(404).json({ error: true, message: "Review not found" });

    if (String(snapshot.data().userId) !== userId) {
      return res.status(403).json({ error: true, message: "Forbidden" });
    }

    await ref.delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}