/**
 * pan-client core tests
 * Tests the client API functionality
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('PanClient', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('creates client and connects to bus', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();
      return {
        hasClient: client !== null,
        hasClientId: client.clientId.length > 0,
        hasBus: client.bus !== null
      };
    });

    expect(result.hasClient).toBe(true);
    expect(result.hasClientId).toBe(true);
    expect(result.hasBus).toBe(true);
  });

  test('publishes messages using pub()', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          if (e.detail.topic === 'test.pub') {
            resolve(e.detail);
          }
        }, { once: true });

        // Subscribe first
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.pub'], clientId: 'listener' },
          bubbles: true,
          composed: true
        }));

        // Publish using pub()
        client.pub('test.pub', { message: 'hello' });
      });
    });

    expect(result.topic).toBe('test.pub');
    expect(result.data.message).toBe('hello');
  });

  test('subscribes to messages using sub()', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      return new Promise((resolve) => {
        // Subscribe using sub()
        client.sub('test.sub', (msg) => {
          resolve(msg);
        });

        // Publish a message
        setTimeout(() => {
          client.pub('test.sub', { received: true });
        }, 50);
      });
    });

    expect(result.topic).toBe('test.sub');
    expect(result.data.received).toBe(true);
  });

  test('unsubscribes using returned function', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      let count = 0;

      const unsub = client.sub('test.unsub', (msg) => {
        count++;
      });

      // Publish first message
      client.pub('test.unsub', { n: 1 });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Unsubscribe
      unsub();

      // Publish second message
      client.pub('test.unsub', { n: 2 });

      await new Promise(resolve => setTimeout(resolve, 50));

      return count;
    });

    expect(result).toBe(1); // Only first message received
  });

  test('request/reply pattern works', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      // Set up a responder
      client.subscribe('echo.request', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { echo: msg.data },
            correlationId: msg.correlationId
          });
        }
      });

      // Make a request
      const reply = await client.request('echo.request', { message: 'test' });
      return reply.data;
    });

    expect(result.echo.message).toBe('test');
  });

  test('request times out when no reply', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      try {
        await client.request('no.responder', { test: true }, { timeoutMs: 500 });
        return { timedOut: false };
      } catch (err) {
        return { timedOut: true, message: err.message };
      }
    });

    expect(result.timedOut).toBe(true);
    expect(result.message).toContain('timeout');
  });

  test('subscribes to multiple topics with array', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      const received = [];

      return new Promise((resolve) => {
        // Subscribe to multiple topics
        client.subscribe(['user.login', 'user.logout'], (msg) => {
          received.push(msg.topic);
          if (received.length === 2) {
            resolve(received);
          }
        });

        // Publish to both topics
        setTimeout(() => {
          client.pub('user.login', {});
          client.pub('user.logout', {});
        }, 50);
      });
    });

    expect(result).toEqual(['user.login', 'user.logout']);
  });

  test('pattern matching works correctly', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      return {
        exactMatch: PanClient.matches('user.login', 'user.login'),
        wildcardAll: PanClient.matches('user.login', '*'),
        wildcardSuffix: PanClient.matches('user.login', 'user.*'),
        wildcardPrefix: PanClient.matches('user.login', '*.login'),
        noMatch: PanClient.matches('user.login', 'admin.*')
      };
    });

    expect(result.exactMatch).toBe(true);
    expect(result.wildcardAll).toBe(true);
    expect(result.wildcardSuffix).toBe(true);
    expect(result.wildcardPrefix).toBe(true);
    expect(result.noMatch).toBe(false);
  });

  test('retained subscription receives past messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');
      const client = new PanClient();
      await client.ready();

      // Publish a retained message first
      client.pub('app.config', { theme: 'dark' }, { retain: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Subscribe later with retained option
      return new Promise((resolve) => {
        client.subscribe('app.config', (msg) => {
          resolve(msg.data);
        }, { retained: true });
      });
    });

    expect(result.theme).toBe('dark');
  });
});
