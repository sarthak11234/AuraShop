import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canTransitionReturnStatus,
  RETURN_STATUS_LABELS,
  returnStatusLabel,
  isTerminalReturnStatus,
  isAdminInitiatedTransition,
  isCustomerInitiatedTransition,
  type ReturnStatus,
} from './return-lifecycle';

test('every return status has a label', () => {
  const statuses: ReturnStatus[] = [
    'REQUESTED',
    'UNDER_REVIEW',
    'APPROVED',
    'PARTIALLY_APPROVED',
    'REJECTED',
    'RETURN_SHIPPED',
    'RETURN_RECEIVED',
    'INSPECTION_PENDING',
    'INSPECTED',
    'REFUND_PENDING',
    'REFUND_PROCESSING',
    'REFUNDED',
    'EXCHANGE_PENDING',
    'EXCHANGE_PROCESSING',
    'EXCHANGED',
    'COMPLETED',
    'CANCELLED',
  ];
  for (const status of statuses) {
    assert.equal(typeof RETURN_STATUS_LABELS[status], 'string');
    assert.equal(returnStatusLabel(status), RETURN_STATUS_LABELS[status]);
  }
});

test('defines a forward-only return lifecycle with no arbitrary transitions', () => {
  assert.equal(canTransitionReturnStatus('REQUESTED', 'UNDER_REVIEW'), true);
  assert.equal(canTransitionReturnStatus('UNDER_REVIEW', 'APPROVED'), true);
  assert.equal(canTransitionReturnStatus('UNDER_REVIEW', 'PARTIALLY_APPROVED'), true);
  assert.equal(canTransitionReturnStatus('UNDER_REVIEW', 'REJECTED'), true);
  assert.equal(canTransitionReturnStatus('APPROVED', 'RETURN_SHIPPED'), true);
  assert.equal(canTransitionReturnStatus('APPROVED', 'CANCELLED'), true);
  assert.equal(canTransitionReturnStatus('RETURN_SHIPPED', 'RETURN_RECEIVED'), true);
  assert.equal(canTransitionReturnStatus('RETURN_RECEIVED', 'INSPECTION_PENDING'), true);
  assert.equal(canTransitionReturnStatus('INSPECTION_PENDING', 'INSPECTED'), true);
  assert.equal(canTransitionReturnStatus('INSPECTED', 'REFUND_PENDING'), true);
  assert.equal(canTransitionReturnStatus('INSPECTED', 'EXCHANGE_PENDING'), true);
  assert.equal(canTransitionReturnStatus('REFUND_PENDING', 'REFUND_PROCESSING'), true);
  assert.equal(canTransitionReturnStatus('REFUND_PROCESSING', 'REFUNDED'), true);
  assert.equal(canTransitionReturnStatus('REFUNDED', 'COMPLETED'), true);
  assert.equal(canTransitionReturnStatus('EXCHANGE_PENDING', 'EXCHANGE_PROCESSING'), true);
  assert.equal(canTransitionReturnStatus('EXCHANGE_PROCESSING', 'EXCHANGED'), true);
  assert.equal(canTransitionReturnStatus('EXCHANGED', 'COMPLETED'), true);
});

test('rejects invalid and terminal status transitions', () => {
  assert.equal(canTransitionReturnStatus('REJECTED', 'APPROVED'), false);
  assert.equal(canTransitionReturnStatus('CANCELLED', 'REQUESTED'), false);
  assert.equal(canTransitionReturnStatus('COMPLETED', 'REFUNDED'), false);
  assert.equal(canTransitionReturnStatus('REQUESTED', 'INSPECTED'), false);
  assert.equal(canTransitionReturnStatus('INSPECTED', 'APPROVED'), false);
});

test('identifies terminal states', () => {
  assert.equal(isTerminalReturnStatus('REJECTED'), true);
  assert.equal(isTerminalReturnStatus('CANCELLED'), true);
  assert.equal(isTerminalReturnStatus('COMPLETED'), true);
  assert.equal(isTerminalReturnStatus('REQUESTED'), false);
  assert.equal(isTerminalReturnStatus('INSPECTED'), false);
});

test('separates customer and admin initiated transitions', () => {
  assert.equal(isCustomerInitiatedTransition('REQUESTED'), true);
  assert.equal(isCustomerInitiatedTransition('CANCELLED'), true);
  assert.equal(isCustomerInitiatedTransition('APPROVED'), false);

  assert.equal(isAdminInitiatedTransition('UNDER_REVIEW'), true);
  assert.equal(isAdminInitiatedTransition('APPROVED'), true);
  assert.equal(isAdminInitiatedTransition('REJECTED'), true);
  assert.equal(isAdminInitiatedTransition('REQUESTED'), false);
});
