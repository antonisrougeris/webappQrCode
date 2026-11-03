import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = path => readFileSync(path,"utf8");

test("homepage trust information sits between product collections and How It Works",()=>{
 const home=read("index.html");
 assert.ok(home.indexOf('id="accessories"')<home.indexOf('class="home-partner-strip"'));
 assert.ok(home.indexOf('class="home-partner-strip"')<home.indexOf('id="how"'));
 assert.match(home,/Viva\.com/);
 assert.match(home,/BOX NOW/);
 assert.match(home,/href="\/payment-security"/);
 assert.match(home,/href="\/shipping-policy"/);
});

test("product purchase block contains both shipping and payments trust statements",()=>{
 const detail=read("src/pages/product-details/product-details.html");
 const atc=detail.indexOf('id="productAddToCartBtn"');
 const partner=detail.indexOf('class="pdp-partner-trust"');
 const benefits=detail.indexOf('class="product-benefits"');
 assert.ok(atc>0 && partner>atc && benefits>partner);
 assert.match(detail,/BOX NOW/);
 assert.match(detail,/Viva\.com/);
 assert.match(detail,/href="\/shipping-policy"/);
 assert.match(detail,/href="\/payment-security"/);
});

test("TikTok is next to Instagram throughout all statically rendered storefront footers",()=>{
 const pages=[
  "index.html",
  "src/pages/product-details/product-details.html",
  "src/pages/products/products.html",
  "src/pages/contact/contact.html",
  "src/pages/checkout/checkout.html",
  "src/pages/login/login.html",
  "src/pages/register/register.html",
  "src/pages/forgot-password/forgot-password.html",
  "src/pages/my-qr/my-qr.html",
  "src/pages/verify-email/verify-email.html",
  "src/pages/payment/payment_success.html",
  "src/pages/payment/payment_failure.html",
  "src/components/footer.ts",
 ];
 for(const page of pages){
  const html=read(page);
  const insta=html.indexOf('aria-label="Instagram"');
  const tik=html.indexOf('aria-label="TikTok"');
  const fb=html.indexOf('aria-label="Facebook"');
  assert.ok(insta>=0 && tik>insta && fb>tik, "Expected Instagram, TikTok, Facebook order in "+page);
  assert.match(html,/class="footer-partner-trust"/,"Footer partner information missing in "+page);
  assert.ok(html.includes('href="https://www.tiktok.com/@skanare.com"'));
  assert.ok(html.includes('href="https://www.instagram.com/skanare.gr?obrf=ZXU5ZXoyNnRsejF1"'));
 }
});

test("responsive trust styling preserves mobile purchase grid",()=>{
 const css=read("public/assets/css/components.css");
 const mobile=read("public/assets/css/product-mobile-immersive.css");
 const desktop=read("public/assets/css/product-desktop-premium.css");
 assert.match(css,/\.home-partner-strip__inner/);
 assert.match(css,/\.footer-partner-trust/);
 assert.match(css,/\.footer-social--tiktok/);
 assert.match(mobile,/grid-area:partner/);
 assert.match(desktop,/\.pdp-partner-trust \{ order:14; \}/);
});

test("restores desktop size, quantity, delivery, CTA and partner sequence",()=>{
 const desktop=read("public/assets/css/product-desktop-premium.css");
 const css=desktop.slice(desktop.lastIndexOf("/* Restore the original desktop purchase hierarchy"));
 for(const [rule,order] of [["size-row",9],["size-stock-row",10],["product-purchase-row",11],["delivery-info",12],["add-to-cart-btn",13],["pdp-partner-trust",14]]){
   assert.match(css,new RegExp("\\."+rule+" \\{ order:"+order+"; \\}"));
 }
});

test("mobile price stays beside the title with enough width for long product titles",()=>{
 const stylesheet=read("public/assets/css/product-mobile-android-price-v2-20261013.css");
 const final=stylesheet.slice(stylesheet.indexOf("/* Mobile PDP restore:"));
 assert.match(final,/grid-template-columns:minmax\(0,1fr\) 112px/);
 assert.match(final,/"title price"/);
 assert.match(final,/"meta price"/);
 assert.match(final,/grid-area:price/);
 assert.match(final,/justify-self:end/);
 assert.match(final,/overflow-wrap:break-word/);
 assert.match(final,/justify-content:center/);
 const html=read("src/pages/product-details/product-details.html");
 // Version changes with each CSS release; validate that the unique mobile sheet is linked.
 assert.match(html,/href="\/assets\/css\/product-mobile-android-price-v2-20261013\.css\?v=[^"]+"/);
 const css=read("public/assets/css/components.css");
 assert.match(css,/pdp-partner-trust\{justify-content:center/);
});

test("shared and Next.js footers point to SKANARE social accounts",()=>{
 const files=["src/components/footer.ts","../web/src/components/Footer.tsx","../web/src/components/layout/Footer.tsx"];
 for(const file of files){
  const content=read(file);
  assert.ok(content.includes("https://www.instagram.com/skanare.gr?obrf=ZXU5ZXoyNnRsejF1"),file);
  assert.ok(content.includes("https://www.tiktok.com/@skanare.com"),file);
  assert.match(content,/rel="noopener noreferrer"/);
 }
});
