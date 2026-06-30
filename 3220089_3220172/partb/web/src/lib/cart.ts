const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://skanare.com/api";

export interface CartItem {
  id: string;
  productId: string;
  title: string;
  slug?: string;
  price: number;
  priceEUR?: number;
  quantity: number;
  image?: string;
  variant?: {
    sku?: string;
    size?: string;
    color?: string;
    stock?: number;
  } | null;
  selectedVariant?: {
    sku?: string;
    size?: string;
    color?: string;
    stock?: number;
  } | null;
  qrDestination?: string;
}

export interface Cart {
  id?: string;
  userId?: string;
  items: CartItem[];
  subtotal?: number;
  totalItems?: number;
  currency?: string;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(payload?.message || `Request failed (${res.status})`);
  }

  return payload as T;
}

export async function getCart(): Promise<Cart> {
  const res = await apiRequest<{ cart: Cart }>("/cart");
  return res.cart;
}

export async function updateCartItem(
  itemId: string,
  payload: { quantity?: number; qrDestination?: string }
): Promise<Cart> {
  const res = await apiRequest<{ cart: Cart }>(
    `/cart/items/${encodeURIComponent(itemId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(payload),
    }
  );

  return res.cart;
}

export async function removeCartItem(itemId: string): Promise<Cart> {
  const res = await apiRequest<{ cart: Cart }>(
    `/cart/items/${encodeURIComponent(itemId)}`,
    {
      method: "DELETE",
    }
  );

  return res.cart;
}