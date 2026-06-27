/* 3220089_3220172  2025 */

import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { firebaseAuth } from "../../services/firebase";
import { saveToken } from "../../services/auth";
import { register } from "../../services/api";

initNav();
void updateCartBadge();
initMobileMenu();

const form = document.getElementById("registerForm") as HTMLFormElement | null;
const statusEl = document.getElementById("status");
const googleBtn = document.querySelector<HTMLButtonElement>(".auth-google");

function getRedirectUrl(): string {
  const redirect = new URLSearchParams(window.location.search).get("redirect");

  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }

  return "/index.html";
}

function goToRedirect(delay = 800): void {
  setTimeout(() => {
    window.location.href = getRedirectUrl();
  }, delay);
}

form?.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (statusEl) statusEl.textContent = "";

  const formData = new FormData(form);

  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (statusEl) statusEl.textContent = "Registering...";

  try {
    const credentials = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    const token = await credentials.user.getIdToken();
    saveToken(token);

    await register({
      firstName,
      lastName,
      email,
      password,
      idToken: token,
    });

    if (statusEl) {
      statusEl.textContent = "Registration successful! Redirecting...";
    }

    goToRedirect();
  } catch (err: any) {
    console.error("Register error:", err);

    if (statusEl) {
      statusEl.textContent = err.message || "Registration failed";
    }
  }
});

googleBtn?.addEventListener("click", async () => {
  try {
    if (statusEl) statusEl.textContent = "Signing up with Google...";

    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(firebaseAuth, provider);

    const token = await result.user.getIdToken();
    saveToken(token);

    await register({
      firstName: result.user.displayName?.split(" ")[0] || "",
      lastName: result.user.displayName?.split(" ").slice(1).join(" ") || "",
      email: result.user.email || "",
      idToken: token,
    });

    if (statusEl) {
      statusEl.textContent = "Registration successful! Redirecting...";
    }

    goToRedirect();
  } catch (err: any) {
    console.error("Google register error:", err);

    if (statusEl) {
      statusEl.textContent = err?.message || "Google sign-up failed";
    }
  }
});