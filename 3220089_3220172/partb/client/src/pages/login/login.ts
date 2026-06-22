//* 3220089_3220172  2025 */

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
import { register } from "../../services/api"; // ✅ για sync backend

const form = document.getElementById("loginForm") as HTMLFormElement;
const statusEl = document.getElementById("status");
const googleBtn = document.querySelector(".auth-google");

// ✅ Run only on login page
if (form) {
  initNav();
  initMobileMenu();
  updateCartBadge();

  // ✅ EMAIL / PASSWORD LOGIN
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    statusEl!.textContent = "Logging in...";

    const formData = new FormData(form);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      const token = await credentials.user.getIdToken();
      saveToken(token);

      statusEl!.textContent = "Login successful! Redirecting...";

      setTimeout(() => {
        window.location.href = "/index.html";
      }, 1200);
    } catch (err: any) {
      console.error("Login error:", err);
      statusEl!.textContent = err.message || "Login failed";
    }
  });

  // ✅ GOOGLE SIGN-IN
  googleBtn?.addEventListener("click", async () => {
    try {
      const provider = new GoogleAuthProvider();

      const result = await signInWithPopup(firebaseAuth, provider);

      const token = await result.user.getIdToken();

      // ✅ Save token locally
      saveToken(token);

      // ✅ Sync with backend (optional but recommended)
      await register({
        firstName: result.user.displayName?.split(" ")[0] || "",
        lastName: result.user.displayName?.split(" ")[1] || "",
        email: result.user.email,
        idToken: token,
      });

      // ✅ Redirect
      window.location.href = "/index.html";
    } catch (err: any) {
      console.error("Google login error:", err);
      statusEl!.textContent = "Google sign-in failed";
    }
  });
}
