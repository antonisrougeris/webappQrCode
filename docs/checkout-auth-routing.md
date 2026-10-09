# Automatic checkout authentication routing

PR #58 (`73fa9f9`) removed the account-status endpoint and replaced the historical
conditional login/register redirect with an unconditional login redirect. This
restores the behavior from `c5debde`, preserving the later opt-in tip and euro
savings changes.

The guest checkout saves its existing draft, normalizes the email, and POSTs to
`/api/auth/account-status`. Firebase Admin `getUserByEmail` is the authoritative,
read-only lookup. Only `auth/user-not-found` means registration. Existing Auth
accounts route to login even without a Firestore profile; orphaned Firestore
profiles do not imply an authentication account. The existing authenticated
login/profile-sync logic handles missing profiles after identity verification.
Invalid input returns 400. Other lookup errors return 503; the customer stays on
checkout with their draft and an English/Greek retry message. An invalid API
response is also an error, never an implicit negative lookup.

`email`, `firstName`, `lastName`, and the validated localized checkout redirect
use the existing auth query parameters. Login/register prefill and cross-links
are unchanged. Registration has no phone field, so the phone remains in the
checkout draft. The existing localStorage draft stores delivery/locker, invoice
address, gift options and explicit tip choice. Recovery codes keep their separate
storage key. Guest products, quantities and variants continue through the
existing server-side cart merge. The checkout/payment endpoint remains
responsible for authoritative totals. No passwords, tokens, or payment details
are added to URLs. Terms must be accepted again on return, as before; new accounts
still complete email verification before payment. The submit button is restored
before navigation so browser Back can reuse the form.

## Security tradeoff

Automatic routing intentionally discloses whether an email has a Firebase Auth
account. This is an explicitly accepted product requirement, not a claim that
enumeration has been eliminated. The endpoint returns only a boolean and has
`Cache-Control: no-store`. Existing global API/auth rate limits, CSRF, credential
isolation, authorization and verification remain enabled. An additional budget
of 20 lookups per IP per 15 minutes logs `checkout_account_status_rate_limited`
without the submitted email. Monitor this event and endpoint 429/503 rates using
the existing request/PM2 logs. Distributed enumeration remains possible, and the
in-memory limit is per server process. Non-sensitive prefill fields remain visible
in browser history as in the prior flow. The source audit now reports this risk
explicitly instead of checking only the obsolete `/check-email` route.

## Regression checks

- `client`: `npm test` executes the actual checkout routing, API parsing,
  login/register prefill/cross-links and draft functions with controlled fixtures.
- `server`: `npm test` covers Auth/profile mismatches, normalization, invalid
  input, Firebase outages and the existing cart merge with quantities/variants,
  plus the existing pricing, tip, localization, payment and security regressions.
- `npm run build` includes TypeScript, Vite, product prerendering and Greek pages.
- `node ops/security-audit/run-audit.mjs`, backend syntax checks and CI dependency
  audits/CodeQL remain enabled. Frontend routing tests now run in CI.
- Browser validation uses the built pages in Chromium, both locales and mobile/
  desktop, with fixture Firebase/API responses. This validates the UI flow, not
  delivery of real verification email, a real user's password, or a Viva charge.
