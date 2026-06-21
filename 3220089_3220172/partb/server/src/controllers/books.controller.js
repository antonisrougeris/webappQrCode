/* 3220089_3220172  2025 */

import { getDB, toPlainDocs } from "../config/db.js";

export async function listBooks(req, res, next) {
  try {
    const db = getDB();
    const snapshot = await db.collection("books").get();
    const books = toPlainDocs(snapshot).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    res.json(books);
  } catch (err) {
    next(err);
  }
}

export async function getBookById(req, res, next) {
  try {
    const db = getDB();
    const snapshot = await db.collection("books").doc(String(req.params.id)).get();

    if (!snapshot.exists) {
      return res.status(404).json({ error: true, message: "Book not found" });
    }

    res.json({ _id: snapshot.id, id: snapshot.id, ...snapshot.data() });
  } catch (err) {
    next(err);
  }
}
