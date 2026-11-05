import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateProviderAvailability } from '@/components/auth/SignInModal';

test('evaluateProviderAvailability: no providers configured', () => {
  const result = evaluateProviderAvailability([]);
  assert.equal(result.google, false);
  assert.equal(result.github, false);
  assert.equal(result.resend, false);
  assert.equal(result.hasAny, false);
  assert.equal(result.missing.length, 3);
  assert.ok(result.missing.includes('AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET'));
  assert.ok(result.missing.includes('AUTH_GITHUB_ID / AUTH_GITHUB_SECRET'));
  assert.ok(result.missing.includes('AUTH_RESEND_KEY'));
});

test('evaluateProviderAvailability: only google configured', () => {
  const result = evaluateProviderAvailability(['google']);
  assert.equal(result.google, true);
  assert.equal(result.github, false);
  assert.equal(result.resend, false);
  assert.equal(result.hasAny, true);
  assert.equal(result.missing.length, 2);
  assert.ok(!result.missing.includes('AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET'));
  assert.ok(result.missing.includes('AUTH_GITHUB_ID / AUTH_GITHUB_SECRET'));
  assert.ok(result.missing.includes('AUTH_RESEND_KEY'));
});

test('evaluateProviderAvailability: only github configured', () => {
  const result = evaluateProviderAvailability(['github']);
  assert.equal(result.google, false);
  assert.equal(result.github, true);
  assert.equal(result.resend, false);
  assert.equal(result.hasAny, true);
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.includes('AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET'));
  assert.ok(!result.missing.includes('AUTH_GITHUB_ID / AUTH_GITHUB_SECRET'));
  assert.ok(result.missing.includes('AUTH_RESEND_KEY'));
});

test('evaluateProviderAvailability: only resend configured', () => {
  const result = evaluateProviderAvailability(['resend']);
  assert.equal(result.google, false);
  assert.equal(result.github, false);
  assert.equal(result.resend, true);
  assert.equal(result.hasAny, true);
  assert.equal(result.missing.length, 2);
  assert.ok(result.missing.includes('AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET'));
  assert.ok(result.missing.includes('AUTH_GITHUB_ID / AUTH_GITHUB_SECRET'));
  assert.ok(!result.missing.includes('AUTH_RESEND_KEY'));
});

test('evaluateProviderAvailability: all providers configured', () => {
  const result = evaluateProviderAvailability(['google', 'github', 'resend']);
  assert.equal(result.google, true);
  assert.equal(result.github, true);
  assert.equal(result.resend, true);
  assert.equal(result.hasAny, true);
  assert.equal(result.missing.length, 0);
});

test('evaluateProviderAvailability: null input', () => {
  const result = evaluateProviderAvailability(null);
  assert.equal(result.google, false);
  assert.equal(result.github, false);
  assert.equal(result.resend, false);
  assert.equal(result.hasAny, false);
  assert.equal(result.missing.length, 3);
});
