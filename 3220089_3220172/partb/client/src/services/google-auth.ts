import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { getMe, login, type AuthUser } from "./api";

let googleAuthPromise: Promise<AuthUser> | null = null;

function splitDisplayName(displayName: string | null | undefined) {
  const parts = String(displayName || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function googleAuthErrorMessage(error: unknown): string {
  const code = String((error as any)?.code || "");

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was cancelled.";
  }

  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in window. Allow pop-ups for Skanare and try again.";
  }

  if (code === "auth/cancelled-popup-request") {
    return "Another Google sign-in is already in progress.";
  }

  return error instanceof Error
    ? error.message
    : "Google sign-in failed";
}

function isTransientBackendError(error: unknown): boolean {
  const message = String(
    error instanceof Error
      ? error.message
      : (error as any)?.message || error || ""
  );
  // Both overloaded APIs and connectivity failures can happen after Google
  // successfully authenticates the account. They must not sign the user out.
  return /\b(408|429|500|502|503|504)\b|too many requests|failed to fetch|networkerror|network request failed/i.test(message);
}

async function syncGoogleUser(params: {
  email: string;
  idToken: string;
  firstName: string;
  lastName: string;
}): Promise<AuthUser> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await login(params);

      if (!response?.user) {
        throw new Error(
          "Google authentication succeeded, but the Skanare account could not be synchronized."
        );
      }

      return response.user;
    } catch (error) {
      lastError = error;

      if (!isTransientBackendError(error) || attempt === 3) {
        throw error;
      }

      await new Promise((resolve) =>
        window.setTimeout(resolve, attempt * 700)
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Google account synchronization failed");
}

async function runGoogleAuth(): Promise<AuthUser> {
  const provider = new GoogleAuthProvider();

  // Always show the account chooser. This avoids silently reusing a stale
  // Google account and keeps Google auth independent from browser autofill
  // in the email/password form.
  provider.setCustomParameters({
    prompt: "select_account",
  });

  // Firebase must preserve the session when navigating between full-page routes.
  await setPersistence(firebaseAuth, browserLocalPersistence);

  const result = await signInWithPopup(
    firebaseAuth,
    provider
  );

  const email = String(result.user.email || "").trim();

  if (!email) {
    await signOut(firebaseAuth).catch(() => undefined);
    throw new Error("Google did not return an email address.");
  }

  const {
    firstName,
    lastName,
  } = splitDisplayName(result.user.displayName);

  try {
    const token = await result.user.getIdToken(true);

    // Use one backend sync path for both "Sign in with Google" and
    // "Continue with Google" on registration. The backend login endpoint
    // creates the Firestore user on first Google login and returns the
    // existing user on later logins.
    return await syncGoogleUser({
      email,
      idToken: token,
      firstName,
      lastName,
    });
  } catch (error) {
    // The popup already authenticated the user with Firebase. NEVER sign out
    // an authenticated Google user just because /api/auth/login failed:
    // the old code made the orders appear briefly and then disappear.
    //
    // After logout an old CSRF cookie can sometimes reject the POST while
    // a read-only /auth/me request still works. Only accept a profile for
    // the same Firebase UID and email; never use a stale account's profile.
    if (firebaseAuth.currentUser?.uid === result.user.uid) {
      try {
        const profile = await getMe();
        if (
          profile?.uid === result.user.uid &&
          String(profile.email || "").toLowerCase() === email.toLowerCase()
        ) {
          return profile;
        }
      } catch {
        // An unavailable profile endpoint must not destroy Firebase auth.
      }
    }

    console.warn("Google authentication succeeded but account sync failed", {
      reason: googleAuthErrorMessage(error),
    });
    throw new Error(
      "Google sign-in succeeded, but your account details could not be loaded. " +
      "You are still signed in. Please retry in a moment."
    );
  }
}

export function signInWithGoogleAccount(): Promise<AuthUser> {
  if (!googleAuthPromise) {
    googleAuthPromise = runGoogleAuth()
      .finally(() => {
        googleAuthPromise = null;
      });
  }

  return googleAuthPromise;
}

export { googleAuthErrorMessage };
