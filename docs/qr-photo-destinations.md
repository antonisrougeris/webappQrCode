# QR photo destinations (feature branch only)

This feature adds photo destinations without changing the printed QR or existing Cloud Function route. New images are saved privately by the backend to Firebase Storage under `qr-photos/{uid}/{qrId}/{uuid}`. Browser uploads to Storage remain disabled.

## Usage
- Go to **My QR Codes** and select **Link** or **Photo** for a purchased QR.
- Photo mode accepts JPEG, PNG or WebP up to 5 MB. Uploading another image replaces the active photo. Your QR code stays unchanged.
- To switch back, select Link and save a URL. The most recent uploaded photo remains saved until replaced.
- Photo scans use the existing Cloud Function 302 redirect to `https://skanare.com/api/qr-photo/view/{publicId}`, which displays only the photo.
- The existing Cloud Function still increments scans. No new Firebase Function or frontend Storage rules required for this implementation.

## Before release
- Ensure `PUBLIC_SITE_URL=https://skanare.com` (or `SITE_URL`) for the backend.
- The Firebase service account must have permission to upload/read/delete objects in the configured `FIREBASE_STORAGE_BUCKET`.
- Nginx must proxy `/api/` to the backend, as it already does.
- Test sign-in, upload, access control, link ↔ photo switching, replacing image, photo on a mobile scan, cache invalidation, and legacy QR IDs.
- The provided Cloud Function code is retained unchanged in production; its redirect to stored `targetUrl` is sufficient.
- The QR photo is **public to anyone who scans the QR**; avoid uploading sensitive photos.
- New or additional configuration and Cloud Function deployment should be reviewed separately before merging.
