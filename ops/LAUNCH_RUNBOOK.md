# Skanare launch operations runbook

## Production topology

- Public site: `https://skanare.com`
- Public API health: `https://skanare.com/api/health`
- Readiness: `https://skanare.com/api/health/ready`
- Liveness: `https://skanare.com/api/health/live`
- Nginx frontend root: `/srv/skanare/current/client/dist`
- PM2 backend: `/srv/skanare/current/server/src/app.js`
- Backend binds to loopback by default: `127.0.0.1:4000`
- Persistent runtime configuration: `/srv/skanare/shared/server.env`
- Persistent generated exports: `/srv/skanare/shared/exports`
- Releases: `/srv/skanare/releases/<git-sha>`

## Launch monitoring

Create external checks for:

1. `GET https://skanare.com/` — 2xx, every 1 minute.
2. `GET https://skanare.com/api/health/ready` — 2xx, every 1 minute.
3. TLS certificate expiry — warning at 21 days, critical at 7 days.
4. VPS CPU — sustained > 85% for 10 minutes.
5. VPS memory — > 90% used for 10 minutes.
6. Root filesystem — warning > 80%, critical > 90%.
7. Inodes — warning > 80%, critical > 90%.
8. Load average — sustained above CPU core count for 10 minutes.
9. Nginx service not active.
10. PM2 `skanare-api` not online or repeated restarts.
11. HTTP 5xx rate and API p95 latency.
12. Application error logs for Viva, BOX NOW, Resend and unhandled errors.

Use email as the primary alert channel. Avoid alerting on a single transient failure:
external uptime should require at least two consecutive failed checks where the
provider supports it.

## Fast server checks

```bash
curl -fsS https://skanare.com/api/health/ready
systemctl is-active nginx
pm2 status
df -h /
df -i /
free -h
uptime
```

## Deployment verification

After every production release:

```bash
readlink -f /srv/skanare/current
pm2 describe skanare-api
curl -fsS http://127.0.0.1:4000/api/health/ready
curl -fsS https://skanare.com/api/health/ready
curl -fsSI https://skanare.com/
curl -fsSI https://skanare.com/login
curl -fsSI https://skanare.com/products
```

The GitHub deployment workflow performs readiness/public smoke checks and rolls
back to the previous release if they fail.

## Backup requirements before launch

Keep backups outside the VPS.

- Firestore: schedule managed exports to a dedicated Google Cloud Storage bucket.
- Firebase Storage: enable an independent backup/versioning policy for customer
  and generated assets.
- `/srv/skanare/shared/server.env`: encrypted off-server copy.
- `/srv/skanare/shared/exports`: off-server copy.
- Nginx configuration: `/etc/nginx`.
- PM2 process definition/dump: `~/.pm2/dump.pm2`.
- Keep a VPS snapshot for fast machine recovery, but do not treat a VPS snapshot
  as the only database backup.

Run a restore test before launch and after material infrastructure changes.

## Incident priorities

### P1
- site unavailable
- API unavailable
- payment state incorrect
- paid order not recorded
- suspected credential compromise

### P2
- BOX NOW delivery creation failure after successful payment
- transactional email failure
- admin unavailable while storefront still works

### P3
- individual product/SEO/display issue

For P1 payment incidents, preserve logs and order/payment identifiers before
manual changes. Never mark an order paid based only on the browser success page.

## Security checklist

- Production CORS contains only intended storefront origins.
- `NODE_ENV=production`.
- `HOST=127.0.0.1` or omitted (loopback is the application default).
- Firebase Admin credentials exist only in the protected server environment.
- Firestore and Storage client rules are deployed and tested.
- BOX NOW and Viva production credentials are server-side only.
- GitHub Actions secrets are not repository variables.
- Stage/test credentials and test routes are disabled in production.
- Secret scanning and CodeQL alerts are reviewed before launch.
- Generated exports are never committed to Git.

## Email/DNS launch checklist

In Resend, verify the sending domain and confirm all required DNS records are
green. In DNS verify:

- SPF record required by the mail provider
- DKIM records required by the mail provider
- DMARC record for the organizational domain

Start DMARC with a reporting policy appropriate for the current mail setup,
review reports, then tighten it after all legitimate senders are aligned.

Test at minimum:

- account verification
- password reset
- paid order confirmation to customer
- new paid order notification to admin
- shipped/tracking notification

Do not log OTPs, passwords, API keys, webhook secrets, or full payment payloads.
