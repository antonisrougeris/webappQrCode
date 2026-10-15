import test from "node:test";
import assert from "node:assert/strict";
import { versionStylesheetLinks, fingerprintedStylesheetName } from "../scripts/version-css.mjs";

test("content fingerprint changes if and only if CSS bytes change", () => {
  const a = fingerprintedStylesheetName("components.css", Buffer.from(".a{color:red}"));
  const b = fingerprintedStylesheetName("components.css", Buffer.from(".a{color:blue}"));
  assert.match(a, /^components\.[a-f0-9]{12}\.css$/);
  assert.notEqual(a,b);
  assert.equal(a, fingerprintedStylesheetName("components.css", Buffer.from(".a{color:red}")));
});

test("built pages reference immutable files rather than stale ?v= URLs", () => {
  const names = { "components.css":"components.abcdef012345.css", "layout.css":"layout.123456abcdef.css" };
  const html = [
    '<link rel="stylesheet" href="/assets/css/components.css?v=20261012-header-menu-1">',
    '<link href="/assets/css/layout.css?v=older#theme" rel="stylesheet">',
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Inter">',
    '<link rel="stylesheet" href="/assets/index.123.css">',
  ].join("\n");
  const result=versionStylesheetLinks(html,names);
  assert.match(result,/components\.abcdef012345\.css/);
  assert.match(result,/layout\.123456abcdef\.css#theme/);
  assert.doesNotMatch(result,/20261012-header-menu-1/);
  assert.match(result,/https:\/\/fonts.googleapis.com/);
  assert.match(result,/\/assets\/index\.123\.css/);
  assert.equal(versionStylesheetLinks(result,names),result);
});
