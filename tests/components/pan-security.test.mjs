/**
 * pan-security utility tests
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('pan-security utilities', () => {
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

  async function importSecurity() {
    await page.goto(fileUrl('examples/01-hello.html'));
    return page.evaluate(async () => {
      return import('/src/components/pan-security.mjs');
    });
  }

  test('enforceHTTPS redirects http hosts when not allowed', async () => {
    const mod = await importSecurity();

    const redirect = await page.evaluate(({ enforceHTTPS }) => {
      let redirectedTo = null;
      const originalReplace = window.location.replace;
      window.location.replace = (url) => { redirectedTo = url; };
      enforceHTTPS({ enforce: true, allowedHosts: [] });
      window.location.replace = originalReplace;
      return redirectedTo;
    }, mod);

    expect(redirect).toBe('https://localhost:3000/examples/01-hello.html');
  });

  test('sanitization helpers escape HTML and URLs', async () => {
    const mod = await importSecurity();

    const result = await page.evaluate(({ sanitizeHTML, isSafeURL, setSafeHref }) => {
      const escaped = sanitizeHTML('<script>alert(1)</script>');
      const safe = isSafeURL('https://example.com');
      const unsafe = isSafeURL('javascript:alert(1)');
      const link = document.createElement('a');
      setSafeHref(link, 'javascript:alert(1)');
      return { escaped, safe, unsafe, href: link.getAttribute('href') };
    }, mod);

    expect(result.escaped).toContain('&lt;script&gt;');
    expect(result.safe).toBe(true);
    expect(result.unsafe).toBe(false);
    expect(result.href).toBe('#');
  });

  test('safeSetHTML uses DOMPurify when available', async () => {
    const mod = await importSecurity();

    const html = await page.evaluate(({ safeSetHTML }) => {
      window.DOMPurify = { sanitize: (value) => value.replace('bad', 'good') };
      const el = document.createElement('div');
      safeSetHTML(el, '<p>bad</p>');
      const output = el.innerHTML;
      delete window.DOMPurify;
      return output;
    }, mod);

    expect(html).toBe('<p>good</p>');
  });

  test('checkCSP reports missing policy', async () => {
    const mod = await importSecurity();

    const status = await page.evaluate(({ checkCSP }) => {
      return checkCSP();
    }, mod);

    expect(status.configured).toBe(false);
    expect(status.meta).toBeNull();
  });
});
