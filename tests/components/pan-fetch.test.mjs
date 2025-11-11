/**
 * pan-fetch tests
 * Validates the authenticated fetch helper behaviour.
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

describe('pan-fetch', () => {
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

  async function setupPanFetch() {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    await page.evaluate(async () => {
      window.__fetchCalls = [];
      window.__originalFetch = window.fetch;
      window.fetch = (input, init = {}) => {
        window.__fetchCalls.push({ input, init });
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }));
      };
      window.panFetchModule = await import('/src/components/pan-fetch.mjs');
    });
  }

  test('uses credentials include by default', async () => {
    await setupPanFetch();

    await page.evaluate(async () => {
      await window.panFetchModule.panFetch.fetch('/api/example');
    });

    const call = await page.evaluate(() => {
      const [first] = window.__fetchCalls;
      return { credentials: first.init.credentials };
    });

    expect(call.credentials).toBe('include');

    await page.evaluate(() => {
      window.fetch = window.__originalFetch;
      delete window.__originalFetch;
      delete window.__fetchCalls;
      delete window.panFetchModule;
    });
  });

  test('injects authorization header when token available', async () => {
    await setupPanFetch();

    await publishPanMessage(page, 'auth.internal.state', {
      authenticated: true,
      token: 'secure-token'
    });

    await page.waitForTimeout(50);

    await page.evaluate(async () => {
      await window.panFetchModule.panFetch.fetch('/api/secure');
    });

    const headers = await page.evaluate(() => {
      const [first] = window.__fetchCalls;
      const entries = first.init.headers instanceof Headers
        ? Array.from(first.init.headers.entries())
        : Object.entries(first.init.headers || {});
      return Object.fromEntries(entries);
    });

    expect(headers.authorization).toBe('Bearer secure-token');

    await page.evaluate(() => {
      window.fetch = window.__originalFetch;
      delete window.__originalFetch;
      delete window.__fetchCalls;
      delete window.panFetchModule;
    });
  });
});
