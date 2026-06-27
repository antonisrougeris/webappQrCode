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
const googleBtn = document.querySelector<HTMLButtonElement>(".auth-google");
const registerLink = document.getElementById(
  "registerLink"
) as HTMLAnchorElement | null;

function getRedirectUrl(): string {
  const redirect = new URLSearchParams(window.location.search).get("redirect");

  if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
    return redirect;
  }

  return "/index.html";
}

function applyRegisterRedirect(): void {
  if (!registerLink) return;

  const redirect = getRedirectUrl();

  registerLink.href =
    "/src/pages/register/register.html?redirect=" +
    encodeURIComponent(redirect);
}

function goToRedirect(delay = 800): void {
  setTimeout(() => {
    window.location.href = getRedirectUrl();
  }, delay);
}

initNav();
initMobileMenu();
void updateCartBadge();
applyRegisterRedirect();

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (statusEl) statusEl.textContent = "Logging in...";

    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      const token = await credentials.user.getIdToken();
      saveToken(token);

      await login({
        email,
        idToken: token,
      });

      if (statusEl) statusEl.textContent = "Login successful! Redirecting...";

      goToRedirect();
    } catch (err: any) {
      console.error("Login error:", err);
      if (statusEl) {
        statusEl.textContent = err?.message || "Login failed";
      }
    }
  });
}

googleBtn?.addEventListener("click", async () => {
  try {
    if (statusEl) statusEl.textContent = "Signing in with Google...";

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

    if (statusEl) statusEl.textContent = "Login successful! Redirecting...";

    goToRedirect();
  } catch (err: any) {
    console.error("Google login error:", err);
    if (statusEl) {
      statusEl.textContent = err?.message || "Google sign-in failed";
    }
  }
});