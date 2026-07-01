"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { login, register } from "@/lib/api";
import { removeToken, saveToken } from "@/lib/auth";

export default function LoginPage() {
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

    setStatus("Logging in...");

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");

    try {
      const credentials = await signInWithEmailAndPassword(
        firebaseAuth,
        email,
        password
      );

      await credentials.user.reload();

      if (!credentials.user.emailVerified) {
        await firebaseAuth.signOut();
        removeToken();
        setStatus("Please verify your email before continuing. Check your inbox.");
        return;
      }

      const token = await credentials.user.getIdToken();
      saveToken(token);

      await login({
        email,
        idToken: token,
      });

      setStatus("Login successful! Redirecting...");
      goToRedirect();
    } catch (err: any) {
      console.error("Login error:", err);
      setStatus(err?.message || "Login failed");
    }
  }

  async function handleGoogleLogin() {
    try {
      setStatus("Signing in with Google...");

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

      setStatus("Login successful! Redirecting...");
      goToRedirect();
    } catch (err: any) {
      console.error("Google login error:", err);
      setStatus(err?.message || "Google sign-in failed");
    }
  }

  const registerHref =
    "/register?redirect=" + encodeURIComponent(getRedirectUrl());

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p className="auth-sub">Sign in to your account</p>

        <button type="button" className="auth-google" onClick={handleGoogleLogin}>
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
          <input name="email" type="email" placeholder="Email" required />
          <input
            name="password"
            type="password"
            placeholder="Password"
            required
          />

          <button type="submit" className="auth-submit">
            Sign in
          </button>

          <p className="auth-status">{status}</p>
        </form>

        <p className="auth-switch">
          Don’t have an account? <Link href={registerHref}>Sign up</Link>
        </p>
      </div>
    </main>
  );
}