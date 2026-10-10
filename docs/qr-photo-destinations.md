# Dynamic QR: links and photos (feature branch, not deployed)

## Why the first local scan showed "Route not found"

The initial upload saved `targetUrl=https://skanare.com/api/qr-photo/view/<shortId>`.
The QR scanner reached the *production* Cloud Function and then the production
website, whose backend does not yet include the feature branch's new routes.
A local backend cannot serve that public production URL.

The revised design avoids requiring the production Express backend for QR scans.
The Cloud Function checks `destinationType` and reads the photo directly from
Firebase Storage when a QR is scanned. Links keep their existing 302 behavior.
It serves the HTML image page at the original QR URL, then its photo at that
**same QR URL with `?photo=1`**. No new Firebase Hosting rewrite is needed.
Only the HTML request increments `scans`.

The Express backend **retains the last valid link in `targetUrl`** when the
user selects photo mode, rather than pointing it at an undeployed production
route. Once the updated Cloud Function is deployed, `destinationType=photo`
takes precedence over `targetUrl`. This also supports records created by the
initial implementation, where `targetUrl` still points at the old route.

## New Cloud Function source

- `firebase/functions/index.js`: `redirectQr`, including legacy `/q/:id`.
- `firebase/functions/qr-photo-utils.js`: path validation and photo status checks.
- `firebase/functions/test/redirectQr.test.js`: unit tests.
- `firebase/functions/package.json`: Node.js 22, Firebase Admin and Functions.
- `firebase/firebase.json`: registers the function source directory.

The QR redirect domain must **continue routing its existing QR paths to
`redirectQr`**. The Hosting configuration for that domain is not included
in this repository; do not overwrite its rewrites blindly.

## Local verification without production changes

From the repository root:

```powershell
git pull --ff-only
cd firebase/functions
npm install
npm test
```

For the frontend/backend, keep the existing local setup and use a **test
Firebase project or test QR**. The photo preview uses an authenticated
`GET /api/qr-photo/preview/:qrId` endpoint, including when the saved photo
is not the active QR destination. JPEG, PNG and WebP up to 5 MB are supported.

A phone scanning a **real production QR** will keep using the **currently
deployed** Cloud Function. Updating local code alone cannot change that.
For a true end-to-end scan before release, deploy to a separate staging Firebase
project and Hosting domain, or use the Firebase emulators with appropriate
rewrites and an isolated test project.

## Deployment later, only after explicit approval

From `firebase/` (after verifying the Firebase project and QR Hosting routing):

```powershell
firebase deploy --only functions:redirectQr --project YOUR_VERIFIED_PROJECT_ID
```

**Do not run this during local testing.** It changes the live Cloud Function
if you target the production project. Coordinate the backend release and the
Cloud Function release; verify the configured default Storage bucket and
its permissions before any release. No deployment has been performed.

## Data and privacy

- Private Firebase Storage path: `qr-photos/{uid}/{qrId}/{uuid}`.
- Upload and owner preview require a valid Firebase auth token.
- The scanned photo is intentionally visible to anyone holding the QR.
- Returned QR codes revoke photo access; old photo files are cleaned up.
- The same printed QR can switch between link and photo without reprinting.
- The Cloud Function rejects invalid/returned photo records and does not
  serve arbitrary Storage paths.
