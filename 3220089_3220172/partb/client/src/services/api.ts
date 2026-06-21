/* 3220089_3220172  2025 */

import { getToken } from "./auth";

const API_URL = "http://localhost:4000/api"; // Match server PORT=4000

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (!response.ok) {
    // Try to extract an error message from JSON or text
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const error = await response
        .json()
        .catch(() => ({ message: response.statusText }));
      throw new Error(error.message || "API request failed");
    }

    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || response.statusText || "API request failed");
  }

  // 204 No Content (e.g., DELETE /cart/:itemId)
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  // Fallback for endpoints that might return plain text
  return response.text();
}

// ==================== AUTH ====================
export async function register(userData: any) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || "API request failed");
    }

    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || response.statusText || "API request failed");
  }

  return response.json();
}

export async function login(email: string, password: string) {
  return fetchWithAuth(`${API_URL}/auth/login`, {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ==================== USERS ====================
export async function getCurrentUser() {
  return fetchWithAuth(`${API_URL}/users/me`);
}

// ==================== COURSES ====================
export async function getCourses(query?: string) {
  const url = query ? `${API_URL}/courses?${query}` : `${API_URL}/courses`;
  return fetchWithAuth(url);
}

export async function getCourseById(id: string) {
  return fetchWithAuth(`${API_URL}/courses/${id}`);
}

// ==================== BOOKS ====================
export async function getBooks() {
  return fetchWithAuth(`${API_URL}/books`);
}

export async function getBookById(id: string) {
  return fetchWithAuth(`${API_URL}/books/${id}`);
}

// ==================== ENROLLMENTS ====================
export async function enrollInCourse(courseId: string) {
  return fetchWithAuth(`${API_URL}/enrollments`, {
    method: "POST",
    body: JSON.stringify({ courseId }),
  });
}

export async function getMyEnrollments() {
  return fetchWithAuth(`${API_URL}/enrollments/me`);
}

export async function cancelEnrollment(courseId: string) {
  return fetchWithAuth(`${API_URL}/enrollments/${courseId}`, {
    method: "DELETE",
  });
}

// ==================== PURCHASES ====================
export async function getMyPurchases() {
  return fetchWithAuth(`${API_URL}/purchases/my`);
}

// ==================== CART ====================
export async function getCart() {
  return fetchWithAuth(`${API_URL}/cart`);
}

export async function addToCart(itemId: string, type: "course" | "book") {
  return fetchWithAuth(`${API_URL}/cart`, {
    method: "POST",
    body: JSON.stringify({ itemId, itemType: type }),
  });
}

export async function removeFromCart(itemId: string) {
  return fetchWithAuth(`${API_URL}/cart/${itemId}`, {
    method: "DELETE",
  });
}

export async function checkout() {
  return fetchWithAuth(`${API_URL}/checkout`, {
    method: "POST",
  });
}

// ==================== REVIEWS ====================
export async function submitCourseReview(courseId: string, rating: number, comment: string) {
  return fetchWithAuth(`${API_URL}/reviews/courses/${courseId}`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export async function submitBookReview(bookId: string, rating: number, comment: string) {
  return fetchWithAuth(`${API_URL}/reviews/books/${bookId}`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

export async function getCourseReviews(courseId: string) {
  return fetchWithAuth(`${API_URL}/reviews/courses/${courseId}`);
}