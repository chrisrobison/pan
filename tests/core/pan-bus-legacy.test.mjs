/**
 * pan-bus-legacy tests
 * Ensures the legacy bus still routes messages correctly.
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

describe('pan-bus-legacy', () => {
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

  async function loadLegacyBus() {
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <script type="module" src="${fileUrl('src/components/pan-bus-legacy.mjs')}"></script>
        </head>
        <body>
          <pan-bus></pan-bus>
        </body>
      </html>
    `, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => window.__panReady === true);
  }

  test('announces readiness', async () => {
    await loadLegacyBus();

    const ready = await page.evaluate(() => {
      return window.__panReady === true;
    });

    expect(ready).toBe(true);
  });

  test('delivers published messages', async () => {
    await loadLegacyBus();

    const messagePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (event) => {
          resolve(event.detail);
        }, { once: true });
      });
    });

    await publishPanMessage(page, 'legacy.test', { ok: true });
    const message = await messagePromise;

    expect(message.topic).toBe('legacy.test');
    expect(message.data.ok).toBe(true);
  });

  test('supports wildcard subscriptions', async () => {
    await loadLegacyBus();

    await page.evaluate(() => {
      const subscribeEvent = new CustomEvent('pan:subscribe', {
        detail: { topics: ['legacy.*'], clientId: 'legacy-client' },
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(subscribeEvent);
    });

    const messagesPromise = page.evaluate(() => {
      const received = [];
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (event) => {
          const msg = event.detail;
          if (msg.topic.startsWith('legacy.')) {
            received.push(msg.topic);
            if (received.length === 2) {
              resolve(received);
            }
          }
        });
      });
    });

    await publishPanMessage(page, 'legacy.alpha', { value: 1 });
    await publishPanMessage(page, 'legacy.beta', { value: 2 });
    await publishPanMessage(page, 'other.topic', { value: 3 });

    const topics = await messagesPromise;
    expect(topics).toEqual(['legacy.alpha', 'legacy.beta']);
  });
});
