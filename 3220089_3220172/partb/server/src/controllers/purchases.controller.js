/* 3220089_3220172  2025 */

import { getDB } from "../config/db.js";

function purchaseId(userId, bookId) {
  return `purchase_${userId}_${bookId}`;
}

export async function purchaseBook(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const { bookId } = req.body || {};

    const bookSnapshot = await db.collection("books").doc(String(bookId)).get();
    if (!bookSnapshot.exists) return res.status(404).json({ error: true, message: "Book not found" });

    const id = purchaseId(userId, String(bookId));
    const ref = db.collection("purchases").doc(id);
    const existing = await ref.get();
    if (existing.exists) return res.status(400).json({ error: true, message: "Already purchased" });

    await ref.set({ userId, bookId: String(bookId), createdAt: new Date().toISOString() });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

export async function listMyPurchases(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");

    const snapshot = await db.collection("purchases").where("userId", "==", userId).get();
    const purchases = snapshot.docs.map((doc) => ({ _id: doc.id, id: doc.id, ...doc.data() }));
    purchases.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    res.json(purchases);
  } catch (err) {
    next(err);
  }
}

export async function deletePurchase(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const pId = String(req.params.id || "");

    const ref = db.collection("purchases").doc(pId);
    const purchase = await ref.get();
    if (!purchase.exists) return res.status(404).json({ error: true, message: "Purchase not found" });
    if (String(purchase.data().userId) !== userId) return res.status(403).json({ error: true, message: "Forbidden" });

    await ref.delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
