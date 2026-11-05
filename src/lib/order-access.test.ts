import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canAccessOrder, hashCheckoutToken } from './order-access';

describe('order ownership', () => {
  it('allows only the authenticated owner to access account orders', () => {
    const order = { userId: 'user-123', guestAccessTokenHash: null };
    assert.equal(canAccessOrder(order, 'user-123', null), true);
    assert.equal(canAccessOrder(order, 'another-user', null), false);
    assert.equal(canAccessOrder(order, null, null), false);
  });

  it('requires the private checkout token for guest order access', () => {
    const token = 'a4d5fb21-99da-42e6-9aa3-f13d9f9e80d2';
    const order = { userId: null, guestAccessTokenHash: hashCheckoutToken(token) };
    assert.equal(canAccessOrder(order, null, token), true);
    assert.equal(canAccessOrder(order, 'signed-in-user', token), true);
    assert.equal(canAccessOrder(order, null, 'wrong-token'), false);
    assert.equal(canAccessOrder(order, null, null), false);
  });
});
