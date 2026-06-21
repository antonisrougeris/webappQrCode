/* 3220089_3220172  2025 */

import { Router } from "express";
import { registerUser, listUsers, getUserById } from "../controllers/users.controller.js";
import { getMyProfile } from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

//  list/get protected
router.get("/", requireAuth, listUsers);
router.get("/me", requireAuth, getMyProfile); 
router.get("/:id", requireAuth, getUserById);
router.post("/", registerUser);

export default router;
