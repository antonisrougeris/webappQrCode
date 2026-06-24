import { getDB, toPlainDoc, toPlainDocs } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { normalizeText, variantMatches } from "../utils/product.js";

export async function listProductsService({ category, q, featured, limit }) {
  const db = getDB();
  const snapshot = await db.collection(COLLECTIONS.PRODUCTS).get();

  let products = toPlainDocs(snapshot).filter((p) => p.active !== false);

  if (category && category !== "All") {
    products = products.filter((p) => p.category === category);
  }

  if (featured !== undefined) {
    const boolFeatured = featured === true || featured === "true";
    products = products.filter((p) => Boolean(p.featured) === boolFeatured);
  }

  if (q) {
    const query = normalizeText(q);
    products = products.filter((p) => {
      return [
        p.title,
        p.shortDescription,
        p.description,
        p.category,
        p.slug,
      ].some((field) => normalizeText(field).includes(query));
    });
  }

  products.sort((a, b) =>
    String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
  );

  const parsedLimit = Number(limit);
  if (Number.isInteger(parsedLimit) && parsedLimit > 0) {
    products = products.slice(0, parsedLimit);
  }

  return products;
}

export async function getProductByIdOrSlug(idOrSlug) {
  const db = getDB();

  const byId = await db
    .collection(COLLECTIONS.PRODUCTS)
    .doc(String(idOrSlug))
    .get();
  if (byId.exists) {
    const product = toPlainDoc(byId);
    if (product.active === false) throw new ApiError(404, "Product not found");
    return product;
  }

  const bySlug = await db
    .collection(COLLECTIONS.PRODUCTS)
    .where("slug", "==", String(idOrSlug))
    .limit(1)
    .get();

  if (bySlug.empty) {
    throw new ApiError(404, "Product not found");
  }

  const product = { id: bySlug.docs[0].id, ...bySlug.docs[0].data() };
  if (product.active === false) throw new ApiError(404, "Product not found");

  return product;
}

export function resolveVariantOrThrow(product, selectedVariant) {
  const variants = Array.isArray(product.variants) ? product.variants : [];

  if (!variants.length) {
    return null;
  }

  const found = variants.find((variant) =>
    variantMatches(variant, selectedVariant)
  );

  if (!found) {
    throw new ApiError(400, "Selected variant does not exist for this product");
  }

  return found;
}

export function assertStockForVariant(product, resolvedVariant, quantity) {
  if (resolvedVariant) {
    const stock = Number(resolvedVariant.stock || 0);
    if (stock < quantity) {
      throw new ApiError(400, "Not enough stock for selected variant");
    }
    return;
  }

  const stock = Number(product.stock || 0);
  if (stock < quantity) {
    throw new ApiError(400, "Not enough stock");
  }
}
