# BOX NOW Shipping Monitor — Production

## Objective
The normal BOX NOW webhook path remains unchanged. The monitor is an independent **read-only GET /api/v1/parcels** poller, every 30 minutes, on the backend process. It reconciles missed statuses, alerts admins about stalled pickups/returns/errors and retries email confirmations. It never creates shipments, refunds money, or changes payment status.

## Runtime
- Runs ONLY when `NODE_ENV=production`, `BOXNOW_MODE=production`, and `BOXNOW_MONITOR_ENABLED` is not `false`.
- Default: **enabled** in production. To disable safely set `BOXNOW_MONITOR_ENABLED=false` in the private server.env, then restart PM2. No new API credentials needed.
- Starts ~2 minutes after server readiness and polls every 30 minutes; runs at most 40 eligible orders per cycle, prioritizing orders not recently checked.
- Firestore lease `operational_jobs/boxnow_shipping_monitor` prevents overlapping scheduler instances.
- Queries production BOX NOW orders from Firestore via the existing `shipping.boxnow.environment` index. Filters for paid BOX NOW orders only.
- Logs: `boxnow_monitor_started`, `boxnow_monitor_completed`, `boxnow_monitor_reconciled`, `boxnow_monitor_terminal_stopped`, `boxnow_monitor_lookup_failed`, `boxnow_monitor_alert_failed`.

## Reconciliation safety
- Uses the existing authenticated BOX NOW API client `getBoxNowParcel`; never fetches stage parcels.
- Validates the actual returned parcel ID, BOX NOW orderNumber (if present), payment status, shipment environment and stored parcel ID before writing.
- Never accepts an API event older than or equal to the latest stored `shipping.boxnow.lastEventAt`.
- `delivered`: `fulfillmentStatus=completed`, `completionSource=boxnow_api_reconciliation`, completed timestamps and existing delivered-order email function. A missing email is retried separately.
- Terminal non-delivery (`returned`, `expired`, `cancelled`, `lost`, `missing`): writes `shipping.monitor.attentionRequired=true`; preserves fulfillment/payment and **never** refunds.
- For **cancelled / returned** only, once the final event is recorded and the existing admin review-alert document has `sentAt`, store `shipping.monitor.terminalMonitoringEvent` and `shipping.monitor.terminalMonitoringStoppedAt`. Future 30-minute runs exclude that parcel. Existing sent alerts also qualify; no duplicate alert is generated.
- If the admin email is missing, failed or still in-flight, polling continues until an alert is confirmed. `expired`, `missing`, and `lost` continue to be checked because their disposition may change.
- Webhooks remain active independently; a newer, different provider event automatically re-enables monitoring. No refunds or payment-status changes are made.
- `final-destination`: alerts admin if locker has been waiting >24 hours. A customer reminder is sent ONLY when the provider sends a parsable explicit pickup deadline and <24h remain; no guessed locker expiry or auto-extension.
- Provider errors: after 3 consecutive attempts, email admin at most once per day. A provider-vs-Firestore change also generates a one-time admin notification.
- Admin/recipient notifications use Firestore alert claims under `boxnow_shipping_monitor_alerts` and are retried after a 15-minute claim lease if sending fails.
- Reconciliation status is persisted in `shipping.monitor.*` and tracking history `shipping.boxnow.eventHistory` (max 30).
- This is periodic recovery, not real-time; webhooks remain primary source.

## Rollout checks
1. Confirm current `BOXNOW_MODE=production`, `NODE_ENV=production`, `ADMIN_EMAIL` configured, and use rotated secrets; **never paste any secrets into chat/logs**.
2. GitHub PR tests (including `boxnow-monitor-policy.test.js`) and CI frontend/backend checks must pass before merge.
3. Verify deploy and `pm2 logs skanare-api --lines 200 --nostream | grep 'boxnow_monitor_'`. Scheduler should start; allow 2+ minutes for initial run.
4. Confirm `operational_jobs/boxnow_shipping_monitor` `finishedAt` updates and `shipping.monitor.lastCheckedAt` advances on eligible real orders. Do not inject fake signed webhooks into production.
5. Observe `boxnow_shipping_monitor_alerts` for a legitimate alert; do not artificially change customer parcel states for testing.
6. To pause monitor at any time add `BOXNOW_MONITOR_ENABLED=false` to `/srv/skanare/shared/server.env` and restart `pm2 restart skanare-api`. Keep BOX NOW webhook online.
7. Historical production parcel `6704219453` may not be found by BOX NOW Parcel API; if so, the monitor will count API failures and alert admin, but **will not fabricate delivery**.
