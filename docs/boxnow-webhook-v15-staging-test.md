# BOX NOW Webhook v1.5: staging delivery test

## What BOX NOW confirmed
The BOX NOW technical team registered a webhook URL for their **stage** environment and activates callbacks manually. Their test parcel is **6423451087**. Confirm which exact URL they registered before requesting the event.

The public webhook remains POST `https://skanare.com/api/boxnow/webhook`.

## Environment separation
In the *production* backend, keep `BOXNOW_MODE=production` and the existing `BOXNOW_WEBHOOK_SECRET` (production secret). To receive staging callbacks at the same URL, set **`BOXNOW_STAGE_WEBHOOK_SECRET`** to the separate staging signing secret obtained privately from BOX NOW. Never swap the production secret for staging or share secrets by email.

The backend chooses the environment from the HMAC-SHA256 signature of the exact **raw data object**, not the sender or a user-controlled field. Valid stage events update only `boxnow_stage_webhook_events/{parcelId}`; they do not update production orders or send customer emails. Valid production events continue updating matched Firestore orders, with `delivered` setting `fulfillmentStatus=completed`.

If the app itself runs against a separate BOXNOW_MODE=stage environment, its configured `BOXNOW_WEBHOOK_SECRET` is treated as a staging key.

## Stage test procedure
1. Deploy the change; configure `BOXNOW_STAGE_WEBHOOK_SECRET` in the protected backend server.env (do not commit the value) and restart PM2. Keep `BOXNOW_MODE=production`.
2. Ensure BOX NOW registered `https://skanare.com/api/boxnow/webhook` in **stage**. Ask their team to activate staging delivery and send the test lifecycle for **6423451087**; a `delivered` event is needed to validate completion.
3. Watch the reverse proxy access log for `POST /api/boxnow/webhook` (expect 200 for a valid, stored event) and the backend process logs for `BOX NOW staging webhook`.
4. While signed in as a Skanare administrator, GET `/api/admin/boxnow/staging/6423451087` with the existing authenticated API request. The response reports `lastEvent`, `lastEventAt`, `lastWebhookReceivedAt`, and a bounded history; it has no recipient data.
5. Expect `lastEvent: "delivered"`. A 200 and a matching last event prove that the BOX NOW callback reached the server, authenticated, and was persisted. A missing record means the test request has not yet been successfully processed.
6. Do **not** expect a customer order in production to show `completed` for BOX NOW's standalone stage parcel: only events signed with the production key can change production orders. Test live order completion separately with a production shipment once BOX NOW enables production webhooks.

## Event contract from v1.5
Use `data.event` rather than `data.parcelState` and `data.time` to suppress stale/duplicate events. `final-destination` means waiting at locker; **only** `delivered` completes the e-shop order. Not every event includes `eventLocation`. BOX NOW retries failed deliveries and expects HTTP **200** after successful processing.

## Troubleshooting
- **401**: staging signing secret missing/wrong, altered raw JSON, or mismatched signature.
- **400**: malformed payload, missing or invalid event time, or invalid staging parcel ID.
- **200** with `processed:false`: duplicate/older event, not necessarily a failure.
- **404** on admin endpoint: verify authentication/admin permissions or routing; the endpoint returns `parcel:null` (HTTP 200) when no stage event was received.
- A valid production webhook with `order_not_found` returns 200, but no customer order changes. Check the BOX NOW orderNumber and parcelId association.
