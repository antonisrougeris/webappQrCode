import test from "node:test";
import assert from "node:assert/strict";
import { isPaidCheckoutHold } from "../src/services/inventory-reservation.service.js";
import { buildPaidOrderDtfRequirements, normalizeDtfColor } from "../src/services/dtf-inventory.service.js";

test("paid checkout releases its own hold and never an unrelated customer's hold", () => {
 const args={orderId:"o1",orderItemIds:new Set(["i1"]),checkoutHoldIds:new Set(["order:o1:i1"])};
 assert.equal(isPaidCheckoutHold({id:"order:o1:i1",orderId:"o1",phase:"checkout",orderItemId:"i1"},args),true);
 assert.equal(isPaidCheckoutHold({id:"order:o2:i1",orderId:"o2",phase:"checkout",orderItemId:"i1"},args),false);
 assert.equal(isPaidCheckoutHold({id:"i1",orderId:"o1",phase:"cart",orderItemId:"i1"},args),false);
});

test("finished shirts need no separate DTF; black shirts receive white QR and vice versa",()=>{
 const output=buildPaidOrderDtfRequirements([
 {id:"finished",fulfillmentMode:"preprinted",variant:{color:"Black",size:"L"}},
 {id:"modular",shortId:"qr1",fulfillmentMode:"modular_qr",variant:{color:"Black",size:"XL"},qrConfig:{textPrint:"SCAN ME"}},
 {id:"new",shortId:"qr2",fulfillmentMode:"made_to_order",variant:{color:"White",size:"S"},qrConfig:{textPrint:"SCAN ME"}},
 ]);
 assert.equal(normalizeDtfColor("Black"),"white");
 assert.equal(normalizeDtfColor("White"),"black");
 assert.equal(output.qrTransfers.length,2);
 assert.equal(output.qrPrints.length,1);
 assert.equal(output.qrTransfers[0].inkColor,"white");
 assert.equal(output.qrTransfers[1].inkColor,"black");
 assert.equal(output.needed.length,6);
});