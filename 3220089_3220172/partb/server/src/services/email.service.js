import { Resend } from "resend";

export async function sendEmail({ to, subject, html, from }) {
  const apiKey = process.env.RESEND_API_KEY;

  console.log("========== EMAIL SERVICE ==========");
  console.log({
    hasApiKey: Boolean(apiKey),
    from: from || process.env.EMAIL_FROM,
    to,
    subject,
  });

  if (!apiKey) {
    throw new Error("RESEND_API_KEY is missing");
  }

  const resend = new Resend(apiKey);
  const sender = from || process.env.EMAIL_FROM || "Skanare <verify@skanare.com>";

  const result = await resend.emails.send({
    from: sender,
    to,
    subject,
    html,
  });

  console.log("Resend result:", JSON.stringify(result, null, 2));

  if (result.error) {
    console.error("Resend email error:", result.error);
    throw new Error(result.error.message || "Email send failed");
  }

  console.log("Email sent successfully:", {
    to,
    subject,
    id: result.data?.id,
  });

  return result.data;
}