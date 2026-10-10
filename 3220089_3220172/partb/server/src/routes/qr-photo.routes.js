import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ok } from "../utils/response.js";
import { ApiError } from "../utils/apiError.js";
import {
  QR_PHOTO_MAX_BYTES,
  uploadQrPhotoForUser,
  getQrPhotoStream,
  getOwnedQrPhotoStream,
  findPublicQrPhoto,
} from "../services/qr-photo.service.js";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: QR_PHOTO_MAX_BYTES, files: 1, fields: 0, parts: 1 },
});

router.post("/:qrId", requireAuth, (req, res, next) => {
  upload.single("photo")(req, res, (error) => {
    if (error) return next(new ApiError(400, "Invalid photo upload (max 5 MB)."));
    next();
  });
}, asyncHandler(async (req, res) => {
  const qrCode = await uploadQrPhotoForUser({
    userId: req.user.uid,
    qrId: req.params.qrId,
    file: req.file,
  });
  return ok(res, { qrCode });
}));

router.get("/preview/:qrId", requireAuth, asyncHandler(async (req, res, next) => {
  const { stream, contentType } = await getOwnedQrPhotoStream(req.user.uid, req.params.qrId);
  res.set({
    "Content-Type": contentType,
    "Cache-Control": "no-store, private, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  stream.on("error", (error) => {
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
  stream.pipe(res);
}));

router.get("/image/:publicId", asyncHandler(async (req, res, next) => {
  const { stream, contentType } = await getQrPhotoStream(req.params.publicId);
  res.set({
    "Content-Type": contentType,
    "Cache-Control": "no-store, private, max-age=0",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": "inline",
    // Local Vite and API use different ports (different origins).
    "Cross-Origin-Resource-Policy": "cross-origin",
  });
  stream.on("error", (error) => {
    if (!res.headersSent) next(error);
    else res.destroy(error);
  });
  stream.pipe(res);
}));

router.get("/view/:publicId", asyncHandler(async (req, res) => {
  const qr = await findPublicQrPhoto(req.params.publicId);
  const id = encodeURIComponent(qr.shortId || qr.id);
  res.set({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, private, max-age=0",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
  });
  // The URL is made from a validated Firestore ID; no user-controlled HTML is rendered.
  res.send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Photo · Skanare QR</title><style>
html,body{padding:0;margin:0;min-height:100%;background:#111;color:#fff}
body{display:grid;place-items:center;min-height:100svh}
img{display:block;max-width:100%;max-height:100svh;object-fit:contain}
</style></head><body><img src="/api/qr-photo/image/${id}" alt="Shared QR photo"></body></html>`);
}));

export default router;
