import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const checkout = read("pages/checkout/checkout.ts");
const analytics = read("services/analytics.ts");
const consent = read("components/cookieConsent.ts");

function topLevelFunctions(source, names) {
  const ast = ts.createSourceFile("test.ts", source, ts.ScriptTarget.Latest, true);
  return ast.statements.filter(node => ts.isFunctionDeclaration(node) && names.includes(node.name?.text))
    .map(node => node.getText(ast).replace(/^export /, "")).join("\n");
}
function toJs(source) {
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

test("begin_checkout lives in cart-render flow, never behind auth return flag", () => {
  const restore = checkout.slice(checkout.indexOf("function restoreAfterAuth()"), checkout.indexOf('document.addEventListener("DOMContentLoaded"'));
  assert.doesNotMatch(restore, /trackEcommerceEvent|trackBeginCheckout/);
  const render = checkout.slice(checkout.indexOf("async function render()"), checkout.indexOf("function getRequiredFormString"));
  assert.match(render, /const cart = await getCart\(\);[\s\S]*?trackBeginCheckout\(cart\);/);
  assert.match(checkout, /skanare:analytics-consent-accepted/);
  assert.match(checkout, /skanare:marketing-consent-accepted/);
  assert.match(consent, /dispatchEvent\(new Event\("skanare:analytics-consent-accepted"\)\)/);
});

test("begin_checkout tracks once for populated carts and ignores empty carts", () => {
  const code = toJs(topLevelFunctions(checkout, ["trackBeginCheckout"]));
  const events = [];
  const ctx = vm.createContext({
    beginCheckoutTrackedGa4: false,
    beginCheckoutTrackedMeta: false,
    trackMetaEcommerceEvent: () => false,
    getCartItemUnitPrice: item => item.price,
    trackEcommerceEvent: (name, items) => { events.push({ name, items }); return true; }
  });
  vm.runInContext(code, ctx);
  ctx.emptyCart = { items: [] };
  vm.runInContext("trackBeginCheckout(emptyCart)", ctx);
  assert.equal(events.length, 0);
  ctx.cart = { items: [
    { productId: "tee", title: "QR Tee", price: 15, quantity: 2, variant: { size: "M", color: "Black" } },
    { productId: "gift", isFreeReward: true, quantity: 1, price: 0 }
  ] };
  vm.runInContext("trackBeginCheckout(cart); trackBeginCheckout(cart);", ctx);
  assert.equal(events.length, 1);
  assert.equal(events[0].name, "begin_checkout");
  assert.equal(events[0].items[0].item_id, "tee");
  assert.equal(events[0].items[0].price, 15);
  assert.equal(events[0].items[0].quantity, 2);
  assert.equal(events[0].items.length, 1);
});

test("consent rejection does not mark begin_checkout sent; it retries after acceptance", () => {
  const code = toJs(topLevelFunctions(checkout, ["trackBeginCheckout"]));
  const events = [];
  let consented = false;
  const ctx = vm.createContext({
    beginCheckoutTrackedGa4: false,
    beginCheckoutTrackedMeta: false,
    trackMetaEcommerceEvent: () => false,
    getCartItemUnitPrice: item => item.price,
    trackEcommerceEvent: (name, items) => {
      if (!consented) return false;
      events.push({name, items});
      return true;
    },
    cart: { items: [{productId: "tee", title: "QR Tee", price: 14, quantity: 1}] }
  });
  vm.runInContext(code, ctx);
  vm.runInContext("trackBeginCheckout(cart)", ctx);
  assert.equal(events.length, 0);
  assert.equal(ctx.beginCheckoutTrackedGa4, false);
  consented = true;
  vm.runInContext("trackBeginCheckout(cart); trackBeginCheckout(cart)", ctx);
  assert.equal(events.length, 1);
});

test("GA4 helper returns whether event was queued and never emits without consent", () => {
  const fn = toJs(topLevelFunctions(analytics, ["trackEcommerceEvent"]));
  const calls = [];
  const ctx = vm.createContext({
    hasAnalyticsConsent: () => false,
    trackMetaEvent: () => false,
    loadGoogleAnalytics: () => {},
    window: { gtag: (...args) => calls.push(args) },

  });
  vm.runInContext(fn, ctx);
  ctx.items = [{item_id: "tee", price: 12, quantity: 2}];
  assert.equal(vm.runInContext('trackEcommerceEvent("begin_checkout", items)',ctx), false);
  assert.equal(calls.length, 0);
  ctx.hasAnalyticsConsent = () => true;
  assert.equal(vm.runInContext('trackEcommerceEvent("begin_checkout", items)',ctx), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "begin_checkout");
  assert.equal(calls[0][2].value, 24);
});
