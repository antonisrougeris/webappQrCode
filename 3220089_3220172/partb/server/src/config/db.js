/* 3220089_3220172  2025 */

import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth as getAdminAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

let db;
let auth;

function normalizePrivateKey(privateKey) {
  const value = String(privateKey || "").trim();
  if (!value) return "";

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\n/g, "\n");
  }

  return value.replace(/\\n/g, "\n");
}

function looksLikePlaceholder(value) {
  const text = String(value || "").toLowerCase();
  return text.includes("your-") || text.includes("your_") || text.includes("YOUR_") || text.includes("YOUR-");
}

function createCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);
  const serviceAccountJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || "").trim();

  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    return {
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id || projectId,
    };
  }

  if (looksLikePlaceholder(clientEmail) || looksLikePlaceholder(privateKey) || !clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or both FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in server/.env using the service account JSON from Firebase Console."
    );
  }

  return {
    credential: cert({ projectId, clientEmail, privateKey }),
    projectId,
  };

  return {
    credential: applicationDefault(),
    projectId,
  };
}

export async function connectDB() {
  if (db) return db;

  if (!getApps().length) {
    initializeApp(createCredentials());
  }

  auth = getAdminAuth();
  db = getFirestore();

  console.log("Firebase initialized");
  return db;
}

export function getDB() {
  if (!db) throw new Error("DB not initialized. Call connectDB() first.");
  return db;
}

export function getAuthService() {
  if (!auth) throw new Error("Auth not initialized. Call connectDB() first.");
  return auth;
}

export function toPlainDoc(snapshot) {
  if (!snapshot || !snapshot.exists) return null;

  const data = snapshot.data() || {};
  return {
    _id: snapshot.id,
    id: snapshot.id,
    ...data,
  };
}

export function toPlainDocs(snapshot) {
  if (!snapshot || !snapshot.docs) return [];
  return snapshot.docs.map((doc) => toPlainDoc(doc)).filter(Boolean);
}

export async function closeDB() {
  db = null;
  auth = null;
}
