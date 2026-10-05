import fs from "node:fs";

const files = [
  ["Frontend", "security-audit-output/frontend-npm-audit.json"],
  ["Backend", "security-audit-output/backend-npm-audit.json"],
];

const rows = [];

for (const [label, file] of files) {
  if (!fs.existsSync(file)) {
    rows.push({
      label,
      critical: "?",
      high: "?",
      moderate: "?",
      low: "?",
    });
    continue;
  }

  const audit = JSON.parse(
    fs.readFileSync(file, "utf8")
  );

  const vulnerabilities =
    audit.metadata?.vulnerabilities || {};

  rows.push({
    label,
    critical:
      vulnerabilities.critical ?? 0,
    high:
      vulnerabilities.high ?? 0,
    moderate:
      vulnerabilities.moderate ?? 0,
    low:
      vulnerabilities.low ?? 0,
  });
}

const markdown = `
## Dependency audit

| Package set | Critical | High | Moderate | Low |
|---|---:|---:|---:|---:|
${rows
  .map(
    (row) =>
      `| ${row.label} | ${row.critical} | ${row.high} | ${row.moderate} | ${row.low} |`
  )
  .join("\n")}

Dependency findings are reported for triage. Existing SKANARE CI continues to block **critical** npm advisories. High/moderate dependency advisories are kept visible here because forcing incompatible transitive upgrades can be riskier than a controlled package upgrade.
`;

process.stdout.write(markdown);

if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    markdown
  );
}

fs.writeFileSync(
  "security-audit-output/dependency-audit-summary.md",
  markdown
);
