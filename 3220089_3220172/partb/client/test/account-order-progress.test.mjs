import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = name => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

test("completed account orders mark the progress track as fully complete", () => {
  const main = read("../src/main.ts");
  assert.match(main, /account-order__progress\\$\\{status === "completed" \\? " is-fully-complete" : ""\\}/);
});

test("desktop progress fills through final Completed dot", () => {
  const css = read("../src/boxnow-tracking.css");
  assert.match(css, /\\.account-order__progress\\.is-fully-complete::before\\s*\\{\\s*background:\\s*#111/);
});

test("mobile connectors end at last dot, not below it", () => {
  const css = read("../src/boxnow-tracking.css");
  assert.match(css, /\\.account-order__progress::before\\s*\\{\\s*display:\\s*none/);
  assert.match(css, /\\.account-order__step:not\\(:last-child\\)::after/);
  assert.match(css, /\\.account-order__step:last-child::after\\s*\\{\\s*display:\\s*none !important/);
});
