import { readFile } from "fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { nowIso } from "../utils/ids.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function normalizeProductId(product) {
  return String(product.id || product.slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const seedProducts = asyncHandler(async (req, res) => {
  const db = getDB();
  const productsPath = join(__dirname, "../../products.json");
  const raw = await readFile(productsPath, "utf-8");
  const products = JSON.parse(raw);

  const batch = db.batch();
  let count = 0;

  for (const product of products) {
    const id = normalizeProductId(product);
    if (!id) continue;

    batch.set(
      db.collection(COLLECTIONS.PRODUCTS).doc(id),
      {
        id,
        slug: product.slug || id,
        title: product.title || "",
        shortDescription: product.shortDescription || "",
        description: product.description || "",
        category: product.category || "General",
        price: Number(product.price || 0),
        currency: product.currency || "EUR",
        active: product.active ?? true,
        featured: product.featured ?? false,
        customQr: product.customQr ?? false,
        images: Array.isArray(product.images)
          ? product.images
          : product.image
          ? [product.image]
          : [],
        stock: Number(product.stock || 0),
        variants: Array.isArray(product.variants) ? product.variants : [],
        createdAt: product.createdAt || nowIso(),
        updatedAt: nowIso(),
      },
      { merge: true }
    );

    count += 1;
  }

  await batch.commit();

  return ok(res, {
    message: `Seeded ${count} products`,
    count,
  });
});
