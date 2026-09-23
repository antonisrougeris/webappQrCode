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
import { removeToken, saveToken } from "../../services/auth";
import { login, register } from "../../services/api";


import { showFlashToast } from "../../utils/toast.ts";

const form = document.getElementById("loginForm") as HTMLFormElement | null;
const statusEl = document.getElementById("status");
const googleBtn = document.querySelector<HTMLButtonElement>(".auth-google");

const registerLink = document.getElementById(
  "registerLink"
) as HTMLAnchorElement | null;

const forgotPasswordLink = document.getElementById(
  "forgotPasswordLink"
) as HTMLAnchorElement | null;

document.addEventListener("DOMContentLoaded", () => {
  showFlashToast();

  applyPrefill();
  applyForgotPasswordLink();

  const emailInput =
    form?.querySelector<HTMLInputElement>(
      'input[name="email"]'
    );

  emailInput?.addEventListener(
    "input",
    applyForgotPasswordLink
  );
});


function normalizeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;

  const cleaned = value.trim();

  if (!cleaned || !cleaned.startsWith("/")) return null;

  const legacyMap: Record<string, string> = {
    "/login": "/login",
    "/register": "/register",
    "/forgot-password": "/forgot-password",
    "/verify-email": "/verify-email",
    "/checkout": "/checkout",
    "/cart": "/cart",
    "/my-qr": "/my-qr",
    "/contact": "/contact",
    "/about": "/about",
    "/payment-security": "/payment-security",
    "/products": "/products",
  };

  const mapped = legacyMap[cleaned] ?? cleaned;

  if (mapped.startsWith("//")) return null;

  return mapped;
}

function applyForgotPasswordLink(): void {
  if (!forgotPasswordLink) return;

  const emailInput = form?.querySelector<HTMLInputElement>(
    'input[name="email"]'
  );

  const email = emailInput?.value.trim() || "";

  const params = new URLSearchParams();

  if (email) {
    params.set("email", email);
  }

  const redirect = getRedirectUrl();

  if (redirect && redirect !== "/") {
    params.set("redirect", redirect);
  }

  const query = params.toString();

  forgotPasswordLink.href =
    "/forgot-password" +
    (query ? `?${query}` : "");
}

function getRedirectUrl(): string {
  const redirect = normalizeRedirectPath(
    new URLSearchParams(window.location.search).get("redirect")
  );

  return redirect || "/";
}

function applyRegisterRedirect(): void {
  if (!registerLink) return;

  const redirect = getRedirectUrl();

  registerLink.href =
    "/register?redirect=" +
    encodeURIComponent(redirect);
}

function goToRedirect(delay = 800): void {
  setTimeout(() => {
    const redirect = getRedirectUrl();

    // 🔥 optional safety: restore checkout flag
    localStorage.setItem("skanare_returning_from_auth", "1");

    window.location.href = redirect;
  }, delay);
}

function applyPrefill() {
  const email = new URLSearchParams(
    window.location.search
  ).get("email");

  if (!email || !form) return;

  const emailInput =
    form.querySelector<HTMLInputElement>(
      'input[name="email"]'
    );

  if (emailInput) {
    emailInput.value = email;
  }
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
      // 1. Firebase Auth login
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      const token = await credentials.user.getIdToken();
      saveToken(token);

      // 2. Backend login (Firestore user fetch)
      const res = await login({
        email,
        idToken: token,
      });

      const user = res?.user;

      if (!user) {
        throw new Error("User not returned from server");
      }

      // 3. Firestore verification check (SOURCE OF TRUTH)
      if (!user.emailVerified) {
        await firebaseAuth.signOut();
        removeToken();

        if (statusEl) {
          statusEl.textContent = "Please verify your email before continuing.";
        }
        return;
      }

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
      emailVerified: true,
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