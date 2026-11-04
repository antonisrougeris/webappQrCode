import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const cfg=readFileSync("src/config/socialProof.ts","utf8");
const story=readFileSync("src/components/homepageSocialProof.ts","utf8");
const homepage=readFileSync("index.html","utf8");
const main=readFileSync("src/main.ts","utf8");
const shop=readFileSync("src/pages/products/products.html","utf8");
const pdp=readFileSync("src/pages/product-details/product-details.html","utf8");
const admin=readFileSync("src/pages/admin/admin.html","utf8");
const adminTs=readFileSync("src/pages/admin/admin.ts","utf8");

test("three real Instagram URLs use local MP4 and poster paths",()=>{
 for(const id of ["Deuk7KftZ0U","DfQFmantGtg","DfSS309tnze"]) assert.match(cfg,new RegExp(id));
 assert.equal((cfg.match(/instagramUrl:"https:\/\/www\.instagram\.com\/reel\//g)||[]).length,3);
 assert.equal((cfg.match(/\.mp4"/g)||[]).length,3);
 assert.equal((cfg.match(/\.webp"/g)||[]).length,3);
 assert.match(story,/await fetch\(src, \{method:"HEAD",cache:"no-store"\}\)/);
 assert.match(story,/const configured = checked\.filter\(entry=>entry\.ready\)/);
 assert.match(story,/video\.muted = true/);
 assert.match(story,/IntersectionObserver/);
});
test("social proof adds sections without replacing existing product and checkout",()=>{
 assert.match(homepage,/id="skanareReels"/);
 assert.match(homepage,/id="skanareReviews"/);
 assert.match(main,/initHomepageSocialProof\(\)/);
 assert.match(shop,/id="skanareTrustSections"/);
 assert.match(pdp,/id="skanareTrustSections"/);
 assert.match(homepage,/id="featuredTshirtsGrid"/);
 assert.match(homepage,/id="featuredAccessoriesGrid"/);
});
test("standalone size button disabled and neck size is shown in Admin",()=>{
 assert.doesNotMatch(admin,/<option value="size">Size letter only<\/option>/);
 assert.match(admin,/<option value="neck">Neck \+ Size/);
 assert.match(admin,/id="dtfSizeField"/);
 assert.match(adminTs,/size\.hidden=type!=="neck"/);
});
