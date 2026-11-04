import "../../i18n/auto";
/* 3220089_3220172 2025 */

import {
  signInWithEmailAndPassword,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { initNav } from "../../components/initNav";
import { initMobileMenu } from "../../components/menu";
import { updateCartBadge } from "../../utils/cart-badge";
import { initPasswordVisibility } from "../../utils/password-visibility";
import { firebaseAuth } from "../../services/firebase";
import { login } from "../../services/api";
import {
  googleAuthErrorMessage,
  signInWithGoogleAccount,
} from "../../services/google-auth";


import { showFlashToast } from "../../utils/toast.ts";
import { normalizeSameOriginPath } from "../../utils/redirect";
import { observeLoginCredentials } from "./login-credentials";
import {
  locale,
  localizedPath,
} from "../../i18n/locale";

initPasswordVisibility();

const form = document.getElementById("loginForm") as HTMLFormElement | null;
const statusEl = document.getElementById("status");
const googleBtn = document.querySelector<HTMLButtonElement>(".auth-google");
const emailSubmitBtn = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
let authInProgress = false;
let readCredentials: ReturnType<typeof observeLoginCredentials> | null = null;

function setAuthInProgress(inProgress: boolean): void {
  authInProgress = inProgress;
  if (googleBtn) googleBtn.disabled = inProgress;
  if (emailSubmitBtn) emailSubmitBtn.disabled = inProgress;
}

const registerLink = document.getElementById(
  "registerLink"
) as HTMLAnchorElement | null;

const forgotPasswordLink = document.getElementById(
  "forgotPasswordLink"
) as HTMLAnchorElement | null;

function buildAuthQuery(params: Record<string, string | undefined>): string {
  const urlParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value && value.trim()) {
      urlParams.set(key, value.trim());
    }
  });

  const query = urlParams.toString();
  return query ? `?${query}` : "";
}

document.addEventListener("DOMContentLoaded", () => {
  showFlashToast();

  applyPrefill();
  // Register after URL prefill, so browser suggestions and checkout redirects
  // cannot leave an obsolete credential snapshot before the user edits.
  if (form) readCredentials = observeLoginCredentials(form);
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
    localizedPath(
      "/forgot-password" +
        (query ? `?${query}` : ""),
      locale
    );
}

function getRedirectUrl(): string {
  const redirect = normalizeSameOriginPath(
    new URLSearchParams(window.location.search).get("redirect")
  );

  return redirect || "/";
}

function applyRegisterRedirect(): void {
  if (!registerLink) return;

  const params = new URLSearchParams(window.location.search);
  const redirect = getRedirectUrl();
  const email = params.get("email")?.trim() || "";
  const firstName = params.get("firstName")?.trim() || "";
  const lastName = params.get("lastName")?.trim() || "";

  const query = buildAuthQuery({
    redirect,
    email,
    firstName,
    lastName,
  });

  registerLink.href = localizedPath(
    `/register${query}`,
    locale
  );
}

function goToRedirect(delay = 800): void {
  setTimeout(() => {
    const redirect = getRedirectUrl();

    // Browser privacy settings can disable localStorage. Navigation must
    // still complete after a successful authentication.
    try {
      localStorage.setItem("skanare_returning_from_auth", "1");
    } catch { /* continue with the redirect even when storage is unavailable */ }

    window.location.href = localizedPath(
      redirect,
      locale
    );
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

    // Password managers can auto-submit a filled email form while Google
    // sign-in is in progress. Never run both authentication flows together.
    if (authInProgress) return;
    setAuthInProgress(true);

    if (statusEl) statusEl.textContent = "Logging in...";

    const { email, password } = (readCredentials ?? observeLoginCredentials(form))();

    if (!email || !password) {
      if (statusEl) statusEl.textContent = "Enter your email and password to sign in.";
      setAuthInProgress(false);
      return;
    }

    try {
      await setPersistence(firebaseAuth, browserLocalPersistence);
      // 1. Firebase Auth login
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      // Never continue with a different account left in browser persistence.
      if (String(credentials.user.email || "").trim().toLowerCase() !== email.toLowerCase()) {
        throw new Error("The signed-in account does not match the email you entered. Please retry.");
      }

      const token = await credentials.user.getIdToken();

      // 2. Backend login (Firestore user fetch)
      const res = await login({
        email,
        idToken: token,
      });

      const user = res?.user;

      if (!user) {
        throw new Error("User not returned from server");
      }

      if (
        (user.uid && user.uid !== credentials.user.uid) ||
        (user.email && user.email.trim().toLowerCase() !== email.toLowerCase())
      ) {
        throw new Error("The account returned by the server does not match the login email.");
      }

      // 3. Firestore verification check (SOURCE OF TRUTH)
      if (!user.emailVerified) {
        await firebaseAuth.signOut();

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
    } finally {
      setAuthInProgress(false);
    }
  });
}

googleBtn?.addEventListener("click", async (event) => {
  event.preventDefault();
  event.stopPropagation();

  if (authInProgress) return;
  setAuthInProgress(true);

  // Browser password managers can leave autofilled credentials in the
  // email/password form. Google authentication must never consume or submit
  // that form state.
  form?.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
    input.blur();
  });

  try {
    if (statusEl) statusEl.textContent = "Signing in with Google...";

    await signInWithGoogleAccount();

    if (statusEl) statusEl.textContent = "Login successful! Redirecting...";

    goToRedirect();
  } catch (err: any) {
    console.error("Google login error:", err);

    if (statusEl) {
      statusEl.textContent = googleAuthErrorMessage(err);
    }
  } finally {
    setAuthInProgress(false);
  }
});