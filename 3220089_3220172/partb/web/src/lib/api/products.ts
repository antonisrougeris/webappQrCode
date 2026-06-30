// src/lib/api/products.ts

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE || "https://skanare.com/api";

export type GetProductsParams = {
  category?: string;
  featured?: boolean;
  active?: boolean;
  limit?: number;
};

export type Product = {
  id: string;
  slug?: string;
  title: string;
  shortDescription?: string;
  description?: string;
  category?: string;
  price: number;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
};

type ApiResponse = {
  products?: Product[];
  data?: Product[];
};

function normalizeProducts(res: ApiResponse): Product[] {
  const raw = res.products || res.data || [];

  return raw.map((p) => ({
    id: p.id,
    slug: p.slug || p.id,
    title: p.title,
    shortDescription: p.shortDescription,
    description: p.description,
    category: p.category,
    price: p.price,
    image: p.image,
    images: p.images || (p.image ? [p.image] : []),
    stock: p.stock ?? 0,
    featured: Boolean(p.featured),
    active: p.active !== false,
  }));
}

export async function getProducts(
  params?: GetProductsParams
): Promise<Product[]> {
  const query = new URLSearchParams();

  if (params?.category) query.set("category", params.category);
  if (params?.featured !== undefined)
    query.set("featured", String(params.featured));
  if (params?.active !== undefined)
    query.set("active", String(params.active));
  if (params?.limit !== undefined)
    query.set("limit", String(params.limit));

  const res = await fetch(`${API_BASE}/products?${query.toString()}`, {
    cache: "no-store",
  });

  if (!res.ok) return [];

  const data = await res.json();
  return normalizeProducts(data);
}

export async function getProduct(slug: string): Promise<Product | null> {
  const res = await fetch(`${API_BASE}/products/${slug}`, {
    cache: "no-store",
  });

  if (!res.ok) return null;

  const data = await res.json();

  const p = data.product || data;

  if (!p) return null;

  return {
    id: p.id,
    slug: p.slug || p.id,
    title: p.title,
    shortDescription: p.shortDescription,
    description: p.description,
    category: p.category,
    price: p.price,
    image: p.image,
    images: p.images || (p.image ? [p.image] : []),
    stock: p.stock ?? 0,
    featured: Boolean(p.featured),
    active: p.active !== false,
  };
}