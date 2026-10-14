import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/services/payment-confirmation.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("payment-confirmation.ts", source, ts.ScriptTarget.Latest, true);
const code = ast.statements
  .filter(node => ts.isFunctionDeclaration(node) && ["paymentState", "pollForPaymentConfirmation"].includes(node.name?.text))
  .map(node => node.getText(ast).replace(/^export /, "")).join("\n");
const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }}).outputText;
function ctx() {
  const context = vm.createContext({Promise, String, console});
  vm.runInContext(js,context);
  return context;
}
test("only explicit paid paymentStatus confirms payment", () => {
  const c = ctx();
  for (const status of ["pending", "", undefined]) {
    c.order = {paymentStatus:status, status:"paid"};
    assert.equal(vm.runInContext("paymentState(order)",c),"pending");
  }
  c.order = {paymentStatus:"paid"};
  assert.equal(vm.runInContext("paymentState(order)",c),"paid");
});
test("late Viva confirmation triggers a single paid state", async () => {
  const c=ctx(); let calls=0; let waits=0;
  c.fetchOrder=async()=>({paymentStatus:++calls===4?"paid":"pending"});
  c.wait=async()=>{waits++};
  const result=await vm.runInContext("pollForPaymentConfirmation(fetchOrder,{attempts:10,intervalMs:0,wait})",c);
  assert.equal(result.state,"paid");
  assert.equal(calls,4);assert.equal(waits,3);
});
test("pending is never counted as paid after retry limit",async()=>{
  const c=ctx();let calls=0;
  c.fetchOrder=async()=>{calls++;return {paymentStatus:"pending"}};
  c.wait=async()=>{};
  const result=await vm.runInContext("pollForPaymentConfirmation(fetchOrder,{attempts:3,intervalMs:0,wait})",c);
  assert.equal(result.state,"pending");assert.equal(calls,3);
});
test("terminal payment failure stops polling",async()=>{
  const c=ctx();let calls=0;
  c.fetchOrder=async()=>{calls++;return {paymentStatus:"failed"}};
  const result=await vm.runInContext("pollForPaymentConfirmation(fetchOrder,{attempts:10,intervalMs:0,wait:async()=>{}})",c);
  assert.equal(result.state,"failed");assert.equal(calls,1);
});
test("temporary network errors recover, repeated ones stop safely",async()=>{
  const c=ctx();let calls=0;
  c.fetchOrder=async()=>{calls++;if(calls<=2)throw Error("temporary");return {paymentStatus:"paid"}};
  const a=await vm.runInContext("pollForPaymentConfirmation(fetchOrder,{attempts:5,intervalMs:0,wait:async()=>{}})",c);
  assert.equal(a.state,"paid");
  c.fetchOrder=async()=>{throw Error("offline")};
  const b=await vm.runInContext("pollForPaymentConfirmation(fetchOrder,{attempts:5,intervalMs:0,wait:async()=>{}})",c);
  assert.equal(b.state,"unavailable");
});
test("success page only reports paid order, never reads URL as payment proof",()=>{
  const page=readFileSync(new URL("../src/pages/payment/payment_success.ts",import.meta.url),"utf8");
  const html=readFileSync(new URL("../src/pages/payment/payment_success.html",import.meta.url),"utf8");
  assert.match(page,/result.state === "paid"/);
  assert.match(page,/trackPaidPurchase\(order\)/);
  assert.match(page,/pollForPaymentConfirmation/);
  assert.match(html,/Awaiting confirmation/);
  assert.doesNotMatch(html,/Payment confirmed/);
});
