/**
 * pan-auth component tests
 * Validates authentication flows including login and logout handling.
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

async function loadPanAuth(page) {
  await page.goto(fileUrl('examples/01-hello.html'));
  await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

  await page.evaluate(() => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/src/components/pan-auth.mjs';
    document.head.appendChild(script);
  });

  await page.waitForFunction(() => customElements.get('pan-auth') !== undefined);

  await page.evaluate(() => {
    const existing = document.querySelector('pan-auth');
    if (existing) existing.remove();
    const el = document.createElement('pan-auth');
    el.setAttribute('storage', 'memory');
    el.setAttribute('auto-refresh', 'false');
    el.useHttpOnlyCookies = false;
    document.body.appendChild(el);
  });
}

describe('pan-auth', () => {
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

  test('publishes unauthenticated state on connect', async () => {
    await loadPanAuth(page);

    await page.waitForFunction(() => {
      const bus = document.querySelector('pan-bus');
      return !!bus?.retained?.get('auth.state');
    });

    const state = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus');
      return bus.retained.get('auth.state').data;
    });

    expect(state.authenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  test('handles successful login requests', async () => {
    await loadPanAuth(page);

    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'header.payload.signature',
          refreshToken: 'refresh-token',
          user: { id: 1, email: 'user@example.com' }
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

    const statePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'auth.state' && msg.data.authenticated) {
            document.removeEventListener('pan:deliver', handler);
            resolve(msg.data);
          }
        };
        document.addEventListener('pan:deliver', handler);
      });
    });

    await publishPanMessage(page, 'auth.login', { email: 'user@example.com', password: 'secret' }, {
      replyTo: 'auth.reply',
      correlationId: 'test-login'
    });

    const success = await successPromise;
    const state = await statePromise;

    expect(success.user.email).toBe('user@example.com');
    expect(state.authenticated).toBe(true);
    expect(state.user.email).toBe('user@example.com');
  });

  test('clears state on logout', async () => {
    await loadPanAuth(page);

    await page.route('**/api/auth/login', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'header.payload.signature',
          refreshToken: 'refresh-token',
          user: { id: 1, email: 'user@example.com' }
        })
      });
    });

    await publishPanMessage(page, 'auth.login', { email: 'user@example.com', password: 'secret' }, {
      replyTo: 'auth.reply',
      correlationId: 'test-login-2'
    });

    await page.waitForFunction(() => {
      const retained = document.querySelector('pan-bus')?.retained;
      return retained && retained.get('auth.state')?.data?.authenticated === true;
    });

    const logoutStatePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        const handler = (event) => {
          const msg = event.detail;
          if (msg.topic === 'auth.state' && msg.data.authenticated === false) {
            document.removeEventListener('pan:deliver', handler);
            resolve(msg.data);
          }
        };
        document.addEventListener('pan:deliver', handler);
      });
    });

    await publishPanMessage(page, 'auth.logout', {}, {
      replyTo: 'auth.reply',
      correlationId: 'logout'
    });

    const state = await logoutStatePromise;
    expect(state.authenticated).toBe(false);
    expect(state.user).toBeNull();
  });
});
