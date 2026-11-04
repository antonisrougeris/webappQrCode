
# SKANARE order simulation (isolated test branch)

This is NOT deployed to main. A dedicated branch-only GitHub Actions workflow
runs fake buyer and order flows using pure backend helpers and an in-memory database.

Does not use real payment, Firestore, BOX NOW, email or production credentials.

The report is available in the workflow job summary and as the
order-flow-dry-run-report artifact (Markdown + JSON).
A source guard detects a suspected finished-A3 payment mismatch and deliberately
fails the workflow when found. Fixing it is separate work, not performed here.

Run manually after installing dependencies from the server directory:
node scripts/simulate-order-flow.mjs

This is an isolated simulation, NOT a complete real-API end-to-end checkout.
