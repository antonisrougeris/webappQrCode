/* 3220089_3220172  2025 */

import { getDB } from "../config/db.js";

function compositeId(prefix, userId, itemId) {
  return `${prefix}_${userId}_${itemId}`;
}

export async function checkoutCart(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");

    if (!userId) {
      return res.status(401).json({ error: true, message: "Unauthorized" });
    }

    const cartSnapshot = await db.collection("carts").where("userId", "==", userId).get();
    const cartItems = cartSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (cartItems.length === 0) {
      return res.status(400).json({ error: true, message: "Cart is empty" });
    }

    let purchasedBooks = 0;
    let enrolledCourses = 0;

    for (const item of cartItems) {
      const collectionName = item.itemType === "book" ? "books" : "courses";
      const itemSnapshot = await db.collection(collectionName).doc(String(item.itemId)).get();
      if (!itemSnapshot.exists) continue;

      if (item.itemType === "book") {
        const purchaseId = compositeId("purchase", userId, String(item.itemId));
        const purchaseRef = db.collection("purchases").doc(purchaseId);
        const purchaseSnapshot = await purchaseRef.get();
        if (!purchaseSnapshot.exists) {
          await purchaseRef.set({ userId, bookId: String(item.itemId), createdAt: new Date().toISOString() });
          purchasedBooks++;
        }
      }

      if (item.itemType === "course") {
        const enrollmentId = compositeId("enrollment", userId, String(item.itemId));
        const enrollmentRef = db.collection("enrollments").doc(enrollmentId);
        const enrollmentSnapshot = await enrollmentRef.get();
        if (!enrollmentSnapshot.exists) {
          await enrollmentRef.set({ userId, courseId: String(item.itemId), createdAt: new Date().toISOString() });
          enrolledCourses++;
        }
      }

      await db.collection("carts").doc(item.id).delete();
    }

    res.json({
      purchasedBooks,
      enrolledCourses,
      removedFromCart: cartItems.length,
    });
  } catch (err) {
    next(err);
  }
}
