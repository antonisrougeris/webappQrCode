# BOX NOW shipping status — event-driven (production)

The previous 30-minute Firestore poller has been removed. The new design
performs **no scheduled Firestore reads or writes while idle**.

## What triggers a check
- Signed BOX NOW provider webhooks update the order immediately; these remain
  the primary status source and do not need an extra provider API query.
- After successful Viva payment creates a **production** BOX NOW parcel,
  a one-time lookup checks the newly created shipment only.
- Actual Admin fulfillment-status changes, manually saving a new parcel ID,
  and sending a shipment also trigger a one-time lookup of that order only.
- Admin can manually select **Check BOX NOW status** in the order details at
  any time; this calls authenticated `POST /api/admin/orders/:id/boxnow/check`.

All checks validate paid status, BOX NOW delivery, production environment,
recorded parcel ID and the provider's actual ID/order number. The existing
FireStore transaction + one-time alert claim prevent duplicate notifications.
No automatic refund or payment status change is made.

## Important recovery tradeoff
A missed provider webhook will **not** be recovered automatically on a timer
after a shipment becomes idle. Admin can manually check the affected order.
Provider delivery emails, pickup reminders and return alerts triggered by
the previous scheduled recovery will now run only after a webhook or a
targeted check. For automatic delayed reminders in a future high-volume
installation, use durable **per-shipment** scheduled jobs (e.g., Cloud Tasks),
not a global Firestore scanner. Do not reintroduce periodic all-order polling.

## Monitoring
- Backend logs: `boxnow_order_checked`, `boxnow_event_check_failed`,
  `boxnow_monitor_lookup_failed` and existing webhook tracking logs.
- Firebase Firestore Usage: idle scheduled BOX NOW reads/writes should approach
  zero. Newly created shipments and manual status changes generate a small,
  bounded number of reads/writes.
- If carrier API is unavailable, an event-triggered check logs the failure and
  does not roll back Viva paid transactions or Admin status transitions.
- No longer uses `operational_jobs/boxnow_shipping_monitor` lease.
