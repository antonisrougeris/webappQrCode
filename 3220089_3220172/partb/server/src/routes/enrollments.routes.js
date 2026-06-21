/* 3220089_3220172  2025 */

import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  createEnrollment,
  listMyEnrollments,
  unenrollFromCourse,
} from "../controllers/enrollments.controller.js";

const router = Router();

router.post("/", requireAuth, createEnrollment);
router.get("/me", requireAuth, listMyEnrollments);
router.delete("/:courseId", requireAuth, unenrollFromCourse);

export default router;
