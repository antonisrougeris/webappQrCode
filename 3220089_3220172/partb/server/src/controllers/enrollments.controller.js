/* 3220089_3220172  2025 */

import { getDB } from "../config/db.js";

function enrollmentId(userId, courseId) {
  return `enrollment_${userId}_${courseId}`;
}

export async function createEnrollment(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    const { courseId } = req.body;

    if (!userId || !courseId) {
      return res.status(400).json({ error: true, message: "Missing userId or courseId" });
    }

    const [userSnapshot, courseSnapshot] = await Promise.all([
      db.collection("users").doc(userId).get(),
      db.collection("courses").doc(String(courseId)).get(),
    ]);

    if (!userSnapshot.exists) return res.status(404).json({ error: true, message: "User not found" });
    if (!courseSnapshot.exists) return res.status(404).json({ error: true, message: "Course not found" });

    const id = enrollmentId(userId, String(courseId));
    const existing = await db.collection("enrollments").doc(id).get();
    if (existing.exists) {
      return res.status(409).json({ error: true, message: "Already enrolled" });
    }

    await db.collection("enrollments").doc(id).set({
      userId,
      courseId: String(courseId),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ message: "Enrollment successful", enrollmentId: id });
  } catch (err) {
    next(err);
  }
}

export async function listMyEnrollments(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");

    if (!userId) {
      return res.status(401).json({ error: true, message: "Unauthorized" });
    }

    const snapshot = await db.collection("enrollments").where("userId", "==", userId).get();
    const enrollments = snapshot.docs.map((doc) => ({ _id: doc.id, id: doc.id, ...doc.data() }));
    enrollments.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));

    res.json(enrollments);
  } catch (err) {
    next(err);
  }
}

export async function unenrollFromCourse(req, res, next) {
  try {
    const db = getDB();
    const userId = String(req.user?.sub || "");
    if (!userId) return res.status(401).json({ error: true, message: "Unauthorized" });

    const id = enrollmentId(userId, String(req.params.courseId || ""));
    const ref = db.collection("enrollments").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists) {
      return res.status(404).json({ error: true, message: "Enrollment not found" });
    }

    await ref.delete();
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}