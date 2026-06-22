/* 3220089_3220172  2025 */

import { getDB, getAuthService } from "../config/db.js";

// ✅ Helpers
function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isStrongPassword(password) {
  return String(password || "").length >= 6; // ✅ simple rule
}

// ✅ REGISTER
export async function registerUser(req, res, next) {
  try {
    const db = getDB();
    const auth = getAuthService();

    const { firstName, lastName, email, password, idToken } = req.body || {};
    const syncOnlyMode = Boolean(idToken);

    // ✅ Basic checks only
    if (!firstName || firstName.trim().length < 2) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid first name" });
    }

    if (!lastName || lastName.trim().length < 2) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid last name" });
    }

    const cleanEmail = normalizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ error: true, message: "Invalid email" });
    }

    if (!syncOnlyMode && (!password || !isStrongPassword(password))) {
      return res.status(400).json({
        error: true,
        message: "Password must be at least 6 characters",
      });
    }

    let uid;

    // ✅ Αν έρχεται token από Firebase (frontend signup)
    if (idToken) {
      const decoded = await auth.verifyIdToken(idToken);
      uid = decoded.uid;
    } else {
      // ✅ Create user directly
      const user = await auth.createUser({
        email: cleanEmail,
        password,
        displayName: `${firstName} ${lastName}`,
      });

      uid = user.uid;
    }

    // ✅ Save simple user profile
    const userProfile = {
      id: uid,
      firstName,
      lastName,
      email: cleanEmail,
      createdAt: new Date().toISOString(),
    };

    await db.collection("users").doc(uid).set(userProfile);

    res.status(201).json({
      message: "User registered successfully",
      user: userProfile,
    });
  } catch (err) {
    next(err);
  }
}

// ✅ LOGIN
export async function login(req, res, next) {
  try {
    const db = getDB();
    const auth = getAuthService();

    const { email, password } = req.body || {};

    const cleanEmail = normalizeEmail(email);

    if (!cleanEmail) {
      return res
        .status(400)
        .json({ error: true, message: "Email is required" });
    }

    if (!password) {
      return res
        .status(400)
        .json({ error: true, message: "Password is required" });
    }

    // ✅ Firebase login μέσω REST API
    const apiKey = process.env.FIREBASE_WEB_API_KEY;

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          returnSecureToken: true,
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(401).json({
        error: true,
        message: "Invalid credentials",
      });
    }

    const userDoc = await db.collection("users").doc(data.localId).get();

    const user = userDoc.exists
      ? userDoc.data()
      : { id: data.localId, email: cleanEmail };

    res.json({
      token: data.idToken,
      user,
    });
  } catch (err) {
    next(err);
  }
}
