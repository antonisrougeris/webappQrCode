/* 3220089_3220172  2025 */

import { getDB, toPlainDocs } from "../config/db.js";

function cartDocId(userId, itemType, itemId) {
  return `${userId}_${itemType}_${itemId}`;
}

export async function listCart(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const snapshot = await db.collection("carts").where("userId", "==", userId).get();
    const items = toPlainDocs(snapshot).sort((a, b) => String(b.addedAt || "").localeCompare(String(a.addedAt || "")));
    res.json(items);
  } catch (err) {
    next(err);
  }
}

export async function addToCart(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const { itemType, itemId } = req.body || {};

    if (!userId) {
      return res.status(401).json({ error: true, message: "Unauthorized" });
    }

    if (!["book", "course"].includes(itemType)) {
      return res.status(400).json({ error: true, message: "Invalid item type" });
    }

    const collection = itemType === "book" ? "books" : "courses";
    const itemSnapshot = await db.collection(collection).doc(String(itemId)).get();
    if (!itemSnapshot.exists) {
      return res.status(404).json({ error: true, message: `${itemType} not found` });
    }

    const existing = await db.collection("carts").doc(cartDocId(userId, itemType, String(itemId))).get();
    if (existing.exists) {
      return res.status(400).json({ error: true, message: "Already in cart" });
    }

    await db.collection("carts").doc(cartDocId(userId, itemType, String(itemId))).set({
      userId,
      itemType,
      itemId: String(itemId),
      addedAt: new Date().toISOString(),
    });

    res.status(201).json({ id: cartDocId(userId, itemType, String(itemId)) });
  } catch (err) {
    next(err);
  }
}

export async function removeFromCart(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const itemId = String(req.params.itemId || "");

    const snapshot = await db.collection("carts").where("userId", "==", userId).where("itemId", "==", itemId).limit(1).get();
    if (snapshot.empty) {
      return res.status(404).json({ error: true, message: "Item not found in cart" });
    }

    await snapshot.docs[0].ref.delete();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
