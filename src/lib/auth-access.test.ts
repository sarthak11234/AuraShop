import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessOrder, hashCheckoutToken } from './order-access';

test('hashCheckoutToken produces a consistent SHA-256 hash', () => {
  const token = 'checkout-token-abc123';
  const hash = hashCheckoutToken(token);
  assert.equal(hash, hashCheckoutToken(token));
  assert.equal(hash.length, 64); // SHA-256 hex = 64 chars
  assert.notEqual(hash, token);
});

test('hashCheckoutToken produces different hashes for different tokens', () => {
  assert.notEqual(hashCheckoutToken('token-a'), hashCheckoutToken('token-b'));
});

test('canAccessOrder allows the order owner', () => {
  const order = { userId: 'user-1', guestAccessTokenHash: null };
  assert.equal(canAccessOrder(order, 'user-1', null), true);
  assert.equal(canAccessOrder(order, 'user-2', null), false);
  assert.equal(canAccessOrder(order, null, null), false);
});

test('canAccessOrder rejects access when order has no user and no token', () => {
  const order = { userId: null, guestAccessTokenHash: null };
  assert.equal(canAccessOrder(order, 'user-1', 'any-token'), false);
  assert.equal(canAccessOrder(order, null, null), false);
});

test('canAccessOrder allows guest access with a matching checkout token', () => {
  const order = {
    userId: null,
    guestAccessTokenHash: hashCheckoutToken('guest-token-xyz'),
  };
  assert.equal(canAccessOrder(order, null, 'guest-token-xyz'), true);
  assert.equal(canAccessOrder(order, null, 'wrong-token'), false);
  assert.equal(canAccessOrder(order, null, null), false);
});

test('canAccessOrder rejects guest access when order belongs to a registered user', () => {
  const order = {
    userId: 'user-1',
    guestAccessTokenHash: hashCheckoutToken('guest-token-xyz'),
  };
  assert.equal(canAccessOrder(order, null, 'guest-token-xyz'), false);
});
