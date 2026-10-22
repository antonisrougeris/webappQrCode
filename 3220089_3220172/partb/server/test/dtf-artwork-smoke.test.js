import test from "node:test";
import assert from "node:assert/strict";
import { createCanvas, loadImage } from "canvas";
import { generatePrintSheet } from "../src/utils/generatePrintSheet.js";
import { generateDtfComponentArtwork } from "../src/utils/generateDtfComponent.js";
import { makeSkanareWordmark, resolveNeckPrintAsset } from "../src/utils/printArtworkAssets.js";
import fs from "node:fs";

test("standalone neck DTF has no size and uses exact 6cm x 300DPI",async()=>{
  const image=await loadImage(await generateDtfComponentArtwork({type:"neck",color:"white"}));
  assert.equal(image.width,Math.round(6/2.54*300));
  assert.ok(image.height>150);
});
test("standalone size, slogan and SKANARE logo generate on transparent PNG backgrounds",async()=>{
  const cases=[
    {type:"logo",color:"black"},
    {type:"size",color:"white",size:"XXL"},
    {type:"text",color:"black",text:"SCAN TO DISCOVER"},
  ];
  for(const spec of cases){
    const bytes=await generateDtfComponentArtwork(spec);
    assert.ok(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
    const img=await loadImage(bytes);
    assert.ok(img.width>300 && img.height>100);
  }
});
test("A3 XXL (previously missing label asset) renders 300DPI side-by-side neck/logo",async()=>{
  const qr=createCanvas(64,64);
  const ctx=qr.getContext("2d");
  ctx.fillStyle="#000";ctx.fillRect(6,6,52,52);
  const png=await generatePrintSheet({qrBuffer:qr.toBuffer("image/png"),shirtColor:"White",shirtSize:"XXL"});
  const image=await loadImage(png);
  assert.equal(image.width,3508);
  assert.equal(image.height,4961);
  assert.ok(png.length>10000);
});

test("real stock-generated QR artwork fits full A3 for each common design",async()=>{
  const { generatePrintQrImage }=await import("../src/utils/generatePrintQrImage.js");
  for(const shirtColor of ["White","Black"]){
    for(const shirtSize of ["S","L"]){
      const ink=shirtColor==="Black"?"#ffffff":"#000000";
      const qr=await generatePrintQrImage("https://go.skanare.com/jBJQ3J",{
        qrColor:ink,textColor:ink,textPrint:"SCAN TO DISCOVER",
        textPosition:"bottom",size:3540,
      });
      const bytes=await generatePrintSheet({qrBuffer:qr,shirtColor,shirtSize});
      const image=await loadImage(bytes);
      assert.equal(image.width,3508);
      assert.equal(image.height,4961);
    }
  }
});

test("SKANARE print logo generated from text in black or white, independent of client/public logo PNG",async()=>{
  for(const color of ["white","black"]){
    const bytes=makeSkanareWordmark(color,7);
    const image=await loadImage(bytes);
    assert.equal(image.width,Math.round(7/2.54*300));
    assert.ok(image.height>100);
    assert.ok(bytes.length>1000);
  }
});
test("neck labels resolve without process.cwd paths and packaging includes each variant",()=>{
  for(const color of ["black","white"]){
    for(const size of ["s","m","l","xl"]){
      const file=resolveNeckPrintAsset(color,size);
      assert.equal(fs.existsSync(file),true);
    }
  }
});

test("brand slogans keep the intended two lines on print QR artwork",async()=>{
  const { generatePrintQrImage }=await import("../src/utils/generatePrintQrImage.js");
  for (const phrase of ["SCAN TO DISCOVER","WANNA RIDE WITH ME"]) {
    const qr=await generatePrintQrImage("https://go.skanare.com/TEST-QR",{
      qrColor:"#000000",textPrint:phrase,size:1200,
    });
    const img=await loadImage(qr);
    assert.ok(img.height>img.width,"two-line QR print must be taller than wide");
  }
});
