/* 3220089_3220172 */

import { getToken } from "./auth";

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://cldrq5-4000.csb.app/api";

/**
 * Generic API envelope
 */
export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  message?: string;
  error?: string;
}

/**
 * Guest cart support
 */
function getGuestId(): string {
  let guestId = localStorage.getItem("guestId");

  if (!guestId) {
    guestId = crypto.randomUUID();
    localStorage.setItem("guestId", guestId);
  }

  return guestId;
}

/**
 * Build request headers
 * - If logged in => Authorization Bearer token
 * - If guest => x-guest-id for cart/session support
 */
function buildHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init || {});

  // default JSON unless caller overrides it
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const token = getToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else {
    headers.set("x-guest-id", getGuestId());
  }

  return headers;
}

/**
 * Main API request helper
 */
export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  if (response.status === 204) {
    return null as T;
  }

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");

  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      `Request failed (${response.status})`;

    throw new Error(message);
  }

  return payload as T;
}

export const apiFetch = apiRequest;

/* =========================================================
   AUTH TYPES
========================================================= */

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

export interface AuthUser {
  id?: string;
  uid?: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  success?: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
  data?: AuthUser;
}

/* =========================================================
   AUTH API
========================================================= */

/**
 * Register / sync user with backend after Firebase signup
 *
 * Expected backend route:
 * POST /api/auth/register
 */
export async function register(
  payload: RegisterPayload
): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Login / sync user with backend after Firebase login
 *
 * Expected backend route:
 * POST /api/auth/login
 */
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Optional helper:
 * fetch current authenticated user from backend
 *
 * Expected backend route:
 * GET /api/auth/me
 */
export async function getMe(): Promise<AuthUser | null> {
  const response = await apiRequest<
    | AuthUser
    | {
        success?: boolean;
        user?: AuthUser;
        data?: AuthUser;
      }
  >("/auth/me");

  if (!response) return null;

  if ("email" in response) {
    return response as AuthUser;
  }

  return response.user || response.data || null;
}
