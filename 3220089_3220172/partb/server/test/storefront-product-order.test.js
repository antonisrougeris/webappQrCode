import test from "node:test";
import assert from "node:assert/strict";
import {compareStorefrontProducts} from "../src/services/storefront-product-order.service.js";
test("position determines homepage and catalog order",()=>{
 const products=[{id:"A",displayOrder:2,createdAt:"2026-11-03"},{id:"B",displayOrder:1,createdAt:"2025-01-01"},{id:"C",createdAt:"2026-11-03"}];
 assert.deepEqual(products.sort(compareStorefrontProducts).map(p=>p.id),["B","A","C"]);
});
test("legacy products keep newest first with stable ties",()=>{
 const products=[{id:"C",createdAt:"2024-01-01"},{id:"A",createdAt:"2024-01-02"},{id:"B",createdAt:"2024-01-02"}];
 assert.deepEqual(products.sort(compareStorefrontProducts).map(p=>p.id),["A","B","C"]);
});
test("two ranked items tie-break reliably",()=>{
 assert.deepEqual([{id:"b",displayOrder:1},{id:"a",displayOrder:1}].sort(compareStorefrontProducts).map(p=>p.id),["a","b"]);
});
