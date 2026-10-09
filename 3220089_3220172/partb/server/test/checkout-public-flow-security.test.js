import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = path.resolve(process.cwd(), "../../..");
const read = (p) => readFileSync(path.join(repoRoot, p), "utf8");
const client = "3220089_3220172/partb/client/";
const server = "3220089_3220172/partb/server/";

test("checkout tip is opt-in and defaults to none in both HTML and runtime", () => {
  const html = read(client + "src/pages/checkout/checkout.html");
  const logic = read(client + "src/pages/checkout/checkout.ts");
  assert.match(html, /name="tipChoice" value="none" checked/);
  assert.doesNotMatch(html, /name="tipChoice" value="percent:5" checked/);
  assert.match(logic, /\|\| "none"/);
  assert.match(logic, /tipChoiceExplicit/);
  assert.doesNotMatch(logic, /\|\| "percent:5"/);
});

test("checkout routing uses a protected backend lookup and keeps lead capture separate", () => {
  const routes = read(server + "src/routes/auth.routes.js");
  const controller = read(server + "src/controllers/auth.controller.js");
  const logic = read(client + "src/pages/checkout/checkout.ts");
  assert.match(routes, /"\/account-status", accountStatusLimiter, accountStatus/);
  assert.match(routes, /checkout-lead/);
  assert.match(controller, /Cache-Control", "no-store/);
  assert.match(logic, /await accountExists\(email\) \? "\/login" : "\/register"/);
  assert.match(logic, /showToast\(locale === "el"/);
});

test("all storefront discount badges show amounts instead of percentages", () => {
  const checked = [
    client + "src/components/renderProducts.ts",
    client + "src/pages/products/products.ts",
    client + "src/pages/product-details/product-details.ts",
    client + "scripts/prerender-products.mjs",
    server + "src/services/storefront-seo-html.service.js",
  ];
  for (const file of checked) {
    const source = read(file);
    assert.match(source, /Math\.round\(\(originalPrice - /, file);
    assert.doesNotMatch(source, /-\$\{discountPercent\}%/, file);
  }
  const cart = read(client + "src/pages/cart/cart.ts");
  assert.match(cart, /drawer-cart-price__savings/);
  assert.match(cart, /item\.originalPrice/);
});
