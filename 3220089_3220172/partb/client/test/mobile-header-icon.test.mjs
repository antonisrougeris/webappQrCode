import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync("public/assets/css/components.css", "utf8");
const menu = readFileSync("src/components/menu.ts", "utf8");
const header = readFileSync("src/components/header.ts", "utf8");
const html = readFileSync("src/pages/product-details/product-details.html", "utf8");

const mobile = css.slice(css.indexOf("@media (max-width: 1050px)"));
const hamburger = mobile.slice(0, mobile.indexOf(".logo {"));

test("mobile hamburger keeps its existing 40x34 layout but not the filled idle background", () => {
  assert.match(hamburger, /width: 40px;\s*height: 34px;/);
  assert.match(hamburger, /background: transparent;\s*color: #111 !important;/);
  assert.match(hamburger, /font-size: 0;/);
  assert.match(hamburger, /position: relative;/);
});

test("three equally spaced lines use the same currentColor as the other icons", () => {
  assert.match(hamburger, /\.menu-toggle::before\s*\{/);
  assert.match(hamburger, /width: 18px;\s*height: 2px;/);
  assert.match(hamburger, /box-shadow: 0 -6px 0 currentColor, 0 6px 0 currentColor;/);
});

test("expanded menu uses a circular black background with white lines", () => {
  assert.match(hamburger, /\.menu-toggle::after\s*\{/);
  assert.match(hamburger, /width: 34px;\s*height: 34px;/);
  assert.match(hamburger, /border-radius: 50%;\s*background: #111;\s*opacity: 0;/);
  assert.match(hamburger, /\.menu-toggle\[aria-expanded="true"\],[\s\S]*?color: #fff !important;/);
  assert.match(hamburger, /html\.nav-open \.menu-toggle::after\s*\{\s*opacity: 1;/);
});

test("the existing menu keeps keyboard and link closing behavior", () => {
  assert.match(menu, /root\.classList\.toggle\(openClass, open\)/);
  assert.match(menu, /toggleBtn\.setAttribute\("aria-expanded", open \? "true" : "false"\)/);
  assert.match(menu, /if \(e\.key === "Escape" && isOpen\(\)\) setOpen\(false\)/);
  assert.match(menu, /if \(link && isOpen\(\)\) setOpen\(false\)/);
  assert.match(header, /id="menuToggle"/);
  assert.match(html, /id="menuToggle"/);
});
