//* 3220089_3220172  2025 */

import { signInWithEmailAndPassword } from "firebase/auth";
import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";

const form = document.getElementById("loginForm") as HTMLFormElement;
const statusEl = document.getElementById("status");

// Only run login-specific code if we're on the login page
if (form) {
  // Initialize navigation and mobile menu (login.html loads this file directly)
  initNav();
  initMobileMenu();
  updateCartBadge();

  form.addEventListener("submit", async (e) => {
  e.preventDefault();
  statusEl!.textContent = "Logging in...";

  const formData = new FormData(form);
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  try {
    const credentials = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const token = await credentials.user.getIdToken();
    saveToken(token);
    statusEl!.textContent = "Login successful! Redirecting...";
    setTimeout(() => {
      window.location.href = "/index.html";
    }, 1500);
  } catch (err: any) {
    console.error("Login error:", err);
    statusEl!.textContent = err.message || "Login failed";
  }
  });
}
