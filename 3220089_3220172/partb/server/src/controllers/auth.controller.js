/* 3220089_3220172  2025 */

import { getDB, getAuthService, toPlainDoc } from "../config/db.js";
import { validatePassword, isValidBirthdate } from "../middleware/validateUser.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function normalizePhone(phone) {
  return String(phone || "").replace(/\D/g, "");
}

function buildUserProfile(uid, data = {}) {
  return {
    id: uid,
    _id: uid,
    firebaseUid: uid,
    firstName: data.firstName || "",
    lastName: data.lastName || "",
    email: data.email || "",
    phone: data.phone || "",
    birthdate: data.birthdate || "",
    gender: data.gender || "",
    interests: Array.isArray(data.interests) ? data.interests : [],
    experience: data.experience || "",
    goals: data.goals || "",
    newsletter: Boolean(data.newsletter),
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString(),
  };
}

async function signInWithEmailPassword(email, password) {
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    throw new Error("Missing FIREBASE_WEB_API_KEY");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    }
  );

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "Invalid credentials";
    throw new Error(message);
  }

  return payload;
}

export async function registerUser(req, res, next) {
  try {
    const db = getDB();
    const auth = getAuthService();
    const body = req.body || {};
    const {
      firstName,
      lastName,
      email,
      phone,
      password,
      birthdate,
      gender,
      interests = [],
      experience,
      goals,
      newsletter = false,
      idToken,
    } = body;

    const syncOnlyMode = Boolean(idToken);

    if (!firstName || !lastName || !email || (!password && !syncOnlyMode)) {
      return res.status(400).json({ error: true, message: "Missing required fields" });
    }

    if (String(firstName).trim().length < 2) {
      return res.status(400).json({ error: true, message: "First name is too short" });
    }

    if (String(lastName).trim().length < 2) {
      return res.status(400).json({ error: true, message: "Last name is too short" });
    }

    const cleanEmail = normalizeEmail(email);
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: true, message: "Invalid email" });
    }

    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits || phoneDigits.length < 10) {
      return res.status(400).json({ error: true, message: "Invalid phone number" });
    }

    if (!syncOnlyMode) {
      const pwIssues = validatePassword(password);
      if (pwIssues.length > 0) {
        return res.status(400).json({
          error: true,
          message: `Password must have: ${pwIssues.join(", ")}`,
        });
      }
    }

    if (!isValidBirthdate(birthdate)) {
      return res.status(400).json({
        error: true,
        message: "Invalid birthdate or user is too young (min age 16)",
      });
    }

    if (!gender || String(gender).trim().length === 0) {
      return res.status(400).json({ error: true, message: "Gender is required" });
    }

    if (!Array.isArray(interests) || interests.length === 0) {
      return res.status(400).json({ error: true, message: "Select at least one interest" });
    }

    if (!experience || String(experience).trim().length === 0) {
      return res.status(400).json({ error: true, message: "Experience level is required" });
    }

    let uid = null;
    let tokenSource = null;

    if (syncOnlyMode) {
      tokenSource = idToken || String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
      if (!tokenSource) {
        return res.status(401).json({ error: true, message: "Missing Firebase token" });
      }

      const decoded = await auth.verifyIdToken(tokenSource);
      if (decoded.email && normalizeEmail(decoded.email) !== cleanEmail) {
        return res.status(400).json({ error: true, message: "Email does not match Firebase token" });
      }

      uid = decoded.uid;
      await auth.updateUser(uid, {
        displayName: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
      }).catch(() => null);
    } else {
      try {
        await auth.getUserByEmail(cleanEmail);
        return res.status(400).json({ error: true, message: "Email already in use" });
      } catch (lookupError) {
        if (lookupError?.code !== "auth/user-not-found") {
          throw lookupError;
        }
      }

      const created = await auth.createUser({
        email: cleanEmail,
        password,
        displayName: `${String(firstName).trim()} ${String(lastName).trim()}`.trim(),
      });
      uid = created.uid;
    }

    const user = buildUserProfile(uid, {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: cleanEmail,
      phone: String(phone || ""),
      birthdate,
      gender,
      interests,
      experience,
      goals,
      newsletter,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.collection("users").doc(uid).set(user, { merge: true });

    const token = syncOnlyMode ? tokenSource : (await signInWithEmailPassword(cleanEmail, password)).idToken;

    res.status(201).json({
      message: "User registered successfully",
      token,
      user,
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req, res, next) {
  try {
    const db = getDB();
    const { email, password } = req.body || {};

    const cleanEmail = normalizeEmail(email);
    const pass = String(password || "");

    if (!cleanEmail) return res.status(400).json({ error: true, message: "email is required" });
    if (!pass) return res.status(400).json({ error: true, message: "password is required" });

    const session = await signInWithEmailPassword(cleanEmail, pass);
    const profileSnapshot = await db.collection("users").doc(session.localId).get();
    const profile = toPlainDoc(profileSnapshot) || buildUserProfile(session.localId, { email: cleanEmail });

    res.json({
      token: session.idToken,
      user: buildUserProfile(session.localId, profile),
    });
  } catch (err) {
    const message = String(err?.message || "");
    if (/INVALID_PASSWORD|EMAIL_NOT_FOUND|INVALID_LOGIN_CREDENTIALS/i.test(message)) {
      return res.status(401).json({ error: true, message: "Invalid credentials" });
    }
    next(err);
  }
}