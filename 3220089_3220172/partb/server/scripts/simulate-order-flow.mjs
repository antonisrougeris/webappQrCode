
/** ISOLATED DRY-RUN: never connects to real Firebase/Viva/BOX NOW or emails. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {
  blankKey, sharedAvailable, planSharedAllocation, isAvailableFinishedGood,
  finishedKey, getSharedReservationSplit
} from "../src/services/shared-blank-inventory.service.js";
import {isReadyQr} from "../src/services/stock-availability.service.js";
import {neededComponents,ensureOrderDtfPlan} from "../src/services/dtf-inventory.service.js";
import {reserveUniqueQrShortId,writeQrShortIdReservation} from "../src/services/qr-id.service.js";

const dir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const payment=fs.readFileSync(path.join(dir,"src/services/payment.service.js"),"utf8");
const artwork=fs.readFileSync(path.join(dir,"src/services/order-email.service.js"),"utf8");
const cases=[], now="2026-11-04T12:00:00Z", future="2099-11-04T12:00:00Z";
const sku="SCAN-BLACK-L", prod="scan-me";
const shirt={productId:prod,sku,variant:{color:"Black",size:"L",sku},quantity:1};
const a3=()=>({id:"a3-01",status:"available",fulfillmentMode:"preprinted",
  finishedGoodStatus:"available",physicalAppliedAt:now,printFileUrl:"memory://a3.png",
  printStatus:"uploaded",productId:prod,sku,inventoryKey:finishedKey(prod,sku)});
const transfer=()=>({id:"qr-only-01",status:"available",fulfillmentMode:"modular_qr",
  printStatus:"uploaded",printFileUrl:"memory://qr.png",physicalConfirmedAt:now,
  modularPrintColor:"white",modularQrWidthCm:28});
const ctx=(blanks=2,virtual=0,finished=[],transfers=[])=>({
  blank:{onHand:blanks,committedPhysical:0,virtualLimit:virtual,backorderOpen:0},
  finished:finished.map(q=>({...q})),transfers:transfers.map(q=>({...q})),
  holds:[],assigned:new Set(),paid:new Set(),jobs:[]
});
class FakeFirestore {
  constructor(seed={}){this.records=new Map(Object.entries(seed));}
  collection(name){return {doc:(id)=>({path:name+"/"+id,id})};}
  async runTransaction(fn){
    const writes=[];
    const tx={
      get:async(ref)=>({exists:this.records.has(ref.path),ref,id:ref.id,data:()=>this.records.get(ref.path)}),
      set:(ref,data,opt)=>writes.push(["set",ref.path,data,opt]),
      create:(ref,data)=>writes.push(["create",ref.path,data])
    };
    const result=await fn(tx);
    for(const [type,key,val,opt] of writes) {
      if(type==="create"&&this.records.has(key))throw Error("Duplicate document");
      this.records.set(key,opt?.merge?{...this.records.get(key),...val}:val);
    }
    return result;
  }
}
function addCart(c,qty=1,owner="buyer-01"){
  assert.equal(blankKey(shirt.variant),"BLACK__L");
  const held=getSharedReservationSplit(c.holds,{nowMs:Date.parse(now)});
  const ready=c.finished.filter(q=>isAvailableFinishedGood(q) && q.productId===prod && q.sku===sku && !c.assigned.has(q.id));
  const availableFinish=Math.max(0,ready.length-(held.finishedReservedBySku.get(finishedKey(prod,sku))||0));
  const availableBlank=Math.max(0,sharedAvailable(c.blank)-held.blankReserved);
  if(qty>availableFinish+availableBlank)throw Error("Not enough stock");
  const finish=Math.min(qty,availableFinish), blanks=qty-finish;
  const hold={id:"hold-"+owner,ownerId:owner,productId:prod,sku,
    expiresAt:future,quantity:qty,finishedQuantity:finish,blankQuantity:blanks};
  c.holds.push(hold);
  return hold;
}
function mockVivaSuccess(c,hold,orderId="fake-order-01"){
  if(c.paid.has(orderId))return {duplicate:true};
  if(!c.holds.includes(hold))throw Error("Checkout hold missing");
  const assigned=[],newQr=[];
  const finished=c.finished.filter(q=>isAvailableFinishedGood(q) && !c.assigned.has(q.id));
  for(const q of finished.slice(0,hold.finishedQuantity)){
    c.assigned.add(q.id);q.status="assigned";assigned.push({id:q.id,kind:"finished"});
  }
  assert.equal(assigned.length,hold.finishedQuantity);
  for(let i=0;i<hold.blankQuantity;i++){
    const mod=c.transfers.find(q=>q.status==="available" && q.fulfillmentMode==="modular_qr" &&
      q.printStatus==="uploaded" && !!q.printFileUrl && !!q.physicalConfirmedAt &&
      q.modularPrintColor==="white" && q.modularQrWidthCm===28);
    if(mod){mod.status="assigned";assigned.push({id:mod.id,kind:"qr_only"});}
    else{const id="new-qr-"+orderId+"-"+i;newQr.push(id);assigned.push({id,kind:"new"});}
  }
  const allocate=hold.blankQuantity?planSharedAllocation(c.blank,hold.blankQuantity):{physical:0,virtual:0};
  c.blank.committedPhysical+=allocate.physical;
  c.blank.backorderOpen+=allocate.virtual;
  const job={finishedAllocated:hold.finishedQuantity,physicalAllocated:allocate.physical,
    virtualAllocated:allocate.virtual,
    status:allocate.virtual?"awaiting_blank":hold.blankQuantity?"to_prepare":"completed"};
  c.jobs.push(job);c.holds=c.holds.filter(h=>h!==hold);c.paid.add(orderId);
  return {assigned,newQr,job,duplicate:false};
}
async function check(id,name,fn){
  try{const result=await fn();cases.push({id,name,status:"PASS",detail:result});console.log("PASS",id,name);}
  catch(e){cases.push({id,name,status:"FAIL",detail:String(e.message||e)});console.error("FAIL",id,String(e.message||e));}
}
await check("01","Ready A3 goes to buyer without consuming a blank",()=>{
  const c=ctx(0,0,[a3()]);const h=addCart(c);
  assert.equal(h.finishedQuantity,1);const p=mockVivaSuccess(c,h);
  assert.equal(p.job.status,"completed");assert.equal(c.blank.onHand,0);
  assert.equal(p.assigned[0].id,"a3-01");
  return "fake buyer -> cart -> checkout -> paid -> existing QR; 0 blanks used";
});
await check("02","No A3: confirmed QR-only + physical blank",async()=>{
  const c=ctx(1,0,[],[transfer()]);const h=addCart(c);
  const p=mockVivaSuccess(c,h,"fake-modular");
  assert.equal(p.assigned[0].kind,"qr_only");assert.equal(c.blank.committedPhysical,1);
  const mod={...c.transfers[0],variant:shirt.variant,qrConfig:{textPrint:"SCAN ME"}};
  assert.equal(neededComponents(mod).length,4);
  const db=new FakeFirestore({"orders/fake-modular":{paymentStatus:"paid"}});
  const planned=await ensureOrderDtfPlan("fake-modular",[mod],{db});
  assert.equal(planned.missing.length,4);
  assert.deepEqual(await ensureOrderDtfPlan("fake-modular",[mod],{db}),planned);
  return "fake payment -> QR-only assigned -> real DTF planner -> 4 missing parts; retry idempotent";
});
await check("03","No A3/QR-only: create new QR ID + artwork branch",async()=>{
  const c=ctx(1);const p=mockVivaSuccess(c,addCart(c),"fake-new");
  assert.equal(p.newQr.length,1);
  const db=new FakeFirestore();
  const code=await db.runTransaction(async tx=>{
    const s=await reserveUniqueQrShortId(tx,db);
    writeQrShortIdReservation(tx,s.reservationRef,{shortId:s.shortId,qrId:p.newQr[0],createdAt:now});
    return s.shortId;
  });
  assert.ok([...db.records.values()].some(v=>v.shortId===code && v.qrId===p.newQr[0]));
  assert.match(artwork,/generatePrintQrImage\(/);
  assert.match(artwork,/generatePrintSheet\(/);
  assert.match(artwork,/isTshirtPrintSize\(qr\.variant\?\.size\)/);
  return "real QR ID reservation; print sheet code path verified (artwork pixels NOT rendered)";
});
await check("04","Virtual-only capacity -> backorder -> manual allocation",()=>{
  const c=ctx(0,1);const p=mockVivaSuccess(c,addCart(c),"fake-virtual");
  assert.equal(p.job.status,"awaiting_blank");assert.equal(c.blank.backorderOpen,1);
  c.blank.onHand++;assert.equal(p.job.status,"awaiting_blank");
  c.blank.committedPhysical++;c.blank.backorderOpen--;
  p.job.status="to_prepare";assert.equal(c.blank.backorderOpen,0);
  return "awaiting_blank after payment; receive alone not enough; allocate -> to_prepare";
});
await check("05","Two units: one finished and one blank",()=>{
  const c=ctx(1,0,[a3()]);const p=mockVivaSuccess(c,addCart(c,2),"fake-mixed");
  assert.equal(p.job.finishedAllocated,1);assert.equal(p.job.physicalAllocated,1);
  assert.equal(c.blank.committedPhysical,1);
  return "buyer ordered 2; allocated finished=1 blank=1; no double stock deduction";
});
await check("06","Two buyers: same last finished item cannot be sold twice",()=>{
  const c=ctx(0,0,[a3()]);addCart(c,1,"buyer-A");
  assert.throws(()=>addCart(c,1,"buyer-B"),/Not enough stock/);
  return "buyer-A held last unit; buyer-B blocked";
});
await check("07","Failed Viva payment releases reservation, no physical stock consumption",()=>{
  const c=ctx(2);const before={...c.blank};const h=addCart(c);
  c.holds=c.holds.filter(x=>x!==h);
  assert.deepEqual(c.blank,before);assert.equal(c.paid.size,0);
  return "fake payment failure -> hold released; 2 blanks remain";
});
await check("08","Duplicate successful payment webhook doesn't consume twice",()=>{
  const c=ctx(2);const h=addCart(c);mockVivaSuccess(c,h,"one-order");
  const before={...c.blank};assert.equal(mockVivaSuccess(c,h,"one-order").duplicate,true);
  assert.deepEqual(c.blank,before);
  assert.match(payment,/if \(order\.paymentStatus === "paid"\)/);
  return "first fake paid webhook consumes 1 commitment; second paid webhook ignored";
});
await check("09","Unconfirmed print cannot masquerade as finished stock",()=>{
  assert.equal(isAvailableFinishedGood({...a3(),physicalAppliedAt:null}),false);
  assert.equal(isAvailableFinishedGood({...a3(),status:"assigned"}),false);
  assert.equal(isReadyQr({...transfer(),printStatus:"pending"}),false);
  return "A3 not physically applied, assigned QR, pending QR-only excluded";
});
await check("10","Real allocation helper prevents overselling",()=>{
  const row={onHand:3,committedPhysical:1,virtualLimit:2,backorderOpen:0};
  assert.equal(sharedAvailable(row),4);
  assert.deepEqual(planSharedAllocation(row,4),{physical:2,virtual:2});
  assert.throws(()=>planSharedAllocation(row,5),/Insufficient/);
  return "physical capacity=2, virtual=2, fifth item rejected";
});
await check("11","Actual paid webhook recognizes reserved finished A3 flag",()=>{
  const match=payment.match(/for\s*\(\s*const id of\s*hold\.qrIds[\s\S]*?qrAssignments\.push\(\{([\s\S]*?)\}\);/);
  assert.ok(match,"Reserved QR assignment block not found");
  assert.match(payment,/a\.type==="existing" && a\.finishedGood===true/);
  assert.match(match[1],/finishedGood\s*:/,
    "SOURCE DEFECT: reserved existing QR omits finishedGood, while payment requires it. Paid A3 orders may fail.");
  return "Finished QR flag propagated from reserved QR to paid allocation";
});
const passed=cases.filter(x=>x.status==="PASS").length, failed=cases.length-passed;
const esc=s=>String(s).replaceAll("|","\\|").replaceAll("\n"," ");
const report=[
  "# SKANARE order-flow simulation — no production access",
  "",
  "**Run (UTC):** "+new Date().toISOString(),
  "**Scope:** real inventory/QR/DTF helper functions; in-memory fake buyer/cart/checkout/payment state.",
  "**NOT run:** real controllers, Viva network, Firestore database, QR image rendering, customer emails, BOX NOW.",
  "**Main branch, physical stock, payments:** untouched.",
  "",
  "## Results",
  "",
  "- Passed: **"+passed+"** / "+cases.length,
  "- Failed: **"+failed+"**",
  "",
  "| # | Simulated flow / source guard | Outcome | Trace or finding |",
  "|---|---|---|---|",
  ...cases.map(c=>"| "+c.id+" | "+esc(c.name)+" | "+c.status+" | "+esc(c.detail)+" |"),
  "",
  "## Important limitations",
  "",
  "- This is a **dry-run**, NOT a real browser-to-API end-to-end checkout. HTTP controllers and Viva webhook are modeled, not invoked.",
  "- Source guard #11 highlights a suspected **production defect** in the reserved-finished A3 path if it fails.",
  "- A PASS in the fake checkout does not guarantee a real Viva payment will succeed.",
  "- Test fixtures contain no genuine user emails, customer orders, credentials or real QR IDs.",
  ""
].join("\n");
const folder=path.join(dir,"test-results","order-flow");
fs.mkdirSync(folder,{recursive:true});
fs.writeFileSync(path.join(folder,"report.md"),report);
fs.writeFileSync(path.join(folder,"report.json"),JSON.stringify({mode:"isolated",passed,failed,cases},null,2));
if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,report);
console.log("SUMMARY: "+passed+" PASS / "+failed+" FAIL. Report: test-results/order-flow/");
if(failed)process.exitCode=1;
