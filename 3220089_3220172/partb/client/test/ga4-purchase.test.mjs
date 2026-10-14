import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const read = path => readFileSync(new URL("../src/" + path, import.meta.url), "utf8");
const source = read("services/purchase-analytics.ts");
const successPage = read("pages/payment/payment_success.ts");
const analytics = read("services/analytics.ts");

const ast = ts.createSourceFile("purchase-analytics.ts", source, ts.ScriptTarget.Latest, true);
const requested = ["validMoney", "buildPaidPurchaseEvent", "trackPaidPurchase"];
const functions = ast.statements
  .filter(node => (ts.isFunctionDeclaration(node) && requested.includes(node.name?.text)) ||
    (ts.isVariableStatement(node) && node.declarationList.declarations.some(decl => ts.isIdentifier(decl.name) && ["roundMoney","validMoney"].includes(decl.name.text))))
  .map(node => node.getText(ast).replace(/^export /, "")).join("\n");
const js = ts.transpileModule(functions, {compilerOptions:{module:ts.ModuleKind.None,target:ts.ScriptTarget.ES2022}}).outputText;
const now = Date.parse("2026-10-14T08:00:00Z");

function order(overrides={}) {
  return {
    id:"order_42", paymentStatus:"paid", orderNumber:"SK-42",
    currency:"EUR", total:25.5, subtotal:23.5, shippingCost:2,
    payment:{paidAt:"2026-10-14T07:59:00Z",transactionId:"viva_tx_123"},
    items:[{productId:"tee",title:"QR T-shirt",quantity:2,unitPrice:13.5,variant:{color:"Black",size:"M"}},
      {productId:"free_keychain",title:"NFC Keychain",quantity:1,unitPrice:0,isFreeReward:true}],
    ...overrides
  };
}
function context(overrides={}) {
  const store = new Map();
  const events=[];
  const ctx=vm.createContext({
    MAX_DELAY_MS:48*60*60*1000,MAX_CLOCK_SKEW_MS:5*60*1000,
    roundMoney:value=>Math.round(value*100)/100,
    Date,Math,Number,String,Boolean,Array,localStorage:{
      getItem:key=>store.get(key) || null,
      setItem:(key,value)=>store.set(key,value)
    },
    trackEcommerceEvent:(name,items,options)=>{events.push({name,items,options});return true},
    trackMetaEvent:()=>false,
    purchaseMetaEventId:orderId=>"skanare_purchase_"+orderId,
    ...overrides
  });
  vm.runInContext(js,ctx);
  return {ctx,events,store};
}

test("never report pending or failed payment as purchase", () => {
  const {ctx}=context();
  for (const paymentStatus of ["pending","failed","cancelled",undefined]) {
    ctx.input=order({paymentStatus});
    assert.equal(vm.runInContext("buildPaidPurchaseEvent(input, "+now+")",ctx),null);
  }
  assert.match(successPage, /result\.state === "paid"/);
  assert.match(successPage,/trackPaidPurchase\(order\)/);
});

test("paid purchase uses server amount, stable transaction_id and real order lines", () => {
  const {ctx}=context();
  ctx.input=order();
  const data=vm.runInContext("buildPaidPurchaseEvent(input, "+now+")",ctx);
  assert.equal(data.options.transaction_id,"order_42");
  assert.equal(data.options.value,23.5);
  assert.equal(data.options.shipping,2);
  assert.equal(data.options.currency,"EUR");
  assert.equal(data.items.length,2);
  assert.equal(data.items[0].item_id,"tee");
  assert.equal(data.items[0].price,13.5);
  assert.equal(data.items[0].quantity,2);
  assert.equal(data.items[0].item_variant,"Black / M");
  assert.equal(data.items[1].price,0);
});

test("invalid/missing paidAt, transaction or outdated order never emits", () => {
  const {ctx}=context();
  for (const bad of [
    order({payment:{transactionId:"",paidAt:"2026-10-14T07:59:00Z"}}),
    order({payment:{transactionId:"viva_tx",paidAt:""}}),
    order({payment:{transactionId:"viva_tx",paidAt:"2026-09-01T00:00:00Z"}}),
    order({total:0}),order({items:[]})
  ]) {
    ctx.input=bad;
    assert.equal(vm.runInContext("buildPaidPurchaseEvent(input, "+now+")",ctx),null);
  }
});

test("one paid purchase is emitted once per browser even on refresh", () => {
  const {ctx,events}=context();
  // Production trackPaidPurchase derives time from Date.now(), so give a real-time fixture.
  ctx.input=order({payment:{transactionId:"tx",paidAt:new Date().toISOString()}});
  assert.equal(vm.runInContext("trackPaidPurchase(input)",ctx),true);
  assert.equal(vm.runInContext("trackPaidPurchase(input)",ctx),false);
  assert.equal(events.length,1);
  assert.equal(events[0].name,"purchase");
  assert.equal(events[0].options.transaction_id,"order_42");
});

test("not accepted or blocked GA4 event is retryable and never marked as sent", () => {
  let consent=false;const {ctx,events,store}=context({
    trackEcommerceEvent:(name,items,options)=>{
      if(!consent)return false;
      events.push({name,items,options});
      return true;
    }
  });
  ctx.input=order({payment:{transactionId:"tx",paidAt:new Date().toISOString()}});
  assert.equal(vm.runInContext("trackPaidPurchase(input)",ctx),false);
  assert.equal(store.size,0);
  consent=true;
  assert.equal(vm.runInContext("trackPaidPurchase(input)",ctx),true);
  assert.equal(vm.runInContext("trackPaidPurchase(input)",ctx),false);
  assert.equal(events.length,1);
  assert.match(successPage,/skanare:analytics-consent-accepted/);
});

test("GA4 helper includes shipping/coupon metadata for imported Ads revenue", () => {
  assert.match(analytics,/options\.shipping/);
  assert.match(analytics,/options\.coupon/);
  assert.match(analytics,/transaction_id/);
});
