import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";

import { firebaseAuth } from "./firebase";
import { login, type AuthUser } from "./api";

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

async function runGoogleAuth(): Promise<AuthUser> {
  const provider = new GoogleAuthProvider();

  // Always show the account chooser. This avoids silently reusing a stale
  // Google account and keeps Google auth independent from browser autofill
  // in the email/password form.
  provider.setCustomParameters({
    prompt: "select_account",
  });

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
    const response = await login({
      email,
      idToken: token,
      firstName,
      lastName,
    });

    if (!response?.user) {
      throw new Error(
        "Google authentication succeeded, but the Skanare account could not be synchronized."
      );
    }

    return response.user;
  } catch (error) {
    // Firebase may already consider the user signed in even when our backend
    // sync fails. Roll that state back so a retry starts cleanly.
    await signOut(firebaseAuth).catch(() => undefined);
    throw new Error(googleAuthErrorMessage(error));
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
