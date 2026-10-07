import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { assertImageBuffer } from "../utils/fileSignatures.js";
import {
  cancelMyReturn,
  createReturn,
  downloadMyReturnLabel,
  getReturnEligibility,
  listMyReturns,
} from "../controllers/returns.controller.js";

const router = Router();

const returnEvidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 4,
  },
  fileFilter: (_req, file, callback) => {
    const allowed = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error("Only PNG, JPG and WEBP return photos are allowed")
      );
    }

    callback(null, true);
  },
});

router.use(requireAuth);
router.get("/eligibility", getReturnEligibility);
router.get("/", listMyReturns);
router.post(
  "/",
  returnEvidenceUpload.array("evidence", 4),
  (req, _res, next) => {
    try {
      const files = Array.isArray(req.files) ? req.files : [];
      for (const file of files) {
        assertImageBuffer(file.buffer, file.mimetype);
      }
      next();
    } catch (error) {
      next(error);
    }
  },
  createReturn
);
router.post("/:returnId/cancel", cancelMyReturn);
router.get("/:returnId/label", downloadMyReturnLabel);

export default router;
