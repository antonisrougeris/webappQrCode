import test from "node:test";
import assert from "node:assert/strict";
import { versionStylesheetLinks, CSS_VERSION } from "../scripts/version-css.mjs";

test("versions all local stylesheet hrefs and replaces stale query versions", () => {
  const html = [
    '<link rel="stylesheet" href="/assets/css/reset.css">',
    '<link rel="stylesheet" href="/assets/css/theme.css?v=old">',
    '<link rel="stylesheet" href="/assets/css/layout.css">',
    '<link rel="stylesheet" href="/assets/css/components.css?v=20261010-photo">',
    '<link rel="stylesheet" href="./returns.css?v=2.2">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">',
  ].join("\n");
  const result = versionStylesheetLinks(html);
  for (const name of ["reset", "theme", "layout", "components"]) {
    assert.ok(result.includes(`/assets/css/${name}.css?v=${CSS_VERSION}`));
  }
  assert.ok(result.includes(`./returns.css?v=${CSS_VERSION}`));
  assert.ok(result.includes("https://fonts.googleapis.com/css?family=Inter"));
  assert.equal(versionStylesheetLinks(result), result);
});
