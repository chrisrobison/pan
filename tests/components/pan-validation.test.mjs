/**
 * pan-validation utility tests
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('pan-validation utilities', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  async function importValidation() {
    await page.goto(fileUrl('examples/01-hello.html'));
    return page.evaluate(async () => {
      return import('/src/components/pan-validation.mjs');
    });
  }

  test('validateTopic enforces constraints', async () => {
    const mod = await importValidation();

    const result = await page.evaluate(({ validateTopic }) => {
      return {
        good: validateTopic('app.state'),
        badChars: validateTopic('bad topic'),
        long: validateTopic('a'.repeat(260)),
        doubleDot: validateTopic('app..state')
      };
    }, mod);

    expect(result.good.valid).toBe(true);
    expect(result.badChars.valid).toBe(false);
    expect(result.long.valid).toBe(false);
    expect(result.doubleDot.valid).toBe(false);
  });

  test('validatePattern limits wildcards', async () => {
    const mod = await importValidation();

    const pattern = await page.evaluate(({ validatePattern }) => {
      return {
        allowed: validatePattern('users.*'),
        tooMany: validatePattern('a.*.*.*.*.*.*', { maxWildcards: 3 }),
        disallowGlobal: validatePattern('*', { allowGlobalWildcard: false }),
        invalid: validatePattern('users.s*')
      };
    }, mod);

    expect(pattern.allowed.valid).toBe(true);
    expect(pattern.tooMany.valid).toBe(false);
    expect(pattern.disallowGlobal.valid).toBe(false);
    expect(pattern.invalid.valid).toBe(false);
  });

  test('validateMessage checks serialization and size', async () => {
    const mod = await importValidation();

    const validation = await page.evaluate(({ validateMessage }) => {
      const valid = validateMessage({ topic: 'demo.state', data: { ok: true } });
      const badTopic = validateMessage({ topic: 'bad topic', data: {} });
      const badData = validateMessage({ topic: 'demo.state', data: () => {} });
      return { valid, badTopic, badData };
    }, mod);

    expect(validation.valid.valid).toBe(true);
    expect(validation.badTopic.valid).toBe(false);
    expect(validation.badData.valid).toBe(false);
  });

  test('sanitizeError redacts sensitive tokens', async () => {
    const mod = await importValidation();

    const sanitized = await page.evaluate(({ sanitizeError }) => {
      return sanitizeError('contact me at user@example.com with card 1234-5678-9012-3456');
    }, mod);

    expect(sanitized).not.toContain('user@example.com');
    expect(sanitized).not.toContain('1234-5678-9012-3456');
    expect(sanitized).toContain('[email]');
    expect(sanitized).toContain('[card]');
  });
});
