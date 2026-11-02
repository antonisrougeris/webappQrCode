import test from "node:test";
import assert from "node:assert/strict";
import {blankKey,isSharedTshirt,sharedInventoryKey,sharedAvailable,planSharedAllocation,blankIdFromReservationKey} from "../src/services/shared-blank-inventory.service.js";

const product = {category:"tshirt",id:"scan-me"};
const variant = {color:"Black",size:"L",sku:"SCAN-BLACK-L"};

test("one shared blank pool serves multiple designs",()=>{
 assert.equal(blankKey(variant),"BLACK__L");
 assert.equal(sharedInventoryKey(product,variant,true),"blank::BLACK__L");
 assert.equal(sharedInventoryKey({...product,id:"ride-with-me"},variant,true),"blank::BLACK__L");
 assert.equal(sharedInventoryKey(product,variant,false),null);
 assert.equal(sharedInventoryKey({category:"accessory"},variant,true),null);
 assert.equal(blankIdFromReservationKey("blank::BLACK__L"),"BLACK__L");
 assert.equal(blankIdFromReservationKey("scan-me::BLACK-L"),null);
});
test("available physical and virtual capacity are distinct",()=>{
 const row={onHand:6,committedPhysical:2,virtualLimit:4,backorderOpen:1};
 assert.equal(sharedAvailable(row),7);
 assert.deepEqual(planSharedAllocation(row,6),{physical:4,virtual:2});
 assert.throws(()=>planSharedAllocation(row,8),/Insufficient/);
});
test("stock cannot have negative or inconsistent counters",()=>{
 assert.throws(()=>sharedAvailable({onHand:1,committedPhysical:2}),/Invalid/);
 assert.throws(()=>sharedAvailable({onHand:1,virtualLimit:1,backorderOpen:2}),/Invalid/);
});
test("2XL aliases and color variants share correct physical key",()=>{
 assert.equal(blankKey({color:"White",size:"XXL"}),"WHITE__2XL");
 assert.equal(blankKey({color:"Green",size:"L"}),null);
 assert.equal(isSharedTshirt({category:"NFC"},variant),false);
});
