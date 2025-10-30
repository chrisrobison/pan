/**
 * Simple test to verify the test runner works
 */

import { describe, test, expect } from './lib/test-runner.mjs';

describe('basic test runner', () => {
  test('can run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  test('has working assertions', () => {
    expect('hello').toContain('ell');
    expect([1, 2, 3]).toHaveLength(3);
    expect({ name: 'test' }).toHaveProperty('name');
  });

  test('supports async tests', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
