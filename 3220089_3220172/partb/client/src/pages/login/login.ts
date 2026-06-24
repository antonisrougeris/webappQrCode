/* 3220089_3220172 2025 */

import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";
import { login, register } from "../../services/api";

const form = document.getElementById("loginForm") as HTMLFormElement | null;
const statusEl = document.getElementById("status");
const googleBtn = document.querySelector(".auth-google");

if (form) {
  initNav();
  initMobileMenu();
  void updateCartBadge();

  // EMAIL / PASSWORD LOGIN
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (statusEl) statusEl.textContent = "Logging in...";

    const formData = new FormData(form);
    const email = String(formData.get("email") || "");
    const password = String(formData.get("password") || "");

    try {
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      const token = await credentials.user.getIdToken();
      saveToken(token);

      // sync/login backend
      await login({
        email,
        idToken: token,
      });

      if (statusEl) statusEl.textContent = "Login successful! Redirecting...";

      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1200);
    } catch (err: any) {
      console.error("Login error:", err);
      if (statusEl) {
        statusEl.textContent = err?.message || "Login failed";
      }
    }
  });

  // GOOGLE SIGN-IN
  googleBtn?.addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(firebaseAuth, provider);

      const token = await result.user.getIdToken();
      saveToken(token);

      // Αν ο backend register endpoint κάνει "upsert" user, αυτό είναι τέλειο
      await register({
        firstName: result.user.displayName?.split(" ")[0] || "",
        lastName: result.user.displayName?.split(" ").slice(1).join(" ") || "",
        email: result.user.email || "",
        idToken: token,
      });

      window.location.href = "/index.html";
    } catch (err: any) {
      console.error("Google login error:", err);
      if (statusEl) {
        statusEl.textContent = err?.message || "Google sign-in failed";
      }
    }
  });
}
