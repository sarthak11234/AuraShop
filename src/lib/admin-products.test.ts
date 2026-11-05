import assert from 'node:assert/strict';
import test from 'node:test';
import { validateProductBody } from './admin-products';

const validProduct = {
  title: 'Field Jacket',
  slug: 'field-jacket',
  subtitle: 'Utility outerwear',
  categoryId: 'category_1',
  description: 'A weather-resistant layer.',
  details: ['Recycled fabric'],
  images: ['/images/field-jacket.jpg', '#ffffff'],
  price: 180,
  version: '01',
  isNew: false,
  isPublished: false,
  sizes: ['S', 'M'],
};

test('accepts a valid admin product payload', () => {
  const result = validateProductBody(validProduct);
  assert.equal('error' in result, false);
  assert.ok('data' in result && result.data);
  assert.equal(result.data.slug, 'field-jacket');
  assert.deepEqual(result.data.sizes, ['S', 'M']);
});

test('rejects duplicate slugs formats and non-positive prices', () => {
  assert.equal('error' in validateProductBody({ ...validProduct, slug: 'Field Jacket' }), true);
  assert.equal('error' in validateProductBody({ ...validProduct, price: 0 }), true);
  assert.equal('error' in validateProductBody({ ...validProduct, price: Number.NaN }), true);
});

test('rejects unsafe images and duplicate size variants', () => {
  assert.equal('error' in validateProductBody({ ...validProduct, images: ['http://example.test/x.jpg'] }), true);
  assert.equal('error' in validateProductBody({ ...validProduct, sizes: ['M', 'm'] }), true);
});
