/* 3220089_3220172 */

import { apiFetch } from "./api";

export interface ProductVariant {
  size?: string;
  color?: string;
  stock?: number;
  sku?: string;
}

export interface ProductReview {
  name: string;
  rating: number;
  comment: string;
}

export interface Product {
  _id?: string;
  id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  description?: string;
  category: string;
  price: number;
  priceEUR?: number;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
  badge?: string;
  customQr?: boolean;
  createdAt?: string;
  updatedAt?: string;
  variants?: ProductVariant[];
  reviews?: ProductReview[];
}

export interface GetProductsOptions {
  category?: string;
  featured?: boolean;
  active?: boolean;
  limit?: number;
}

interface ProductsResponse {
  success?: boolean;
  products?: any[];
  data?: any[];
  items?: any[];
}

interface ProductResponse {
  success?: boolean;
  product?: any;
  data?: any;
}

function normalizeProduct(raw: any): Product {
  const price =
    typeof raw?.price === "number"
      ? raw.price
      : typeof raw?.priceEUR === "number"
      ? raw.priceEUR
      : 0;

  const images = Array.isArray(raw?.images)
    ? raw.images
    : raw?.image
    ? [raw.image]
    : [];

  return {
    _id: raw?._id,
    id: raw?.id || raw?._id || "",
    slug: raw?.slug || raw?.id || raw?._id || "",
    title: raw?.title || "",
    shortDescription: raw?.shortDescription || "",
    description: raw?.description || "",
    category: raw?.category || "",
    price,
    priceEUR: typeof raw?.priceEUR === "number" ? raw.priceEUR : price,
    image: raw?.image || images[0] || "",
    images,
    stock: typeof raw?.stock === "number" ? raw.stock : 0,
    featured: raw?.featured !== false,
    active: raw?.active !== false,
    badge: raw?.badge || "",
    customQr: Boolean(raw?.customQr),
    createdAt: raw?.createdAt || "",
    updatedAt: raw?.updatedAt || "",
    variants: Array.isArray(raw?.variants) ? raw.variants : [],
    reviews: Array.isArray(raw?.reviews) ? raw.reviews : [],
  };
}

function extractProducts(payload: ProductsResponse | Product[]): Product[] {
  if (Array.isArray(payload)) {
    return payload.map(normalizeProduct);
  }

  if (payload?.products && Array.isArray(payload.products)) {
    return payload.products.map(normalizeProduct);
  }

  if (payload?.data && Array.isArray(payload.data)) {
    return payload.data.map(normalizeProduct);
  }

  if (payload?.items && Array.isArray(payload.items)) {
    return payload.items.map(normalizeProduct);
  }

  return [];
}

export async function getProducts(
  options: GetProductsOptions = {}
): Promise<Product[]> {
  const params = new URLSearchParams();

  if (options.category) params.set("category", options.category);
  if (typeof options.featured === "boolean") {
    params.set("featured", String(options.featured));
  }
  if (typeof options.active === "boolean") {
    params.set("active", String(options.active));
  }
  if (typeof options.limit === "number") {
    params.set("limit", String(options.limit));
  }

  const query = params.toString();
  const payload = await apiFetch<ProductsResponse>(
    `/products${query ? `?${query}` : ""}`
  );

  let products = extractProducts(payload);

  if (typeof options.active === "boolean") {
    products = products.filter((product) =>
      options.active ? product.active !== false : product.active === false
    );
  }

  if (typeof options.featured === "boolean") {
    products = products.filter((product) =>
      options.featured ? product.featured === true : product.featured !== true
    );
  }

  if (options.category) {
    products = products.filter(
      (product) =>
        product.category?.toLowerCase() === options.category!.toLowerCase()
    );
  }

  if (typeof options.limit === "number") {
    products = products.slice(0, options.limit);
  }

  return products;
}
export async function getFeaturedProducts(): Promise<Product[]> {
  return getProducts({ featured: true, active: true });
}

export async function getProductsByCategory(
  category: string
): Promise<Product[]> {
  return getProducts({ category, active: true });
}

export async function getProductById(
  idOrSlug: string
): Promise<Product | null> {
  const payload = await apiFetch<ProductResponse>(
    `/products/${encodeURIComponent(idOrSlug)}`
  );

  const raw = payload?.product || payload?.data || payload;

  if (!raw || typeof raw !== "object") {
    return null;
  }

  return normalizeProduct(raw);
}
