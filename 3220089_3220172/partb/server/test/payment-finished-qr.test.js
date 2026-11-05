import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  isAvailableFinishedGood,
  isReservedFinishedGood
} from "../src/services/shared-blank-inventory.service.js";

const printed = {
  status:"reserved", fulfillmentMode:"preprinted",
  finishedGoodStatus:"available", physicalAppliedAt:"2026-11-04T10:00:00Z",
  printFileUrl:"memory://finished-a3.png"
};
test("reserved physically printed A3 is finished, but no longer publicly available",()=>{
  assert.equal(isAvailableFinishedGood(printed),false);
  assert.equal(isReservedFinishedGood(printed),true);
});
test("reserved QR needs genuine physical evidence; incomplete or loose transfers are not finished",()=>{
  for (const variant of [
    {...printed,physicalAppliedAt:null},
    {...printed,printFileUrl:null},
    {...printed,finishedGoodStatus:"pending"},
    {...printed,fulfillmentMode:"modular_qr"},
    {...printed,status:"assigned"},
    {...printed,status:"available"},
  ]) assert.equal(isReservedFinishedGood(variant),false);
});
test("paid reserved-QR allocation uses validated finishedGood and preserves legacy ready-QR handling",()=>{
  const payment=fs.readFileSync(new URL("../src/services/payment.service.js",import.meta.url),"utf8");
  const reservedBranch=payment.match(/for\s*\(\s*const id of\s*hold\.qrIds[\s\S]*?qrAssignments\.push\(\{([\s\S]*?)\}\);/);
  assert.ok(reservedBranch);
  assert.match(reservedBranch[1],/finishedGood:\s*isReservedFinishedGood\(qr\)/);
  assert.match(payment,/a\.type==="existing" && a\.finishedGood===true/);
  // The new paid allocation must prioritize finished shirts only up to the
  // quantity reserved for this order, then use QR-only transfers.
  assert.match(payment,/const finishedReady = ready\.filter\(doc => isAvailableFinishedGood\(doc\.data\(\)\)\)/);
  assert.match(payment,/const permittedFinished = Array\.isArray\(order\.stockReservations\)/);
  assert.match(payment,/if \(finishedPicked < permittedFinished\)/);
  assert.match(payment,/finishedGood:true/);
  assert.match(payment,/assignment\.finishedGood \? \{ finishedGoodStatus: "assigned" \} : \{\}/);
  assert.match(payment,/const modular = chooseModularQr\(item\)/);
});
