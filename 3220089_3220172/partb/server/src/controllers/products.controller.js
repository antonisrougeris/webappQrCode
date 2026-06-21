import { getDB, toPlainDocs } from "../config/db.js";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function toBool(value) {
  return value === true || value === "true";
}

export async function listProducts(req, res, next) {
  try {
    const db = getDB();
    const { category, q, featured, limit } = req.query;

    const snapshot = await db.collection("products").get();

    let products = toPlainDocs(snapshot)
      .map((product) => ({
        _id: product._id || product.id,
        id: product.id || product._id,
        ...product,
      }))
      .filter((product) => product.active !== false)
      .filter((product) => !category || category === "All" || product.category === category)
      .filter((product) => featured === undefined || Boolean(product.featured) === toBool(featured))
      .filter((product) => {
        if (!q || !String(q).trim()) return true;
        const query = normalize(q);
        return (
          normalize(product.title).includes(query) ||
          normalize(product.shortDescription).includes(query) ||
          normalize(product.description).includes(query) ||
          normalize(product.category).includes(query)
        );
      })
      .sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    const parsedLimit = Number(limit);
    if (Number.isFinite(parsedLimit) && parsedLimit > 0) {
      products = products.slice(0, parsedLimit);
    }

    res.json(products);
  } catch (err) {
    next(err);
  }
}

export async function getProductById(req, res, next) {
  try {
    const db = getDB();
    const id = String(req.params.id);

    let snapshot = await db.collection("products").doc(id).get();

    if (!snapshot.exists) {
      const bySlug = await db.collection("products").where("slug", "==", id).limit(1).get();
      if (!bySlug.empty) {
        snapshot = bySlug.docs[0];
      }
    }

    if (!snapshot.exists) {
      return res.status(404).json({ error: true, message: "Product not found" });
    }

    const data = snapshot.data();

    if (data.active === false) {
      return res.status(404).json({ error: true, message: "Product not found" });
    }

    res.json({ _id: snapshot.id, id: snapshot.id, ...data });
  } catch (err) {
    next(err);
  }
}
