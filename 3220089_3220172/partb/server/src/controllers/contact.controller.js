import { sendEmail } from "../services/email.service.js";
import {
  contactFormSchema,
  parseOrThrow,
} from "../utils/validators.js";

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function maskEmail(value) {
  const email = String(value || "");
  const [local, domain] = email.split("@");
  if (!domain) return "redacted";
  return `${local.slice(0, 2)}***@${domain}`;
}

export async function submitContactForm(req, res, next) {
  try {
    const body = parseOrThrow(
      contactFormSchema,
      req.body,
      "Invalid contact form"
    );

    const to =
      process.env.CONTACT_EMAIL_TO ||
      "adminskanare@gmail.com";

    const subject =
      `Skanare contact form — ${body.name}`;

    console.info("contact_form_received", {
      requestId: req.requestId,
      from: maskEmail(body.email),
      to,
    });

    const sent = await sendEmail({
      to,
      subject,
      replyTo: body.email,
      html: `
        <div style="font-family:Arial,sans-serif;color:#111;line-height:1.6">
          <h2 style="margin:0 0 18px">New contact form message</h2>
          <p><strong>Name:</strong> ${escapeHtml(body.name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(body.email)}</p>
          <p><strong>Message:</strong></p>
          <div style="white-space:pre-wrap;padding:16px;background:#f6f6f3;border:1px solid #e5e5df;border-radius:8px">${escapeHtml(body.message)}</div>
        </div>
      `,
    });

    console.info("contact_form_email_sent", {
      requestId: req.requestId,
      resendId: sent?.id || null,
      to,
    });

    return res.status(200).json({
      success: true,
      message: "Message sent successfully",
    });
  } catch (error) {
    console.error("contact_form_failed", {
      requestId: req.requestId,
      message:
        error instanceof Error
          ? error.message
          : "Unknown error",
    });

    return next(error);
  }
}
