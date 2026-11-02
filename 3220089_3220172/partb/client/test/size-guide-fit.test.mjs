import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html=readFileSync("src/pages/product-details/product-details.html","utf8");
const css=readFileSync("public/assets/css/size-guide-fit.css","utf8");
const logic=readFileSync("src/pages/product-details/size-guide-fit.ts","utf8");
const page=readFileSync("src/pages/product-details/product-details.ts","utf8");

test("merchant supplied S-2XL dimensions are represented in height/weight guide",()=>{
  assert.match(logic,/size: "S", lengthCm: 64, widthCm: 48/);
  assert.match(logic,/size: "M", lengthCm: 70, widthCm: 50/);
  assert.match(logic,/size: "L", lengthCm: 72, widthCm: 53/);
  assert.match(logic,/size: "XL", lengthCm: 74, widthCm: 56/);
  assert.match(logic,/size: "2XL", lengthCm: 76, widthCm: 59/);
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
  assert.match(page,/estimateTshirtFit\(height, weight, fit\)/);
  assert.match(page,/!option\.disabled/);
  assert.match(page,/option\.click\(\);/);
  assert.match(page,/Δεν αποθηκεύουμε ύψος ή βάρος/);
  assert.match(page,/Η πρόταση είναι ενδεικτική/);
  assert.match(page,/previousFocus/);
});

test("desktop defaults to an in-stock S but mobile keeps its original no-size state",()=>{
  assert.match(page,/window\.matchMedia\("\(min-width: 821px\)"\)/);
  assert.match(page,/const desktopDefaultSize/);
  assert.match(page,/Number\(variant\.stock \|\| 0\) > 0/);
  assert.match(page,/let hasExplicitSizeSelection = Boolean\(linkedVariant && productHasSizes\)/);
  assert.match(page,/!hasExplicitSizeSelection && productHasSizes/);
  assert.match(page,/selectedSize = desktopDefaultSize\(\)/);
  assert.match(page,/hasExplicitSizeSelection = true/);
});
test("popup has all five size columns and never scrolls horizontally",()=>{
  assert.match(html,/<th scope="col">XL<\/th><th scope="col">2XL<\/th>/);
  assert.match(css,/#sizeGuideMeasurements\{[^}]*table-layout:fixed/);
  assert.match(css,/\.size-guide-chart__scroll\{[^}]*overflow:hidden/);
  assert.match(css,/\.size-guide-modal__panel\{[^}]*overflow-x:hidden/);
  assert.match(css,/@media\(max-width:410px\)/);
});

test("fit heuristic uses continuous score and surfaces uncertainty instead of BMI cutoffs",()=>{
  assert.match(logic,/export function estimateTshirtFit/);
  assert.match(logic,/0\.24 \* \(heightCm - 170\)/);
  assert.match(logic,/0\.03 \* \(weightKg - 80\)/);
  assert.match(logic,/Math\.abs\(fraction - 0\.5\) <= 0\.18/);
  assert.match(page,/estimate\.alternative/);
  assert.match(page,/κοντά σε δύο μεγέθη/);
  assert.doesNotMatch(logic,/const byHeight = heightCm </);
  const regular = (height, weight) => Math.max(0,Math.min(4,Math.round(1+0.24*(height-170)+0.03*(weight-80))));
  assert.equal(regular(175,70),2, "175cm / 70kg should recommend L");
  assert.equal(regular(170,80),1, "170cm / 80kg should recommend M");
  assert.equal(regular(170,81),1, "170cm / 81kg must not jump from M");
});
