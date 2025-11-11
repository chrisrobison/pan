/**
 * pan-inspector tests
 * Ensures the inspector renders messages and controls correctly.
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

describe('pan-inspector', () => {
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

  async function setupInspector() {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    await page.evaluate(() => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/src/components/pan-inspector.mjs';
      document.head.appendChild(script);
    });

    await page.waitForFunction(() => customElements.get('pan-inspector') !== undefined);

    await page.evaluate(() => {
      const existing = document.querySelector('pan-inspector');
      if (existing) existing.remove();
      const el = document.createElement('pan-inspector');
      document.body.appendChild(el);
    });
  }

  test('renders received messages', async () => {
    await setupInspector();

    await publishPanMessage(page, 'inspector.demo', { value: 1 });
    await publishPanMessage(page, 'inspector.demo', { value: 2 });

    const rowCount = await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      return inspector.shadowRoot.querySelectorAll('tbody tr').length;
    });

    expect(rowCount).toBeGreaterThanOrEqual(2);
  });

  test('filters by topic and toggles pause', async () => {
    await setupInspector();

    await publishPanMessage(page, 'inspector.visible', { value: 1 });
    await publishPanMessage(page, 'hidden.topic', { value: 2 });

    await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      const input = inspector.shadowRoot.getElementById('filter');
      input.value = 'visible';
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    });

    const filteredCount = await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      return Array.from(inspector.shadowRoot.querySelectorAll('tbody tr')).filter(row => row.textContent.includes('visible')).length;
    });

    expect(filteredCount).toBeGreaterThanOrEqual(1);

    await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      inspector.shadowRoot.getElementById('pause').click();
    });

    await publishPanMessage(page, 'inspector.visible', { value: 3 });

    const countAfterPause = await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      return inspector.shadowRoot.querySelectorAll('tbody tr').length;
    });

    expect(countAfterPause).toBe(filteredCount);
  });

  test('replays messages when requested', async () => {
    await setupInspector();

    await publishPanMessage(page, 'inspector.replay', { value: 9 });

    const replayPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'inspector.replay') {
            document.removeEventListener('pan:publish', handler);
            resolve(msg.data.value);
          }
        };
        document.addEventListener('pan:publish', handler);
      });
    });

    await page.evaluate(() => {
      const inspector = document.querySelector('pan-inspector');
      const replayBtn = inspector.shadowRoot.querySelector('button.replay');
      replayBtn.click();
    });

    const replayed = await replayPromise;
    expect(replayed).toBe(9);
  });
});
