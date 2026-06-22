const API_BASE_URL = import.meta.env.VITE_API_URL || "https://cldrq5-4000.csb.app/api";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("token");

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Request failed");
  }

  return data as T;
}

export interface ProductVariant {
  size?: string;
  color?: string;
  stock?: number;
  sku?: string;
}

export interface Product {
  _id: string;
  id: string;
  title: string;
  slug?: string;
  shortDescription: string;
  description: string;
  category: "tshirt" | "accessory";
  priceEUR: number;
  images: string[];
  image?: string;
  variants?: ProductVariant[];
  stock?: number;
  active: boolean;
  featured?: boolean;
  badge?: string;
  customQr?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export async function getProducts(params: { q?: string; category?: string; featured?: boolean; limit?: number } = {}) {
  const search = new URLSearchParams();

  if (params.q) search.set("q", params.q);
  if (params.category && params.category !== "All") search.set("category", params.category);
  if (typeof params.featured === "boolean") search.set("featured", String(params.featured));
  if (params.limit) search.set("limit", String(params.limit));

  const query = search.toString();
  return request<Product[]>(`/products${query ? `?${query}` : ""}`);
}

export async function getProductById(id: string) {
  return request<Product>(`/products/${encodeURIComponent(id)}`);
}

export async function addProductToCart(productId: string, payload: { quantity?: number; variant?: ProductVariant; qrDestination?: string } = {}) {
  return request(`/cart`, {
    method: "POST",
    body: JSON.stringify({
      productId,
      type: "product",
      quantity: payload.quantity ?? 1,
      variant: payload.variant ?? null,
      qrDestination: payload.qrDestination ?? "",
    }),
  });
}
