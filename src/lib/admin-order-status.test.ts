import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionOrderStatus } from './admin-order-status';

test('allows only the configured forward fulfilment transitions', () => {
  assert.equal(canTransitionOrderStatus('PENDING', 'CONFIRMED'), true);
  assert.equal(canTransitionOrderStatus('CONFIRMED', 'PROCESSING'), true);
  assert.equal(canTransitionOrderStatus('PROCESSING', 'PACKED'), true);
  assert.equal(canTransitionOrderStatus('PROCESSING', 'SHIPPED'), true);
  assert.equal(canTransitionOrderStatus('PACKED', 'SHIPPED'), true);
  assert.equal(canTransitionOrderStatus('SHIPPED', 'OUT_FOR_DELIVERY'), true);
  assert.equal(canTransitionOrderStatus('OUT_FOR_DELIVERY', 'DELIVERED'), true);
  assert.equal(canTransitionOrderStatus('OUT_FOR_DELIVERY', 'FAILED_DELIVERY'), true);
  assert.equal(canTransitionOrderStatus('FAILED_DELIVERY', 'OUT_FOR_DELIVERY'), true);
  assert.equal(canTransitionOrderStatus('DELIVERED', 'RETURNED'), true);
  assert.equal(canTransitionOrderStatus('PROCESSING', 'CANCELLED'), true);
  assert.equal(canTransitionOrderStatus('PACKED', 'CANCELLED'), true);
});

test('rejects invalid and terminal status changes', () => {
  assert.equal(canTransitionOrderStatus('PENDING', 'SHIPPED'), false);
  assert.equal(canTransitionOrderStatus('PENDING', 'PACKED'), false);
  assert.equal(canTransitionOrderStatus('PACKED', 'PROCESSING'), false);
  assert.equal(canTransitionOrderStatus('SHIPPED', 'CANCELLED'), false);
  assert.equal(canTransitionOrderStatus('FAILED_DELIVERY', 'DELIVERED'), false);
  assert.equal(canTransitionOrderStatus('DELIVERED', 'PROCESSING'), false);
  assert.equal(canTransitionOrderStatus('CANCELLED', 'PENDING'), false);
  assert.equal(canTransitionOrderStatus('RETURNED', 'DELIVERED'), false);
});
