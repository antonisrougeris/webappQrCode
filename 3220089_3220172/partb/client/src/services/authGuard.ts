/* 3220089_3220172  2025 */

import { isLoggedIn } from "./auth";

/**
 * If the user is not logged in, redirect to the login page.
 */
export function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = "/src/pages/login/login.html";
  }
}
