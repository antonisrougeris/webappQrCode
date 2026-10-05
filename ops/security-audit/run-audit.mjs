import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) =>
  fs.readFileSync(path.join(root, relative), "utf8");

const paths = {
  reviews:
    "3220089_3220172/partb/client/src/pages/product-details/product-details.ts",
  checkoutRoute:
    "3220089_3220172/partb/server/src/routes/checkout.routes.js",
  authMiddleware:
    "3220089_3220172/partb/server/src/middleware/auth.js",
  authRoutes:
    "3220089_3220172/partb/server/src/routes/auth.routes.js",
  checkoutClient:
    "3220089_3220172/partb/client/src/pages/checkout/checkout.ts",
  redirect:
    "3220089_3220172/partb/client/src/utils/redirect.ts",
  payment:
    "3220089_3220172/partb/server/src/services/payment.service.js",
  vivaController:
    "3220089_3220172/partb/server/src/controllers/viva.controller.js",
  boxnow:
    "3220089_3220172/partb/server/src/services/boxnow-webhook.service.js",
  adminMiddleware:
    "3220089_3220172/partb/server/src/middleware/admin.js",
  firestore:
    "firebase/firestore.rules",
  storage:
    "firebase/storage.rules",
  app:
    "3220089_3220172/partb/server/src/app.js",
  clientAuth:
    "3220089_3220172/partb/client/src/services/auth.ts",
};

const files = Object.fromEntries(
  Object.entries(paths).map(([key, value]) => [key, read(value)])
);

const checks = [];
function add(id, title, severity, status, evidence, recommendation = "") {
  checks.push({ id, title, severity, status, evidence, recommendation });
}

add(
  "SKN-001",
  "Stored review content is escaped before innerHTML rendering",
  "high",
  files.reviews.includes("safeProductText(review.name)") &&
    files.reviews.includes("safeProductText(review.comment)")
    ? "pass"
    : "fail",
  paths.reviews,
  "Render user-controlled review fields with textContent or HTML escaping."
);

add(
  "SKN-002",
  "Checkout enforces verified email on the server",
  "medium",
  files.checkoutRoute.includes("requireVerifiedEmail") &&
    files.authMiddleware.includes("emailVerifiedByProvider") &&
    files.authMiddleware.includes("snap.data()?.emailVerified !== true")
    ? "pass"
    : "fail",
  paths.checkoutRoute,
  "Keep verified-email policy in server middleware; never rely only on frontend checks."
);

add(
  "SKN-003",
  "Public account-existence endpoint is not exposed",
  "medium",
  !files.authRoutes.includes("/check-email") &&
    !files.checkoutClient.includes("/auth/check-email")
    ? "pass"
    : "fail",
  paths.authRoutes,
  "Avoid returning whether arbitrary email addresses have accounts."
);

add(
  "SKN-004",
  "Auth redirects reject protocol-relative and backslash authority tricks",
  "medium",
  files.redirect.includes('cleaned.startsWith("//")') &&
    files.redirect.includes('cleaned.includes("\\\\")') &&
    files.redirect.includes("parsed.origin !==") &&
    files.redirect.includes("SAFE_REDIRECT_BASE")
    ? "pass"
    : "fail",
  paths.redirect,
  "Normalize with URL parsing and allow only same-origin relative paths."
);

add(
  "SKN-005",
  "Viva paid amount is compared with server-side order total",
  "critical",
  files.payment.includes("Viva amount does not match order total") &&
    files.payment.includes("amount !== expectedAmount")
    ? "pass"
    : "fail",
  paths.payment,
  "Do not fulfill an order unless provider amount equals the server-calculated order total."
);

add(
  "SKN-006",
  "Viva webhook transaction is re-verified with provider",
  "critical",
  files.vivaController.includes("verifyVivaWebhookWithProvider")
    ? "pass"
    : "fail",
  paths.vivaController,
  "Verify transaction/order/status with Viva before marking an order paid."
);

add(
  "SKN-007",
  "BOX NOW webhook uses HMAC and timing-safe signature comparison",
  "high",
  files.boxnow.includes("createHmac") &&
    files.boxnow.includes("timingSafeEqual")
    ? "pass"
    : "fail",
  paths.boxnow,
  "Keep signature verification on exact signed raw data before processing events."
);

