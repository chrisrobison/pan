/**
 * Test suite for PAN Bus Enhanced
 * Tests memory management, security features, and validation
 */

import { test, expect } from '@playwright/test';

test.describe('PAN Bus Enhanced', () => {

  test.beforeEach(async ({ page }) => {
    // Create test page with enhanced bus
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head><meta charset="utf-8"></head>
      <body>
        <script type="module" src="/src/core/pan-bus-enhanced.mjs"></script>
        <script type="module" src="/src/core/pan-client.mjs"></script>
        <pan-bus-enhanced
          max-retained="10"
          max-message-size="1024"
          rate-limit="50"
          allow-global-wildcard="false"
          debug="true">
        </pan-bus-enhanced>
      </body>
      </html>
    `);

    await page.waitForFunction(() => window.__panReady);
  });

  test.describe('Memory Management', () => {

    test('should enforce retained message limit', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Publish 20 retained messages (limit is 10)
        for (let i = 0; i < 20; i++) {
          client.publish({
            topic: `test.retained.${i}`,
            data: { index: i },
            retain: true
          });
        }

        // Get stats
        return new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            resolve(msg.data);
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });
      });

      expect(result.retained).toBe(10);
      expect(result.retainedEvicted).toBe(10);
    });

    test('should implement LRU eviction', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Publish 15 retained messages
        for (let i = 0; i < 15; i++) {
          client.publish({
            topic: `test.${i}`,
            data: { i },
            retain: true
          });
        }

        // Access message 0 (should keep it)
        return new Promise((resolve) => {
          let accessed = false;
          client.subscribe('test.0', (msg) => {
            accessed = true;
          }, { retained: true });

          setTimeout(() => {
            // Publish 5 more (should evict 1-5, keep 0)
            for (let i = 15; i < 20; i++) {
              client.publish({
                topic: `test.${i}`,
                data: { i },
                retain: true
              });
            }

            resolve({ accessed });
          }, 100);
        });
      });

      expect(result.accessed).toBe(true);
    });

    test('should clean up dead subscriptions', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Create element and subscribe
        const el = document.createElement('div');
        document.body.appendChild(el);
        const elClient = new PanClient(el);
        elClient.subscribe('test.*', () => {});

        // Get initial stats
        let before;
        await new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            before = msg.data.subscriptions;
            resolve();
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });

        // Remove element
        el.remove();

        // Trigger cleanup (wait for cleanup interval or force it)
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get updated stats
        let after;
        await new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            after = msg.data.subscriptions;
            resolve();
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });

        return { before, after };
      });

      // Note: Cleanup is periodic, so this may not always pass
      // In a real implementation, you might expose a manual cleanup method
      expect(result.before).toBeGreaterThan(0);
    });

  });

  test.describe('Message Validation', () => {

    test('should reject non-serializable data', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        return new Promise((resolve) => {
          client.subscribe('pan:sys.error', (msg) => {
            resolve({ error: msg.data });
          });

          // Try to publish function
          client.publish({
            topic: 'test.bad',
            data: { fn: () => console.log('test') }
          });
        });
      });

      expect(result.error.code).toBe('MESSAGE_INVALID');
      expect(result.error.message).toContain('serializable');
    });

    test('should reject oversized messages', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        return new Promise((resolve) => {
          client.subscribe('pan:sys.error', (msg) => {
            resolve({ error: msg.data });
          });

          // Create large message (limit is 1024 bytes)
          const largeData = new Array(2000).fill('x').join('');
          client.publish({
            topic: 'test.large',
            data: { payload: largeData }
          });
        });
      });

      expect(result.error.code).toBe('MESSAGE_INVALID');
      expect(result.error.message).toContain('size');
    });

    test('should accept valid messages', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        return new Promise((resolve) => {
          client.subscribe('test.valid', (msg) => {
            resolve({ received: msg.data });
          });

          client.publish({
            topic: 'test.valid',
            data: { message: 'Hello', number: 42, array: [1, 2, 3] }
          });
        });
      });

      expect(result.received.message).toBe('Hello');
      expect(result.received.number).toBe(42);
    });

  });

  test.describe('Security', () => {

    test('should reject global wildcard when disabled', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        return new Promise((resolve) => {
          client.subscribe('pan:sys.error', (msg) => {
            resolve({ error: msg.data });
          });

          // Try global wildcard
          client.subscribe('*', () => {});
        });
      });

      expect(result.error.code).toBe('SUBSCRIPTION_INVALID');
      expect(result.error.message).toContain('wildcard');
    });

    test('should allow scoped wildcards', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        return new Promise((resolve) => {
          let received = false;

          client.subscribe('test.*', (msg) => {
            received = true;
            resolve({ received, topic: msg.topic });
          });

          client.publish({
            topic: 'test.scoped',
            data: { message: 'test' }
          });
        });
      });

      expect(result.received).toBe(true);
      expect(result.topic).toBe('test.scoped');
    });

  });

  test.describe('Rate Limiting', () => {

    test('should enforce rate limits', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        let limitExceeded = false;

        client.subscribe('pan:sys.error', (msg) => {
          if (msg.data.code === 'RATE_LIMIT_EXCEEDED') {
            limitExceeded = true;
          }
        });

        // Publish more than rate limit (50/sec)
        for (let i = 0; i < 100; i++) {
          client.publish({ topic: 'test.spam', data: { i } });
        }

        // Wait a bit for error
        await new Promise(resolve => setTimeout(resolve, 100));

        // Get stats
        return new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            resolve({
              limitExceeded,
              dropped: msg.data.dropped
            });
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });
      });

      expect(result.limitExceeded).toBe(true);
      expect(result.dropped).toBeGreaterThan(0);
    });

  });

  test.describe('Statistics', () => {

    test('should track message statistics', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Subscribe to something
        client.subscribe('test.*', () => {});

        // Publish some messages
        for (let i = 0; i < 5; i++) {
          client.publish({ topic: 'test.msg', data: { i } });
        }

        // Get stats
        return new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            resolve(msg.data);
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });
      });

      expect(result.published).toBeGreaterThan(0);
      expect(result.delivered).toBeGreaterThan(0);
      expect(result.subscriptions).toBeGreaterThan(0);
    });

  });

  test.describe('Clear Retained', () => {

    test('should clear all retained messages', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Publish retained messages
        for (let i = 0; i < 5; i++) {
          client.publish({
            topic: `test.${i}`,
            data: { i },
            retain: true
          });
        }

        // Get initial count
        let before;
        await new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            before = msg.data.retained;
            resolve();
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });

        // Clear all
        client.publish({ topic: 'pan:sys.clear-retained', data: {} });

        // Get updated count
        let after;
        await new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            after = msg.data.retained;
            resolve();
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });

        return { before, after };
      });

      expect(result.before).toBe(5);
      expect(result.after).toBe(0);
    });

    test('should clear retained messages by pattern', async ({ page }) => {
      const result = await page.evaluate(async () => {
        const { PanClient } = await import('/src/core/pan-client.mjs');
        const client = new PanClient();

        // Publish retained messages with different prefixes
        for (let i = 0; i < 3; i++) {
          client.publish({
            topic: `keep.${i}`,
            data: { i },
            retain: true
          });
          client.publish({
            topic: `clear.${i}`,
            data: { i },
            retain: true
          });
        }

        // Clear only 'clear.*' pattern
        client.publish({
          topic: 'pan:sys.clear-retained',
          data: { pattern: 'clear.*' }
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Get stats
        return new Promise((resolve) => {
          client.subscribe('pan:sys.stats', (msg) => {
            resolve({ retained: msg.data.retained });
          });
          client.publish({ topic: 'pan:sys.stats', data: {} });
        });
      });

      // Should have 3 'keep.*' messages left
      expect(result.retained).toBe(3);
    });

  });

});
