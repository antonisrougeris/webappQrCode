import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync("src/pages/product-details/product-details.html","utf8");
const css=readFileSync("public/assets/css/size-guide-fit.css","utf8");
const logic=readFileSync("src/pages/product-details/size-guide-fit.ts","utf8");
const page=readFileSync("src/pages/product-details/product-details.ts","utf8");

test("merchant supplied S-XL dimensions are represented in height/weight guide",()=>{
  assert.match(logic,/size: "S", lengthCm: 64, widthCm: 48/);
  assert.match(logic,/size: "M", lengthCm: 70, widthCm: 50/);
  assert.match(logic,/size: "L", lengthCm: 72, widthCm: 53/);
  assert.match(logic,/size: "XL", lengthCm: 74, widthCm: 56/);
  assert.doesNotMatch(logic,/size: "2XL", lengthCm:/);
  assert.match(html,/<th id="sizeGuideLengthLabel"[^>]*>Length \(B\)<\/th><td>64<\/td><td>70<\/td><td>72<\/td><td>74<\/td>/);
  assert.match(html,/<th id="sizeGuideWidthLabel"[^>]*>Width \(A\)<\/th><td>48<\/td><td>50<\/td><td>53<\/td><td>56<\/td>/);
});

test("size assistant is accessible and responsive without the old oversized image",()=>{
  for(const id of ["sizeGuideModal","sizeGuideFitForm","sizeGuideHeight","sizeGuideWeight","sizeGuideResult","sizeGuideApply","sizeGuideMeasurements","sizeGuideClose"]) {
    assert.match(html,new RegExp('id="'+id+'"'));
  }
  assert.doesNotMatch(html,/id="sizeGuideImage"/);
  assert.match(html,/aria-live="polite"/);
  assert.match(css,/width:min\(515px,100%\)/);
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(html,/assets\/css\/size-guide-fit\.css/);
});

test("only gives an approximate recommendation and cannot select missing/out-of-stock variants",()=>{
  assert.match(logic,/bmi < 16 \|\| bmi > 34/);
  assert.match(page,/estimateTshirtSize\(height, weight, fit\)/);
  assert.match(page,/!option\.disabled/);
  assert.match(page,/option\.click\(\);/);
  assert.match(page,/Δεν αποθηκεύουμε ύψος ή βάρος/);
  assert.match(page,/Η πρόταση είναι ενδεικτική/);
  assert.match(page,/previousFocus/);
});
