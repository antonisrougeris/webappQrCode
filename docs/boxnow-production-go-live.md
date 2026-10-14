# BOX NOW Production Webhook Go-Live Checklist

Staging proof (2026-10-14, parcel 6423451087): signed `in-depot`, `final-destination`, `delivered` webhooks were persisted in `boxnow_stage_webhook_events`. That confirms the staging callback pipeline, not a production order transition.

## Before requesting production activation
- Rotate credentials disclosed in chat and update protected VPS secrets; **never post or commit keys**. Arrange rotation so API and payment/email integrations remain operational.
- Verify the latest release has deployed via GitHub CI, `readlink -f /srv/skanare/current`, `/api/health/ready`, and PM2.
- Keep `BOXNOW_MODE=production`, `BOXNOW_API_URL` pointing to the production API, `BOXNOW_WEBHOOK_SECRET` set to the separate production signing secret, and optionally `BOXNOW_STAGE_WEBHOOK_SECRET` to the stage signing secret.
- The production callback URL is `https://skanare.com/api/boxnow/webhook` (POST, application/json, TLS).
- Production webhook events are checked for valid HMAC over the exact raw `data` object, the paid BOX NOW order number and stored parcelId (including legacy fields) and production environment.
- The shipping state follows `data.event`; `final-destination` is awaiting locker pickup, `delivered` completes order.
- A bounded `shipping.boxnow.eventHistory` stores the last 30 valid production events (no customer PII).

## Provider activation / operational test
1. Ask BOX NOW ICT to register/confirm the production callback (staging is already proven). Ask for their production webhook delivery log and a safely controlled production test / event resend if supported.
2. For existing production parcel **6704219453**, query the production Parcel API READ-ONLY. If the parcel was delivered before activation, enabling webhooks usually will NOT automatically backfill historic events. Request an official replay if available; otherwise plan a verified one-off reconciliation, not a fabricated webhook.
3. Watch `sudo grep 'POST /api/boxnow/webhook' /var/log/nginx/access.log | tail -20` and `pm2 logs skanare-api --lines 120 --nostream`. Confirm a legitimate signed production event returns HTTP 200 and is logged as processed; never infer successful processing from a generic 200 alone.
4. For a real authorized, paid and shipped order, check Firestore `orders/{id}`: `shipping.status=delivered`, `shipping.boxnow.lastEvent=delivered`, `fulfillmentStatus=completed`, `completionSource=boxnow_webhook`, `completedAt`, `history` and `shipping.boxnow.eventHistory`.
5. Check the signed-in customer's account: "Completed" in fulfillment progress; "Your parcel has been delivered"/"Το δέμα σας παραδόθηκε" below BOX NOW tracking; link opens official BOX NOW tracking.
6. Check delivered-order email delivery. Repeated or old webhooks should not duplicate fulfillment history or regress the displayed status.
7. If a confirmed production event returns 409 parcel mismatch, investigate the stored order/parcel association BEFORE forcing any completion. Do not modify Firestore manually to conceal a routing problem.
