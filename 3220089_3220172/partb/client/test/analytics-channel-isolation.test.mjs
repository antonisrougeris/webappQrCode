import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const analytics = read("services/analytics.ts");
const checkout = read("pages/checkout/checkout.ts");
const ast = ts.createSourceFile("analytics.ts", analytics, ts.ScriptTarget.ES2022, true);
const code = ast.statements.filter(node =>
  ts.isFunctionDeclaration(node) && ["trackEcommerceEvent", "trackMetaEcommerceEvent"].includes(node.name?.text)
).map(node => node.getText(ast).replace(/^export /, "")).join("\n");
const js = ts.transpileModule(code, { compilerOptions: {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.None
}}).outputText;

test("Meta success never marks GA4 queued when analytics consent is absent", () => {
  const ga = [];
  const meta = [];
  const ctx = vm.createContext({
    hasAnalyticsConsent: () => false,
    loadGoogleAnalytics: () => {},
    trackMetaEvent: (...args) => { meta.push(args); return true; },
    window: { gtag: (...args) => ga.push(args) }
  });
  vm.runInContext(js, ctx);
  ctx.items = [{item_id:"shirt",price:23.2,quantity:1}];
  assert.equal(vm.runInContext('trackEcommerceEvent("begin_checkout",items)',ctx), false);
  assert.equal(vm.runInContext('trackMetaEcommerceEvent("begin_checkout",items)',ctx), true);
  assert.equal(meta.length,1);
  assert.equal(meta[0][0],"InitiateCheckout");
  assert.equal(ga.length,0);
});

test("GA4 success never depends on failed/blocked Meta Pixel", () => {
  const ga = [];
  const ctx = vm.createContext({
    hasAnalyticsConsent: () => true,
    loadGoogleAnalytics: () => {},
    trackMetaEvent: () => false,
    window: { gtag: (...args) => ga.push(args) }
  });
  vm.runInContext(js,ctx);
  ctx.items = [{item_id:"shirt",price:23.2,quantity:1}];
  assert.equal(vm.runInContext('trackEcommerceEvent("begin_checkout",items)',ctx),true);
  assert.equal(vm.runInContext('trackMetaEcommerceEvent("begin_checkout",items)',ctx),false);
  assert.equal(ga.length,1);
  assert.equal(ga[0][1],"begin_checkout");
});

test("consent-retry paths preserve independent checkout dedup flags", () => {
  assert.match(checkout,/beginCheckoutTrackedGa4 = trackEcommerceEvent\("begin_checkout", items\)/);
  assert.match(checkout,/beginCheckoutTrackedMeta = trackMetaEcommerceEvent\("begin_checkout", items\)/);
  assert.match(checkout,/skanare:analytics-consent-accepted/);
  assert.match(checkout,/skanare:marketing-consent-accepted/);
  assert.doesNotMatch(analytics,/return metaSent/);
});

test("purchase GA4 helper cannot report Meta-only success", () => {
  const calls = [];
  const ctx = vm.createContext({
    hasAnalyticsConsent:()=>false,loadGoogleAnalytics:()=>{},
    trackMetaEvent:()=>true,
    window:{gtag:(...args)=>calls.push(args)},
    items:[{item_id:"shirt",price:23.2,quantity:1}]
  });
  vm.runInContext(js,ctx);
  assert.equal(vm.runInContext('trackEcommerceEvent("purchase",items,{transaction_id:"order_42"})',ctx),false);
  assert.equal(calls.length,0);
});
