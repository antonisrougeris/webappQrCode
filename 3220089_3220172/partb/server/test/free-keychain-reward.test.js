import test from "node:test";
import assert from "node:assert/strict";
import {KEYCHAIN_REWARD_THRESHOLD, qualifiesForKeychain, merchandiseSubtotal, freeKeychainItem, availableKeychainVariant} from "../src/services/free-keychain-reward.service.js";

test("one reward is earned only at 80 EUR of merchandise", () => {
  assert.equal(KEYCHAIN_REWARD_THRESHOLD, 80);
  assert.equal(qualifiesForKeychain(79.99), false);
  assert.equal(qualifiesForKeychain(80), true);
  assert.equal(qualifiesForKeychain(95), true);
});

test("free reward never contributes to qualifying subtotal", () => {
  assert.equal(merchandiseSubtotal([{price: 70,quantity:1},{price:0,quantity:1,isFreeReward:true}]),70);
  assert.equal(merchandiseSubtotal([{price: 40,quantity:2}]),80);
});

test("reward is zero priced and keeps original product price as reference", () => {
  const item = freeKeychainItem({title:"NFC Keychain",price:9.9,images:["/nfc.png"],customQr:true});
  assert.equal(item.price,0);
  assert.equal(item.quantity,1);
  assert.equal(item.originalPrice,9.9);
  assert.equal(item.isFreeReward,true);
  assert.equal(item.productId,"nfc-keychain");
});

test("reward unavailable when stock is zero", () => {
  assert.equal(availableKeychainVariant({stock:0}),null);
  assert.equal(availableKeychainVariant({variants:[{stock:0}]}),null);
  assert.equal(availableKeychainVariant({variants:[{sku:"BLACK",stock:5}]}).sku,"BLACK");
});
