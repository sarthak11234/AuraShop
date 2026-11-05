import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isOwnedSavedAddress,
  isValidAddressId,
  normalizeAccountName,
  normalizeAccountPhone,
  validateProfileInput,
  validateSavedAddressInput,
} from './account-validation';

const validAddress = {
  kind: 'shipping',
  firstName: 'Ada',
  lastName: 'Lovelace',
  company: 'Analytical Engines',
  phone: '+1 (555) 019-2831',
  addressLine1: '12 Computation Avenue',
  addressLine2: 'Suite 4',
  landmark: 'Next to the observatory',
  city: 'London',
  state: 'LDN',
  postalCode: 'N1 9GU',
  country: 'UK',
  isDefaultShipping: true,
  isDefaultBilling: false,
};

test('normalizes account names without changing their display content', () => {
  assert.equal(normalizeAccountName('  Ada   King   Lovelace '), 'Ada King Lovelace');
  assert.equal(normalizeAccountName('  '), '');
});

test('normalizes international phone numbers to a canonical form', () => {
  assert.equal(normalizeAccountPhone('+1 (555) 019-2831'), '+15550192831');
  assert.equal(normalizeAccountPhone('555.019.2831'), '5550192831');
  assert.equal(normalizeAccountPhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(normalizeAccountPhone(''), null);
  assert.equal(normalizeAccountPhone('call-me-maybe'), null);
  assert.equal(normalizeAccountPhone('12345'), null);
});

test('accepts only permitted profile fields', () => {
  const result = validateProfileInput({
    name: '  Ada   Lovelace ',
    phone: '+1 (555) 019-2831',
    email: 'attacker@example.test',
    role: 'ADMIN',
  });
  assert.deepEqual(result, {
    ok: false,
    error:
      'email cannot be changed here. Email changes must be completed through the sign-in provider.',
  });

  for (const field of ['id', 'emailVerified', 'role', 'permissions', 'password', 'image']) {
    const forbidden = validateProfileInput({ name: 'Ada Lovelace', [field]: 'x' });
    assert.equal(forbidden.ok, false, `${field} must be rejected`);
  }
});

test('validates profile updates and normalizes optional input', () => {
  assert.deepEqual(
    validateProfileInput({ name: '  Ada   Lovelace ', phone: '+1 (555) 019-2831' }),
    {
      ok: true,
      data: { name: 'Ada Lovelace', phone: '+15550192831' },
    },
  );
  assert.deepEqual(validateProfileInput({ name: 'Ada Lovelace', phone: '' }), {
    ok: true,
    data: { name: 'Ada Lovelace', phone: null },
  });
  assert.equal(validateProfileInput({ name: 'A' }).ok, false);
  assert.equal(validateProfileInput({ name: 'Ada Lovelace', phone: '123' }).ok, false);
  assert.equal(validateProfileInput(null).ok, false);
  assert.equal(validateProfileInput([]).ok, false);
});

test('validates saved address payloads and default flags', () => {
  const result = validateSavedAddressInput(validAddress);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.data.phone, '+15550192831');
  assert.equal(result.data.landmark, 'Next to the observatory');
  assert.equal(result.data.isDefaultShipping, true);
  assert.equal(result.data.isDefaultBilling, false);

  const minimal = validateSavedAddressInput({
    ...validAddress,
    kind: undefined,
    company: '',
    addressLine2: '',
    landmark: '',
    isDefaultShipping: undefined,
    isDefaultBilling: undefined,
  });
  assert.equal(minimal.ok, true);
  if (!minimal.ok) return;
  assert.equal(minimal.data.kind, 'shipping');
  assert.equal(minimal.data.company, null);
  assert.equal(minimal.data.addressLine2, null);
  assert.equal(minimal.data.landmark, null);
  assert.equal(minimal.data.isDefaultShipping, false);
  assert.equal(minimal.data.isDefaultBilling, false);
});

test('rejects malformed saved address payloads', () => {
  assert.equal(validateSavedAddressInput(null).ok, false);
  assert.equal(validateSavedAddressInput({ ...validAddress, kind: 'warehouse' }).ok, false);
  assert.equal(
    validateSavedAddressInput({ ...validAddress, isDefaultShipping: 'yes' }).ok,
    false,
  );
  assert.equal(
    validateSavedAddressInput({ ...validAddress, isDefaultBilling: 1 }).ok,
    false,
  );
  assert.equal(
    validateSavedAddressInput({ ...validAddress, addressLine1: '12' }).ok,
    false,
  );
  assert.equal(
    validateSavedAddressInput({ ...validAddress, phone: '12345' }).ok,
    false,
  );
  assert.equal(
    validateSavedAddressInput({ ...validAddress, landmark: 'x'.repeat(121) }).ok,
    false,
  );
  assert.equal(
    validateSavedAddressInput({ ...validAddress, firstName: 'A' }).ok,
    false,
  );
});

test('saved address ownership excludes other customers and order snapshots', () => {
  assert.equal(isOwnedSavedAddress({ userId: 'user-1', orderId: null }, 'user-1'), true);
  assert.equal(isOwnedSavedAddress({ userId: 'user-2', orderId: null }, 'user-1'), false);
  assert.equal(isOwnedSavedAddress({ userId: 'user-1', orderId: 'order-1' }, 'user-1'), false);
  assert.equal(isOwnedSavedAddress({ userId: null, orderId: null }, 'user-1'), false);
});

test('accepts only positive integer address identifiers', () => {
  assert.equal(isValidAddressId('1'), true);
  assert.equal(isValidAddressId('4294967295'), true);
  assert.equal(isValidAddressId('0'), false);
  assert.equal(isValidAddressId('-1'), false);
  assert.equal(isValidAddressId('1.5'), false);
  assert.equal(isValidAddressId('abc'), false);
  assert.equal(isValidAddressId(''), false);
});
