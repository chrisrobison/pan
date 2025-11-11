/**
 * pan-jwt component tests
 * Verifies login, refresh, and logout flows.
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

describe('pan-jwt', () => {
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

  async function setupPanJwt() {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    await page.evaluate(() => {
      const script = document.createElement('script');
      script.type = 'module';
      script.src = '/src/components/pan-jwt.mjs';
      document.head.appendChild(script);
    });

    await page.waitForFunction(() => customElements.get('pan-jwt') !== undefined);

    await page.evaluate(() => {
      const existing = document.querySelector('pan-jwt');
      if (existing) existing.remove();
      const el = document.createElement('pan-jwt');
      el.setAttribute('storage', 'memory');
      el.setAttribute('auto-refresh', 'false');
      el.setAttribute('api-url', 'http://localhost:3000');
      document.body.appendChild(el);
    });
  }

  test('handles login success and publishes state', async () => {
    await setupPanJwt();

    await page.route('**/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'header.payload.signature',
          refresh_token: 'refresh-token',
          user: { id: 1, email: 'jwt@example.com' }
        })
      });
    });

    const successPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'auth.login.success') {
            document.removeEventListener('pan:deliver', handler);
            resolve(msg.data);
          }
        };
        document.addEventListener('pan:deliver', handler);
      });
    });

    await publishPanMessage(page, 'auth.login.request', {
      credentials: { email: 'jwt@example.com', password: 'secret' }
    });

    const data = await successPromise;
    expect(data.user.email).toBe('jwt@example.com');

    const state = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus');
      return bus.retained.get('auth.state')?.data;
    });

    expect(state).toBeDefined();
    expect(state.authenticated).toBe(true);
  });

  test('refreshes token when requested', async () => {
    await setupPanJwt();

    await page.route('**/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'initial.token', refresh_token: 'refresh', user: {} })
      });
    });

    await page.route('**/auth/refresh', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'new.token' })
      });
    });

    await publishPanMessage(page, 'auth.login.request', {
      credentials: { email: 'user@example.com', password: 'secret' }
    });

    await page.waitForTimeout(50);

    const refreshPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'auth.token.refreshed') {
            document.removeEventListener('pan:deliver', handler);
            resolve(msg.data);
          }
        };
        document.addEventListener('pan:deliver', handler);
      });
    });

    await publishPanMessage(page, 'auth.token.refresh');

    const refreshed = await refreshPromise;
    expect(refreshed.token).toBe('new.token');
  });

  test('handles logout and clears tokens', async () => {
    await setupPanJwt();

    await page.route('**/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'initial.token', refresh_token: 'refresh', user: {} })
      });
    });

    await publishPanMessage(page, 'auth.login.request', {
      credentials: { email: 'user@example.com', password: 'secret' }
    });

    await page.waitForTimeout(50);

    const logoutPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'auth.logout') {
            document.removeEventListener('pan:deliver', handler);
            resolve(msg.data);
          }
        };
        document.addEventListener('pan:deliver', handler);
      });
    });

    await publishPanMessage(page, 'auth.logout.request');

    const logoutData = await logoutPromise;
    expect(logoutData.success).toBe(true);

    const state = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus');
      return bus.retained.get('auth.state')?.data;
    });

    expect(state.authenticated).toBe(false);
  });
});
