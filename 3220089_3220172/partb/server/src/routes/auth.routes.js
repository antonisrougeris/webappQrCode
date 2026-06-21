/* 3220089_3220172  2025 */

import { Router } from "express";
import { registerUser,login } from "../controllers/auth.controller.js";

const router = Router();

router.post("/login", login);
router.post("/register", registerUser);

export default router;
