import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCheckoutTotals,
  isValidCheckoutEmail,
  isValidCheckoutName,
  isValidCheckoutPhone,
  normalizeCheckoutAddress,
} from './checkout-rules';

describe('checkout totals from server-priced line items', () => {
  it('calculates shipping, tax and total under the free-shipping threshold', () => {
    assert.deepEqual(
      calculateCheckoutTotals([
        { unitPriceCents: 4500, quantity: 2 },
        { unitPriceCents: 2000, quantity: 1 },
      ]),
      { subtotalCents: 11000, shippingCents: 1500, taxCents: 880, totalCents: 13380 },
    );
  });

  it('applies free shipping at and above $150', () => {
    assert.deepEqual(
      calculateCheckoutTotals([{ unitPriceCents: 15000, quantity: 1 }]),
      { subtotalCents: 15000, shippingCents: 0, taxCents: 1200, totalCents: 16200 },
    );
  });

  it('rejects empty lines, non-integer quantities and unsafe totals', () => {
    assert.equal(calculateCheckoutTotals([]), null);
    assert.equal(calculateCheckoutTotals([{ unitPriceCents: 100, quantity: 0 }]), null);
    assert.equal(calculateCheckoutTotals([{ unitPriceCents: 100, quantity: 1.5 }]), null);
    assert.equal(
      calculateCheckoutTotals([{ unitPriceCents: Number.MAX_SAFE_INTEGER, quantity: 2 }]),
      null,
    );
  });

  it('calculates only from server-provided line prices, not client total fields', () => {
    const body = {
      items: [{ productId: 'p1', size: 'M', quantity: 1, price: 1 }],
      total: 1,
    };
    const serverPriceCents = 18000;
    assert.equal(
      calculateCheckoutTotals([{ unitPriceCents: serverPriceCents, quantity: body.items[0].quantity }])?.totalCents,
      19440,
    );
  });
});

describe('checkout customer and address validation', () => {
  it('validates emails, names and phone numbers', () => {
    assert.equal(isValidCheckoutEmail('test@vexo.store'), true);
    assert.equal(isValidCheckoutEmail('invalid-email'), false);
    assert.equal(isValidCheckoutName('Sarthak'), true);
    assert.equal(isValidCheckoutName(' '), false);
    assert.equal(isValidCheckoutPhone('+1 (555) 019-2831'), true);
    assert.equal(isValidCheckoutPhone('123'), false);
  });

  it('normalizes and requires a complete shipping address', () => {
    assert.deepEqual(
      normalizeCheckoutAddress({
        firstName: ' Ada ',
        lastName: ' Lovelace ',
        addressLine1: ' 12 Example Street ',
        city: ' London ',
        postalCode: ' N1 1AA ',
      }, '+15550192831'),
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        company: null,
        phone: '+15550192831',
        addressLine1: '12 Example Street',
        addressLine2: null,
        city: 'London',
        state: null,
        postalCode: 'N1 1AA',
        country: 'USA',
      },
    );
    assert.equal(
      normalizeCheckoutAddress({
        firstName: 'A',
        lastName: 'Lovelace',
        addressLine1: '12 Example Street',
        city: 'London',
        postalCode: 'N1 1AA',
      }, '+15550192831'),
      null,
    );
  });
});
