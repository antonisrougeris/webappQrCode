import { getDB, getAuthService } from "../config/db.js";
import { COLLECTIONS } from "../constants/collections.js";
import { ApiError } from "../utils/apiError.js";

function nowIso() {
  return new Date().toISOString();
}

export async function registerUser({
  firstName,
  lastName,
  email,
  password,
  idToken,
}) {
  if (!email || !idToken) {
    throw new ApiError(400, "Email and idToken are required");
  }

  const auth = getAuthService();
  const db = getDB();

  const decoded = await auth.verifyIdToken(idToken);

  if (!decoded?.uid) {
    throw new ApiError(401, "Invalid Firebase token");
  }

  if (decoded.email && decoded.email !== email) {
    throw new ApiError(400, "Email does not match authenticated user");
  }

  const userRef = db.collection(COLLECTIONS.USERS).doc(decoded.uid);
  const snap = await userRef.get();

  const existing = snap.exists ? snap.data() : null;

  const userData = {
    uid: decoded.uid,
    email: decoded.email || email,
    firstName: firstName || existing?.firstName || "",
    lastName: lastName || existing?.lastName || "",
    role: existing?.role || "user",
    createdAt: existing?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };

  await userRef.set(userData, { merge: true });

  return userData;
}

export async function loginUser({ email, idToken }) {
  if (!email || !idToken) {
    throw new ApiError(400, "Email and idToken are required");
  }

  const auth = getAuthService();
  const db = getDB();

  const decoded = await auth.verifyIdToken(idToken);

  if (!decoded?.uid) {
    throw new ApiError(401, "Invalid Firebase token");
  }

  if (decoded.email && decoded.email !== email) {
    throw new ApiError(400, "Email does not match authenticated user");
  }

  const userRef = db.collection(COLLECTIONS.USERS).doc(decoded.uid);
  const snap = await userRef.get();

  if (!snap.exists) {
    // αν ο user υπάρχει στο Firebase Auth αλλά όχι στο Firestore, τον φτιάχνουμε
    const newUser = {
      uid: decoded.uid,
      email: decoded.email || email,
      firstName: "",
      lastName: "",
      role: "user",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await userRef.set(newUser);
    return newUser;
  }

  const user = snap.data();

  await userRef.update({
    updatedAt: nowIso(),
  });

  return {
    ...user,
    uid: decoded.uid,
  };
}

export async function getCurrentUser(uid) {
  if (!uid) {
    throw new ApiError(401, "Unauthorized");
  }

  const db = getDB();

  const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();

  if (!snap.exists) {
    throw new ApiError(404, "User not found");
  }

  return {
    uid: snap.id,
    ...snap.data(),
  };
}
