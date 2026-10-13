import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const pdp=readFileSync("public/assets/css/product-desktop-premium.css","utf8");
const catalog=readFileSync("public/assets/css/components.css","utf8");
const shop=readFileSync("src/pages/products/products.ts","utf8");
const cart=readFileSync("src/pages/cart/cart-enhancements.css","utf8");
test("thumbnail image fills its complete desktop frame",()=>{
 assert.match(pdp,/\.product-page \.product-gallery \.product-thumbnail img\s*\{[\s\S]*?object-fit:\s*cover/);
 assert.match(pdp,/\.product-page \.product-info #productColorOptions \.product-color-swatch__preview\s*\{[\s\S]*?object-fit:\s*cover/);
});
test("catalog uses full-card photographs without blank letterboxing",()=>{
 assert.match(shop,/product-card--accessory/);
 assert.match(catalog,/\.products-shop \.product-media > img\.product-img\s*\{[\s\S]*?position:\s*absolute/);
 assert.match(catalog,/\.products-shop \.product-card--accessory \.product-media > img\.product-img/);
});
test("cart previews retain their links, use unfiltered original imagery",()=>{
 assert.match(cart,/\.drawer-cart-item > \.cart-product-link--image img\s*\{[\s\S]*?object-fit:\s*cover/);
 assert.match(cart,/image-rendering:\s*auto/);
});
