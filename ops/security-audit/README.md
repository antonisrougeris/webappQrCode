# Skanare security audit

The repository vendors Cloudflare's `security-audit-skill` under
`.agents/skills/security-audit/`.

`run-audit.mjs` is the deterministic CI regression layer built from the
source-first findings we validated for Skanare. It intentionally does not
pretend that a static script is an AI auditor.

The GitHub Actions workflow:

1. runs the Skanare-specific security invariants;
2. runs production dependency audits for frontend and backend;
3. writes a Markdown report to the GitHub job summary;
4. uploads the Markdown and JSON reports as artifacts.

A fresh source audit should still use the vendored Cloudflare skill whenever
authentication, payments, admin boundaries, deployment, or other trust
boundaries change.
