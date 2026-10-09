import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('authentication cart merge preserves guest products, quantities, variants and gift options', async () => {
  const source = readFileSync(new URL('../src/services/cart.service.js', import.meta.url), 'utf8');
  const start = source.indexOf('export async function mergeGuestCartIntoUserCart(');
  const end = source.indexOf('export async function copyUserCartToGuestCart(', start);
  const carts = {
    guest: { items: [{ id: 'g1', productId: 'shirt', quantity: 2, variant: { sku: 'BLUE-M' } },
      { id: 'g2', productId: 'shirt', quantity: 1, variant: { sku: 'RED-L' } }], giftOptions: { giftBox: true, personalNote: 'Gift' } },
    user: { items: [{ id: 'u1', productId: 'shirt', quantity: 1, variant: { sku: 'BLUE-M' } }] },
  };
  const context = vm.createContext({
    getDB: () => ({ collection: () => ({ doc: id => ({
      set: async value => { carts[id] = value; }, delete: async () => { delete carts[id]; },
    }) }) }), COLLECTIONS: { CARTS: 'carts' }, getCartByUserId: async id => carts[id],
    nowIso: () => '2026-10-09', normalizeGiftOptions: x => x,
    refreshCartReservations: async ({ items, ownerId, ownerType }) => {
      assert.equal(ownerId, 'user'); assert.equal(ownerType, 'user'); return items;
    }, releaseInventoryHold: async () => {}, getInventoryKey: () => '', createId: () => 'new',
  });
  vm.runInContext(source.slice(start, end).replace('export ', ''), context);
  await vm.runInContext('mergeGuestCartIntoUserCart({ guestId: "guest", userId: "user" })', context);
  assert.equal(carts.user.items.length, 2);
  assert.equal(carts.user.items[0].quantity, 3);
  assert.equal(carts.user.items[0].variant.sku, 'BLUE-M');
  assert.equal(carts.user.items[1].quantity, 1);
  assert.equal(carts.user.items[1].variant.sku, 'RED-L');
  assert.equal(carts.user.giftOptions.personalNote, 'Gift');
  assert.equal(carts.guest, undefined);
});
