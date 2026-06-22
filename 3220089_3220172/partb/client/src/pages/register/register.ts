/* 3220089_3220172  2025 */

import { createUserWithEmailAndPassword } from "firebase/auth";
import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";
import { register } from "../../services/api";

// ✅ Initialize UI
initNav();
updateCartBadge();
initMobileMenu();

const form = document.getElementById("registerForm") as HTMLFormElement;
const statusEl = document.getElementById("status");

// ✅ Submit
form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (statusEl) statusEl.textContent = "";

  const formData = new FormData(form);

  const firstName = formData.get("firstName") as string;
  const lastName = formData.get("lastName") as string;
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (statusEl) statusEl.textContent = "Registering...";

  try {
    // ✅ Firebase create user
    const credentials = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    const token = await credentials.user.getIdToken();

    // ✅ Save locally
    saveToken(token);

    // ✅ Send to backend
    await register({
      firstName,
      lastName,
      email,
      password,
      idToken: token,
    });

    // ✅ Success
    if (statusEl) {
      statusEl.textContent = "Registration successful! Redirecting...";
    }

    setTimeout(() => {
      window.location.href = "/index.html";
    }, 1500);
  } catch (err: any) {
    console.error("Register error:", err);

    if (statusEl) {
      statusEl.textContent = err.message || "Registration failed";
    }
  }
});
