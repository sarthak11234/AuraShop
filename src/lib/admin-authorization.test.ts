import assert from 'node:assert/strict';
import test from 'node:test';
import { hasAdminPermission, isAdminRole } from './admin-authorization';

test('only administrator roles qualify for admin access', () => {
  assert.equal(isAdminRole('CUSTOMER'), false);
  assert.equal(isAdminRole('ADMIN'), true);
  assert.equal(isAdminRole('SUPER_ADMIN'), true);
  assert.equal(isAdminRole(undefined), false);
});

test('super-admin-only permissions cannot be used by an administrator', () => {
  assert.equal(hasAdminPermission('ADMIN', 'ADMIN'), true);
  assert.equal(hasAdminPermission('SUPER_ADMIN', 'ADMIN'), true);
  assert.equal(hasAdminPermission('ADMIN', 'SUPER_ADMIN'), false);
  assert.equal(hasAdminPermission('SUPER_ADMIN', 'SUPER_ADMIN'), true);
});
