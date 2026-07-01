import { firebaseAuth } from "@/lib/firebase";
import { getToken, saveToken } from "@/lib/auth";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://skanare.com/api";

async function buildHeaders(init?: HeadersInit): Promise<Headers> {
  const headers = new Headers(init || {});

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const user = firebaseAuth.currentUser;

  if (user) {
    const token = await user.getIdToken();
    saveToken(token);
    headers.set("Authorization", `Bearer ${token}`);
    return headers;
  }

  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return headers;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: await buildHeaders(options.headers),
  });

  if (res.status === 204) return null as T;

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    console.error("API request failed:", {
      path,
      status: res.status,
      payload,
    });

    throw new Error(
      payload?.message ||
        payload?.error ||
        payload?.details?.message ||
        `Request failed (${res.status})`
    );
  }

  return payload as T;
}

export interface RegisterPayload {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  idToken: string;
}

export interface LoginPayload {
  email: string;
  idToken: string;
}

export async function register(payload: RegisterPayload) {
  return apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function login(payload: LoginPayload) {
  return apiRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function sendVerificationCode() {
  return apiRequest("/auth/send-verification", {
    method: "POST",
  });
}

export interface AuthUser {
  id?: string;
  uid?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
}

export async function getMe(): Promise<AuthUser | null> {
  const res = await apiRequest<
    | AuthUser
    | {
        user?: AuthUser;
        data?: AuthUser;
      }
  >("/auth/me");

  if (!res) return null;

  if ("email" in res) return res;

  return res.user || res.data || null;
}

export async function verifyEmailCode(otp: string) {
  return apiRequest("/auth/verify-email", {
    method: "POST",
    body: JSON.stringify({ otp }),
  });
}

export async function mergeGuestCart() {
  return apiRequest("/cart/merge-guest", {
    method: "POST",
  });
}

export interface Order {
  id: string;
  orderNumber?: string;
  total?: number;
  currency?: string;
  paymentStatus?: string;
  status?: string;
  qrCodesCreated?: number;
  createdAt?: string;
  payment?: {
    paidAt?: string;
    transactionId?: string;
  };
}

export async function getOrderById(orderId: string): Promise<Order> {
  const res = await apiRequest<{ order: Order }>(
    `/orders/${encodeURIComponent(orderId)}`
  );

  return res.order;
}

export async function getOrderByVivaCode(
  vivaOrderCode: string
): Promise<Order> {
  const res = await apiRequest<{ order: Order }>(
    `/orders/viva/${encodeURIComponent(vivaOrderCode)}`
  );

  return res.order;
}