add(
  "SKN-008",
  "Direct browser Firestore access is deny-by-default",
  "high",
  files.firestore.includes("allow read, write: if false")
    ? "pass"
    : "fail",
  paths.firestore,
  "Keep browser Firestore access denied unless a narrowly scoped rule is explicitly required."
);

add(
  "SKN-009",
  "Direct browser Storage access is deny-by-default",
  "high",
  files.storage.includes("allow read, write: if false")
    ? "pass"
    : "fail",
  paths.storage,
  "Keep browser Storage access denied unless a narrowly scoped rule is explicitly required."
);

add(
  "SKN-010",
  "Admin authorization is enforced server-side",
  "critical",
  (
    files.adminMiddleware.includes("req.user?.admin") ||
    files.adminMiddleware.includes('user.role !== "admin"')
  )
    ? "pass"
    : "fail",
  paths.adminMiddleware,
  "Protect every admin API route with server-side role enforcement."
);

add(
  "SKN-W01",
  "CSP still permits unsafe-inline scripts",
  "medium",
  /scriptSrc:\s*\[[\s\S]*?\]/.test(files.app) &&
  !/scriptSrc:\s*\[[\s\S]*?unsafe-inline[\s\S]*?\]/.test(files.app)
    ? "pass"
    : "warn",
  paths.app,
  "Use per-request nonces or hashes for any required inline executable scripts."
);

add(
  "SKN-W02",
  "Bearer token is persisted in localStorage",
  "medium",
  files.clientAuth.includes("localStorage.setItem")
    ? "warn"
    : "pass",
  paths.clientAuth,
  "Longer-term hardening: reduce token persistence/exposure to XSS, ideally via an HttpOnly server session if architecture permits."
);

const summary = {
  generatedAt: new Date().toISOString(),
  methodology:
    "Cloudflare security-audit-skill informed source-first regression audit",
  totals: {
    pass: checks.filter((x) => x.status === "pass").length,
    fail: checks.filter((x) => x.status === "fail").length,
    warn: checks.filter((x) => x.status === "warn").length,
  },
  checks,
};

const reportDir = path.join(root, "security-audit-output");
fs.mkdirSync(reportDir, { recursive: true });

fs.writeFileSync(
  path.join(reportDir, "security-audit-findings.json"),
  JSON.stringify(summary, null, 2) + "\n"
);

const icon = (status) =>
  status === "pass" ? "✅" : status === "warn" ? "⚠️" : "❌";

const rows = checks
  .map(
    (x) =>
      `| ${icon(x.status)} ${x.status.toUpperCase()} | ${x.severity.toUpperCase()} | ${x.id} | ${x.title} | ${x.evidence} |`
  )
  .join("\n");

const warnings = checks
  .filter((x) => x.status === "warn")
  .map((x) => `- **${x.id} — ${x.title}:** ${x.recommendation}`)
  .join("\n");

const failures = checks
  .filter((x) => x.status === "fail")
  .map((x) => `- **${x.id} — ${x.title}:** ${x.recommendation}`)
  .join("\n");

const markdown = `# SKANARE Security Audit

Generated: ${summary.generatedAt}

Methodology: **${summary.methodology}**

## Summary

- Passed: **${summary.totals.pass}**
- Failed: **${summary.totals.fail}**
- Warnings / hardening backlog: **${summary.totals.warn}**

## Checks

| Status | Severity | ID | Check | Evidence |
|---|---|---|---|---|
${rows}

## Confirmed failures

${failures || "None."}

## Hardening backlog

${warnings || "None."}

## Scope note

This workflow is a deterministic regression gate derived from the Cloudflare security-audit-skill review. It does not claim to replace a fresh AI/manual source audit, CodeQL, dependency scanning, provider security testing, or production penetration testing.
`;

fs.writeFileSync(
  path.join(reportDir, "security-audit-report.md"),
  markdown
);

process.stdout.write(markdown + "\n");

if (summary.totals.fail > 0) {
  process.exitCode = 1;
}
