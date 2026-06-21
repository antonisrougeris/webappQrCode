/* 3220089_3220172  2025 */

import { getDB, getAuthService, toPlainDoc, toPlainDocs } from "../config/db.js";

// --- HELPERS ---

// Minimum allowed age for registration
const MIN_AGE = 16;

/**
 * Calculates age from an ISO date string (yyyy-mm-dd)
 * @param {string} isoDate 
 * @returns {number|null} Age in years or null if invalid
 */
function calcAge(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;

  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

/**
 * Checks password against security complexity rules
 * @param {string} password 
 * @returns {string[]} Array of missing requirements
 */
function passwordIssues(password) {
  const issues = [];
  if (password.length < 8) issues.push("at least 8 characters");
  if (!/[A-Z]/.test(password)) issues.push("1 uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("1 lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("1 number");
  return issues;
}

/**
 * Validates email format using regex
 */
function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str || "").trim());
}

/**
 * Safely converts to string and removes whitespace
 */
function cleanString(v) {
  return String(v || "").trim();
}

/**
 * Normalizes email by trimming and converting to lowercase
 */
function normalizeEmail(email) {
  return cleanString(email).toLowerCase();
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

// --- CONTROLLERS ---

/**
 * Registers a new user with strict validation for age and password complexity
 */
export async function registerUser(req, res, next) {
  try {
    const db = getDB();
    const auth = getAuthService();
    const body = req.body || {};

    // Sanitize and normalize inputs
    const firstName = cleanString(body.firstName);
    const lastName = cleanString(body.lastName);
    const email = normalizeEmail(body.email);
    const password = String(body.password || "");
    const birthdate = cleanString(body.birthdate);

    // 1. Basic Presence Validation
    if (!firstName) return res.status(400).json({ error: true, message: "firstName is required" });
    if (!lastName) return res.status(400).json({ error: true, message: "lastName is required" });
    if (!email) return res.status(400).json({ error: true, message: "email is required" });
    if (!isEmail(email)) return res.status(400).json({ error: true, message: "email is invalid" });
    if (!password) return res.status(400).json({ error: true, message: "password is required" });

    // 2. Advanced Password Complexity Check
    const pwIssues = passwordIssues(password);
    if (pwIssues.length > 0) {
      return res.status(400).json({
        error: true,
        message: `Password must have: ${pwIssues.join(", ")}`,
      });
    }

    // 3. Age Validation
    const age = calcAge(birthdate);
    if (age === null) {
      return res.status(400).json({
        error: true,
        message: "Invalid birthdate format (expected YYYY-MM-DD)",
      });
    }
    if (age < MIN_AGE) {
      return res.status(400).json({
        error: true,
        message: `You must be at least ${MIN_AGE} years old`,
      });
    }

    // 4. Check for existing email (Uniqueness)
    try {
      await auth.getUserByEmail(email);
      return res.status(409).json({ error: true, message: "email already exists" });
    } catch (error) {
      if (error?.code !== "auth/user-not-found") {
        throw error;
      }
    }

    const created = await auth.createUser({
      email,
      password,
      displayName: `${firstName} ${lastName}`.trim(),
    });

    const doc = buildUserProfile(created.uid, {
      firstName,
      lastName,
      email,
      phone: cleanString(body.phone),
      birthdate,
      gender: cleanString(body.gender),
      interests: Array.isArray(body.interests) ? body.interests : [],
      experience: cleanString(body.experience),
      goals: cleanString(body.goals),
      newsletter: Boolean(body.newsletter),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await db.collection("users").doc(created.uid).set(doc);

    res.status(201).json({
      id: created.uid,
      email: doc.email,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves the profile of the currently authenticated user
 */
export async function getMyProfile(req, res, next) {
  try {
    const db = getDB();
    const userId = req.user?.sub; 

    if (!userId) {
      return res.status(401).json({ error: true, message: "Unauthorized" });
    }

    const snapshot = await db.collection("users").doc(String(userId)).get();
    const user = toPlainDoc(snapshot);

    if (!user) {
      return res.status(404).json({ error: true, message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    next(err);
  }
}

/**
 * Lists all users (Excluding password hashes)
 */
export async function listUsers(req, res, next) {
  try {
    const db = getDB();
    const snapshot = await db.collection("users").get();
    const users = toPlainDocs(snapshot).map((user) => buildUserProfile(user.id, user));
    res.json(users.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))));
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves a specific user by their Firebase uid
 */
export async function getUserById(req, res, next) {
  try {
    const db = getDB();
    const snapshot = await db.collection("users").doc(String(req.params.id)).get();
    const user = toPlainDoc(snapshot);
    
    if (!user) return res.status(404).json({ error: true, message: "User not found" });

    res.json(user);
  } catch (err) {
    next(err);
  }
}