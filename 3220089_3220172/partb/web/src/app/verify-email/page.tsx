"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { firebaseAuth } from "@/lib/firebase";
import {
  mergeGuestCart,
  sendVerificationCode,
  verifyEmailCode,
} from "@/lib/api";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [status, setStatus] = useState("");
  const [resendDisabled, setResendDisabled] = useState(false);
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href =
          "/login?redirect=" +
          encodeURIComponent(window.location.pathname + window.location.search);
      }
    });

    return () => unsub();
  }, []);

  function getRedirectUrl(): string {
    const redirect = searchParams.get("redirect");

    if (redirect && redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }

    return "/";
  }

  function setDigit(index: number, value: string) {
    const next = [...digits];
    next[index] = value.replace(/\D/g, "").slice(0, 1);
    setDigits(next);

    if (next[index] && refs.current[index + 1]) {
      refs.current[index + 1]?.focus();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const otp = digits.join("");

    if (otp.length !== 6) {
      setStatus("Please enter the 6-digit code.");
      return;
    }

    try {
      setStatus("Verifying...");

      await verifyEmailCode(otp);

      try {
        await mergeGuestCart();
      } catch (mergeError) {
        console.warn("Guest cart merge after verification failed:", mergeError);
      }

      setStatus("Email verified. Redirecting...");

      setTimeout(() => {
        window.location.href = getRedirectUrl();
      }, 800);
    } catch (err: any) {
      console.error("Verify email failed:", err);
      setStatus(err?.message || "Invalid code.");
    }
  }

  async function resendCode() {
    try {
      setResendDisabled(true);
      setStatus("Sending new code...");

      await sendVerificationCode();

      setStatus("New code sent. Check your email.");
    } catch (err: any) {
      console.error("Resend code failed:", err);
      setStatus(err?.message || "Could not resend code.");
    } finally {
      setTimeout(() => {
        setResendDisabled(false);
      }, 30000);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-card">
        <h1>Verify email</h1>
        <p className="auth-sub">
          Enter the 6-digit code we sent to your email.
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="otp-boxes">
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  refs.current[index] = el;
                }}
                className="otp-input"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(event) => setDigit(index, event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Backspace" &&
                    !digits[index] &&
                    refs.current[index - 1]
                  ) {
                    refs.current[index - 1]?.focus();
                  }
                }}
                onPaste={(event) => {
                  event.preventDefault();

                  const pasted =
                    event.clipboardData
                      .getData("text")
                      .replace(/\D/g, "")
                      .slice(0, 6) || "";

                  const next = ["", "", "", "", "", ""];
                  pasted.split("").forEach((char, i) => {
                    next[i] = char;
                  });

                  setDigits(next);
                  refs.current[
                    Math.min(Math.max(pasted.length - 1, 0), 5)
                  ]?.focus();
                }}
              />
            ))}
          </div>

          <button type="submit" className="auth-submit">
            Verify email
          </button>

          <button
            type="button"
            className="auth-google"
            disabled={resendDisabled}
            onClick={resendCode}
          >
            Resend code
          </button>

          <p className="auth-status">{status}</p>
        </form>
      </div>
    </main>
  );
}
