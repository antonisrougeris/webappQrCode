import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { componentSpec, componentKey, neededComponents, ensureOrderDtfPlan, normalizeDtfColor } from "../src/services/dtf-inventory.service.js";

test("shirt colors produce contrasting printed transfer inks and size aliases normalize",()=>{
  assert.equal(normalizeDtfColor("Black"),"white");
  assert.equal(normalizeDtfColor("White"),"black");
  assert.equal(componentSpec("size","white",{size:"XXL"}).size,"2XL");
  assert.throws(()=>componentSpec("neck","green"),/Invalid/);
  assert.throws(()=>componentSpec("text","black",{text:""}),/Invalid/);
  assert.notEqual(componentKey(componentSpec("text","black",{text:"SCAN ME"})),componentKey(componentSpec("text","black",{text:"SCAN TO DISCOVER"})));
});
test("modular QR needs logo, neck, size and design-specific text; full A3 needs none",()=>{
  const mod={id:"qr_123",fulfillmentMode:"modular_qr",variant:{color:"Black",size:"L"},qrConfig:{textPrint:"SCAN TO DISCOVER"}};
  assert.deepEqual(neededComponents(mod).map(x=>x.type),["logo","neck","size","text"]);
});
function fakeDatabase(seed) {
  const records=new Map(Object.entries(seed));
  const doc=(collection,id)=>({path:`${collection}/${id}`,id,collection});
  return {
    records,
    collection(collection){return{doc(id){return doc(collection,id)}};},
    async runTransaction(fn){
      const updates=[];
      const tx={
        async get(ref){return{exists:records.has(ref.path),data:()=>records.get(ref.path)};},
        set(ref,data,options){updates.push({ref,data,options});},
      };
      const result=await fn(tx);
      for(const {ref,data,options} of updates){
        const old=records.get(ref.path)||{};
        records.set(ref.path, options?.merge?{...old,...data}:data);
      }
      return result;
    },
  };
}
test("consumes ONLY physically confirmed parts, reports shortages and is idempotent on email retry",async()=>{
  const logo=componentSpec("logo","white");
  const slogan=componentSpec("text","white",{text:"SCAN TO DISCOVER"});
  const db=fakeDatabase({
    "orders/order1":{id:"order1",paymentStatus:"paid"},
    [`dtfComponentStock/${componentKey(logo)}`]:{physicalQuantity:1},
    [`dtfComponentStock/${componentKey(slogan)}`]:{physicalQuantity:0},
  });
  const qr={id:"qr1",fulfillmentMode:"modular_qr",variant:{size:"L",color:"Black"},qrConfig:{textPrint:"SCAN TO DISCOVER"}};
  const result=await ensureOrderDtfPlan("order1",[qr],{db});
  assert.equal(result.components.length,4);
  assert.equal(result.components.find(x=>x.type==="logo").source,"physical_stock");
  assert.equal(result.missing.length,3);
  assert.equal(db.records.get(`dtfComponentStock/${componentKey(logo)}`).physicalQuantity,0);
  const duplicate=await ensureOrderDtfPlan("order1",[qr],{db});
  assert.deepEqual(duplicate,result);
  assert.equal(db.records.get(`dtfComponentStock/${componentKey(logo)}`).physicalQuantity,0);
});
test("A3 sheet prints enlarged neck label next to logo; QR retains per-size dimensions",()=>{
  const sheet=fs.readFileSync(new URL("../src/utils/generatePrintSheet.js",import.meta.url),"utf8");
  assert.match(sheet,/NECK_LABEL_WIDTH_CM = 8/);
  assert.match(sheet,/rowStartX \+ logoWidthPx \+ LOGO_TO_NECK_GAP/);
  assert.match(sheet,/Math\.max\(logoDimensions\.height, neckDimensions\.height\)/);
  assert.match(sheet,/S: 27\.5/);
  assert.match(sheet,/XL: 28/);
});
test("paid QR flow prioritizes existing ready A3 before generic modular QR and makes fallback QR as last resort",()=>{
  const payment=fs.readFileSync(new URL("../src/services/payment.service.js",import.meta.url),"utf8");
  assert.match(payment,/type: "existing"/);
  assert.match(payment,/const modular = chooseModularQr\(item\)/);
  assert.match(payment,/type: "modular"/);
  assert.match(payment,/modularQrWidthCm === requestedWidth/);
  assert.match(payment,/type: "new"/);
});
