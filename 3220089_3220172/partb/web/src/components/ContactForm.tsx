"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export function ContactForm() {
  const [status, setStatus] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      setSending(true);
      setStatus("Sending...");

      await apiRequest("/contact", {
        method: "POST",
        body: JSON.stringify({
          name: String(data.get("name") || "").trim(),
          email: String(data.get("email") || "").trim(),
          message: String(data.get("message") || "").trim(),
        }),
      });

      form.reset();
      setStatus("Message sent successfully!");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Failed to send message."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <input
          type="text"
          name="name"
          placeholder="Name"
          required
        />
        <input
          type="email"
          name="email"
          placeholder="E-mail"
          required
        />
      </div>

      <textarea
        name="message"
        placeholder="Message"
        rows={6}
        minLength={10}
        maxLength={5000}
        required
      />

      <button
        type="submit"
        className="btn-primary"
        disabled={sending}
      >
        {sending ? "Sending..." : "Send message"}
      </button>

      <p className="form-status" aria-live="polite">
        {status}
      </p>
    </form>
  );
}
