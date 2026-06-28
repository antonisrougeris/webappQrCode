import crypto from "crypto";
import { getDB } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";
import { nowIso } from "../utils/ids.js";
import { sendEmail } from "./email.service.js";

const COLLECTION = "emailVerifications";
const OTP_TTL_MS = 10 * 60 * 1000;

function createOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

export async function sendVerificationOtp({ uid, email }) {
  if (!uid || !email) throw new ApiError(400, "Missing verification user");

  const db = getDB();
  const otp = createOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS).toISOString();

  await db.collection(COLLECTION).doc(uid).set({
    uid,
    email,
    otpHash: hashOtp(otp),
    expiresAt,
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  await sendEmail({
    to: email,
    subject: "Your Skanare verification code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:32px">
        <h1 style="margin:0 0 12px">Verify your Skanare account</h1>
        <p>Your verification code is:</p>
        <div style="font-size:32px;font-weight:800;letter-spacing:6px;background:#f4f4f4;padding:18px;text-align:center;border-radius:12px">
          ${otp}
        </div>
        <p style="color:#666;margin-top:20px">This code expires in 10 minutes.</p>
      </div>
    `,
  });

  return { sent: true };
}

export async function verifyEmailOtp({ uid, otp }) {
  if (!uid || !otp) throw new ApiError(400, "Missing verification data");

  const db = getDB();
  const ref = db.collection(COLLECTION).doc(uid);
  const snap = await ref.get();

  if (!snap.exists) throw new ApiError(400, "Verification code not found");

  const data = snap.data();

  if (new Date(data.expiresAt).getTime() < Date.now()) {
    throw new ApiError(400, "Verification code expired");
  }

  if (Number(data.attempts || 0) >= 5) {
    throw new ApiError(429, "Too many verification attempts");
  }

  if (data.otpHash !== hashOtp(String(otp))) {
    await ref.set(
      { attempts: Number(data.attempts || 0) + 1, updatedAt: nowIso() },
      { merge: true }
    );
    throw new ApiError(400, "Invalid verification code");
  }

  await getDB().collection(COLLECTIONS.USERS).doc(uid).set(
    {
      emailVerified: true,
      emailVerifiedAt: nowIso(),
      updatedAt: nowIso(),
    },
    { merge: true }
  );

  await ref.delete();

  return { verified: true };
}