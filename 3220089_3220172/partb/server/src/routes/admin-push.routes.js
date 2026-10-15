import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { saveAdminPushToken, deleteAdminPushToken } from "../services/admin-push.service.js";
const router = Router();
router.use(requireAuth, requireAdmin);
router.post("/subscription", async (req, res, next) => {
  try {
    await saveAdminPushToken(req.user.uid, req.body?.token);
    res.json({ success: true });
  } catch (e) { next(e); }
});
router.delete("/subscription", async (req, res, next) => {
  try {
    await deleteAdminPushToken(req.user.uid, req.body?.token);
    res.json({ success: true });
  } catch (e) { next(e); }
});
export default router;
