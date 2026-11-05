import assert from 'node:assert/strict';
import test from 'node:test';
import { wishlistOwnershipAction } from './wishlist-ownership';

test('keeps a guest wishlist for guests', () => {
  assert.equal(wishlistOwnershipAction(null, null), 'keep');
});

test('claims guest items when a customer signs in', () => {
  assert.equal(wishlistOwnershipAction(null, 'user-1'), 'claim');
});

test('keeps the wishlist for the same signed-in customer', () => {
  assert.equal(wishlistOwnershipAction('user-1', 'user-1'), 'keep');
});

test('resets the wishlist when a different customer signs in', () => {
  assert.equal(wishlistOwnershipAction('user-1', 'user-2'), 'reset-to-user');
});

test('clears the wishlist when an authenticated customer signs out', () => {
  assert.equal(wishlistOwnershipAction('user-1', null), 'clear');
});
