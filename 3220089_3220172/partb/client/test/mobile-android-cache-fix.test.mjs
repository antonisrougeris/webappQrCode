import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const css=readFileSync("public/assets/css/product-mobile-immersive.css","utf8");
const html=readFileSync("src/pages/product-details/product-details.html","utf8");
const vite=readFileSync("vite.config.js","utf8");
test("Android layouts keep title and subtitle full-width",()=>{
 assert.match(css,/"title title" "meta meta"/);
 assert.match(css,/word-break:normal/);
 assert.match(css,/grid-area:price; justify-self:end/);
});
test("mobile eco tags use short readable labels only",()=>{
 assert.match(html,/100% Organic Cotton/);
 assert.match(html,/Quality Print · Made in Greece/);
 assert.match(css,/\.pdp-eco-compact \{\s*display:inline-flex!important/);
 assert.match(css,/font-size:clamp\(10px,2\.65vw,12px\)/);
});
test("all production HTML pages fingerprint public stylesheet contents",()=>{
 assert.match(vite,/transformIndexHtml\(html\)/);
 assert.match(vite,/createHash\("sha256"\)/);
 assert.match(vite,/public\/assets\/css/);
 assert.match(vite,/apply: "build"/);
});
