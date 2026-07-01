"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { register, sendVerificationCode } from "@/lib/api";
import { saveToken } from "@/lib/auth";

export default function RegisterPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("");

  function getRedirectUrl(): string {
    const redirect = searchParams.get("redirect");

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }

    return "/";
  }

  function goToRedirect(delay = 800) {
    setTimeout(() => {
      window.location.href = getRedirectUrl();
    }, delay);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setStatus("Registering...");

    const formData = new FormData(event.currentTarget);

    const firstName = String(formData.get("firstName") || "").trim();
    const lastName = String(formData.get("lastName") || "").trim();
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const confirmPassword = String(formData.get("confirmPassword") || "");

    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

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

      await sendVerificationCode();

      setStatus("Registration successful. Please verify your email.");

      await firebaseAuth.signOut();

      window.location.href =
        "/verify-email?redirect=" + encodeURIComponent(getRedirectUrl());
    } catch (err: any) {
      console.error("Register error:", err);
      setStatus(err?.message || "Registration failed");
    }
  }

  async function handleGoogleRegister() {
    try {
      setStatus("Signing up with Google...");

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

      setStatus("Registration successful! Redirecting...");
      goToRedirect();
    } catch (err: any) {
      console.error("Google register error:", err);
      setStatus(err?.message || "Google sign-up failed");
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="auth-sub">Start your QR journey</p>

        <button
          type="button"
          className="auth-google"
          onClick={handleGoogleRegister}
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt=""
          />
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <input name="firstName" placeholder="First name" required />
          <input name="lastName" placeholder="Last name" required />
          <input name="email" type="email" placeholder="Email" required />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
          />
          <input
            name="confirmPassword"
            type="password"
            placeholder="Confirm password"
            required
          />

          <button type="submit" className="auth-submit">
            Create account
          </button>

          <p className="auth-status">{status}</p>
        </form>

        <p className="auth-switch">
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </main>
  );
}
