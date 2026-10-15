import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const read = name => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8");

test("completed account orders mark the progress track as fully complete", () => {
  const main = read("../src/main.ts");
  assert.ok(main.includes('status === "completed" ? " is-fully-complete" : ""'));
});

test("desktop completion track fills to the final dot", () => {
  const css = read("../src/boxnow-tracking.css");
  assert.ok(css.includes(".account-order__progress.is-fully-complete::before {\n  background: #111;"));
});

test("mobile connectors do not extend after the last dot", () => {
  const css = read("../src/boxnow-tracking.css");
  assert.ok(css.includes(".account-order__progress::before {\n    display: none;"));
  assert.ok(css.includes(".account-order__step:not(:last-child)::after {"));
  assert.ok(css.includes(".account-order__step:last-child::after {\n    display: none !important;"));
});
