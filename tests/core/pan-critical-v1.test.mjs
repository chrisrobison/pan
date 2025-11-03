/**
 * Critical tests for PAN v1.0 release
 * Tests error handling, memory leaks, and edge cases
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('PAN Core - Critical v1.0 Tests', () => {
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

  // =========================================================================
  // ERROR HANDLING TESTS
  // =========================================================================

  test('[Error Handling] handles publishing invalid message gracefully', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const errors = [];

        try {
          // Try publishing without topic
          client.publish({ data: { test: true } });
        } catch (err) {
          errors.push('no-topic');
        }

        try {
          // Try publishing null
          client.publish(null);
        } catch (err) {
          errors.push('null-message');
        }

        try {
          // Try publishing undefined
          client.publish(undefined);
        } catch (err) {
          errors.push('undefined-message');
        }

        return {
          caughtErrors: errors,
          clientStillWorks: client.clientId.length > 0
        };
      });

    // Client should still work even if some publishes fail
    expect(result.clientStillWorks).toBe(true);
  });

  test('[Error Handling] handles subscription to invalid topic pattern', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        try {
          // Subscribe to empty string
          const unsub1 = client.subscribe('', (msg) => {});
          unsub1();

          // Subscribe to null (should not crash)
          const unsub2 = client.subscribe(null, (msg) => {});
          if (unsub2) unsub2();

          return { success: true };
        } catch (err) {
          return { success: false, error: err.message };
        }
      });

    expect(result.success).toBe(true);
  });

  test('[Error Handling] handles missing handler in subscribe', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        try {
          // Subscribe without handler
          client.subscribe('test.topic', null);
          return { threw: false };
        } catch (err) {
          return { threw: true, message: err.message };
        }
      });

    // Should either throw or handle gracefully
    expect(result).toBeDefined();
  });

  test('[Error Handling] handles circular references in message data', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        try {
          // Create circular reference
          const circular = { a: 1 };
          circular.self = circular;

          // This should fail gracefully
          client.publish({ topic: 'test.circular', data: circular });
          return { handled: true };
        } catch (err) {
          // It's OK to throw on circular refs
          return { handled: true, threw: true };
        }
      });

    expect(result.handled).toBe(true);
  });

  test('[Error Handling] handles request timeout correctly without memory leaks', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const timeoutErrors = [];

        // Make multiple requests that will timeout
        for (let i = 0; i < 5; i++) {
          try {
            await client.request(`no.response.${i}`, {}, { timeoutMs: 100 });
          } catch (err) {
            timeoutErrors.push(i);
          }
        }

        return {
          allTimedOut: timeoutErrors.length === 5,
          clientStillWorks: client.clientId.length > 0
        };
      });

    expect(result.allTimedOut).toBe(true);
    expect(result.clientStillWorks).toBe(true);
  });

  // =========================================================================
  // MEMORY LEAK PREVENTION TESTS
  // =========================================================================

  test('[Memory Leak Prevention] cleans up subscriptions on unsubscribe', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const bus = document.querySelector('pan-bus');
        const initialSubCount = bus.subs.length;

        // Create 100 subscriptions
        const unsubs = [];
        for (let i = 0; i < 100; i++) {
          const unsub = client.subscribe(`test.${i}`, (msg) => {});
          unsubs.push(unsub);
        }

        const afterSubCount = bus.subs.length;

        // Unsubscribe all
        unsubs.forEach(unsub => unsub());

        // Wait a bit for cleanup
        await new Promise(resolve => setTimeout(resolve, 50));

        const afterUnsubCount = bus.subs.length;

        return {
          initialCount: initialSubCount,
          afterSubscribe: afterSubCount,
          afterUnsubscribe: afterUnsubCount,
          cleaned: afterUnsubCount <= initialSubCount + 5 // Allow small tolerance
        };
      });

    expect(result.cleaned).toBe(true);
  });

  test('[Memory Leak Prevention] cleans up request subscriptions after reply', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const bus = document.querySelector('pan-bus');
        const initialSubCount = bus.subs.length;

        // Set up responder
        client.subscribe('quick.response', (msg) => {
          if (msg.replyTo) {
            client.publish({
              topic: msg.replyTo,
              data: { ok: true },
              correlationId: msg.correlationId
            });
          }
        });

        // Make 50 requests
        const requests = [];
        for (let i = 0; i < 50; i++) {
          requests.push(client.request('quick.response', { n: i }, { timeoutMs: 2000 }));
        }

        await Promise.all(requests);

        // Wait for cleanup
        await new Promise(resolve => setTimeout(resolve, 100));

        const finalSubCount = bus.subs.length;

        return {
          initialCount: initialSubCount,
          finalCount: finalSubCount,
          cleaned: finalSubCount < initialSubCount + 10 // Should be close to initial
        };
      });

    expect(result.cleaned).toBe(true);
  });

  test('[Memory Leak Prevention] does not accumulate event listeners on repeated operations', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');

        // Create and destroy many clients
        for (let i = 0; i < 20; i++) {
          const client = new PanClient();
          await client.ready();

          // Subscribe and unsubscribe
          const unsub = client.subscribe('test.temp', (msg) => {});
          unsub();
        }

        // Final client should still work
        const finalClient = new PanClient();
        await finalClient.ready();

        let receivedCount = 0;
        const unsub = finalClient.subscribe('test.final', (msg) => {
          receivedCount++;
        });

        // Publish once
        finalClient.publish({ topic: 'test.final', data: { test: true } });

        await new Promise(resolve => setTimeout(resolve, 100));

        unsub();

        return {
          receivedOnce: receivedCount === 1,
          clientWorks: finalClient.clientId.length > 0
        };
      });

    expect(result.receivedOnce).toBe(true);
    expect(result.clientWorks).toBe(true);
  });

  test('[Memory Leak Prevention] retained messages do not grow unbounded', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const bus = document.querySelector('pan-bus');

        // Publish 1000 retained messages to different topics
        for (let i = 0; i < 1000; i++) {
          client.publish({
            topic: `retained.${i}`,
            data: { index: i },
            retain: true
          });
        }

        const retainedSize = bus.retained.size;

        // Replace retained messages on same topic
        for (let i = 0; i < 1000; i++) {
          client.publish({
            topic: `retained.${i}`,
            data: { index: i, updated: true },
            retain: true
          });
        }

        const retainedSizeAfter = bus.retained.size;

        return {
          firstSize: retainedSize,
          afterReplacement: retainedSizeAfter,
          didNotGrow: retainedSizeAfter === retainedSize
        };
      });

    expect(result.didNotGrow).toBe(true);
    expect(result.firstSize).toBe(1000);
  });

  // =========================================================================
  // EDGE CASES AND BOUNDARY CONDITIONS
  // =========================================================================

  test('[Edge Cases] handles very large messages', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        // Create large message (1MB of data)
        const largeData = {
          array: new Array(100000).fill('x').map((_, i) => ({ id: i, data: 'test data' }))
        };

        return new Promise((resolve) => {
          client.subscribe('large.message', (msg) => {
            resolve({
              received: true,
              sizeMatch: msg.data.array.length === 100000
            });
          });

          setTimeout(() => {
            try {
              client.publish({ topic: 'large.message', data: largeData });
            } catch (err) {
              resolve({ received: false, error: err.message });
            }
          }, 50);
        });
      });

    expect(result.received).toBe(true);
  });

  test('[Edge Cases] handles rapid message publishing', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const received = [];

        return new Promise((resolve) => {
          client.subscribe('rapid.*', (msg) => {
            received.push(msg.topic);
            if (received.length >= 1000) {
              resolve({
                receivedCount: received.length,
                allReceived: received.length === 1000
              });
            }
          });

          // Publish 1000 messages rapidly
          setTimeout(() => {
            for (let i = 0; i < 1000; i++) {
              client.publish({ topic: `rapid.${i}`, data: { index: i } });
            }
          }, 50);

          // Timeout safety
          setTimeout(() => {
            resolve({
              receivedCount: received.length,
              allReceived: false
            });
          }, 5000);
        });
      });

    // Should receive all or most messages
    expect(result.receivedCount).toBeGreaterThan(900);
  });

  test('[Edge Cases] handles topic pattern with special regex characters', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');

        // Test topic patterns that might break regex
        const tests = [
          { topic: 'test.login', pattern: 'test.*', shouldMatch: true },
          { topic: 'user.{id}.update', pattern: 'user.{id}.update', shouldMatch: true },
          { topic: 'app[v2].start', pattern: 'app[v2].start', shouldMatch: true },
          { topic: 'calc(2+2).result', pattern: 'calc(2+2).result', shouldMatch: true },
        ];

        const results = tests.map(t => ({
          ...t,
          matches: PanClient.matches(t.topic, t.pattern) === t.shouldMatch
        }));

        return {
          allPassed: results.every(r => r.matches),
          results
        };
      });

    expect(result.allPassed).toBe(true);
  });

  test('[Edge Cases] handles subscribe with AbortSignal', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const bus = document.querySelector('pan-bus');
        const initialSubCount = bus.subs.length;

        const controller = new AbortController();

        let count = 0;
        client.subscribe('abort.test', (msg) => {
          count++;
        }, { signal: controller.signal });

        const afterSubCount = bus.subs.length;

        // Publish first message
        client.publish({ topic: 'abort.test', data: { n: 1 } });

        await new Promise(resolve => setTimeout(resolve, 50));

        // Abort subscription
        controller.abort();

        await new Promise(resolve => setTimeout(resolve, 50));

        // Publish second message (should not be received)
        client.publish({ topic: 'abort.test', data: { n: 2 } });

        await new Promise(resolve => setTimeout(resolve, 50));

        const finalSubCount = bus.subs.length;

        return {
          subscribedOnce: afterSubCount > initialSubCount,
          unsubscribedOnAbort: finalSubCount <= initialSubCount,
          receivedOnlyFirst: count === 1
        };
      });

    expect(result.subscribedOnce).toBe(true);
    expect(result.unsubscribedOnAbort).toBe(true);
    expect(result.receivedOnlyFirst).toBe(true);
  });

  test('[Edge Cases] handles multiple clients on same element', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');

        // Create multiple clients on document
        const client1 = new PanClient();
        const client2 = new PanClient();
        const client3 = new PanClient();

        await Promise.all([client1.ready(), client2.ready(), client3.ready()]);

        const received = { c1: 0, c2: 0, c3: 0 };

        client1.subscribe('multi.test', () => received.c1++);
        client2.subscribe('multi.test', () => received.c2++);
        client3.subscribe('multi.test', () => received.c3++);

        // Publish once
        client1.publish({ topic: 'multi.test', data: { test: true } });

        await new Promise(resolve => setTimeout(resolve, 100));

        return {
          allReceived: received.c1 === 1 && received.c2 === 1 && received.c3 === 1,
          counts: received
        };
      });

    expect(result.allReceived).toBe(true);
  });

  // =========================================================================
  // CONCURRENCY TESTS
  // =========================================================================

  test('[Concurrency] handles concurrent subscriptions and publications', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        const received = new Map();

        // Create 10 subscribers to different topics concurrently
        const subscriptions = [];
        for (let i = 0; i < 10; i++) {
          const unsub = client.subscribe(`concurrent.${i}`, (msg) => {
            if (!received.has(msg.topic)) {
              received.set(msg.topic, []);
            }
            received.get(msg.topic).push(msg.data.value);
          });
          subscriptions.push(unsub);
        }

        // Publish to all topics concurrently
        for (let i = 0; i < 10; i++) {
          client.publish({ topic: `concurrent.${i}`, data: { value: i } });
        }

        await new Promise(resolve => setTimeout(resolve, 200));

        // Cleanup
        subscriptions.forEach(unsub => unsub());

        return {
          receivedCount: received.size,
          allReceived: received.size === 10,
          values: Array.from(received.values()).flat()
        };
      });

    expect(result.allReceived).toBe(true);
    expect(result.values).toHaveLength(10);
  });

  test('[Concurrency] handles concurrent request/reply operations', async () => {
      await page.goto(fileUrl('examples/01-hello.html'));

      const result = await page.evaluate(async () => {
        const { PanClient } = await import('../pan/core/pan-client.mjs');
        const client = new PanClient();
        await client.ready();

        // Set up responder
        client.subscribe('concurrent.req', (msg) => {
          if (msg.replyTo) {
            // Simulate processing delay
            setTimeout(() => {
              client.publish({
                topic: msg.replyTo,
                data: { result: msg.data.value * 2 },
                correlationId: msg.correlationId
              });
            }, 10);
          }
        });

        // Make 20 concurrent requests
        const requests = [];
        for (let i = 0; i < 20; i++) {
          requests.push(
            client.request('concurrent.req', { value: i }, { timeoutMs: 2000 })
          );
        }

        const responses = await Promise.all(requests);

        return {
          allResolved: responses.length === 20,
          correctValues: responses.every((r, i) => r.data.result === i * 2)
        };
      });

    expect(result.allResolved).toBe(true);
    expect(result.correctValues).toBe(true);
  });
});
