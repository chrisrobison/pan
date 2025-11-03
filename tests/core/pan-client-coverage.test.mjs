/**
 * Comprehensive pan-client coverage tests
 * Fills gaps in existing pan-client.test.mjs to reach 80%+ coverage
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('PanClient Coverage Tests', () => {
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

  test('[Coverage] creates client with custom host element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      // Create custom element as host
      const myDiv = document.createElement('div');
      myDiv.id = 'custom-host';
      document.body.appendChild(myDiv);

      const client = new PanClient(myDiv);
      await client.ready();

      return {
        hasHost: client.host === myDiv,
        hostIsDiv: client.host.tagName === 'DIV',
        clientIdIncludesTag: client.clientId.startsWith('div#custom-host')
      };
    });

    expect(result.hasHost).toBe(true);
    expect(result.hostIsDiv).toBe(true);
    expect(result.clientIdIncludesTag).toBe(true);
  });

  test('[Coverage] creates client with custom bus selector', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <custom-bus></custom-bus>
  <script type="module">
    class CustomBus extends HTMLElement {
      constructor() {
        super();
        this.subs = [];
        this.retained = new Map();
        this.clients = new Map();
      }

      connectedCallback() {
        document.addEventListener('pan:publish', this.onPublish, true);
        document.addEventListener('pan:subscribe', this.onSubscribe, true);
        document.addEventListener('pan:unsubscribe', this.onUnsubscribe, true);
        document.addEventListener('pan:hello', this.onHello, true);

        window.__panReady = true;
        document.dispatchEvent(new CustomEvent('pan:sys.ready', { bubbles: true, composed: true }));
      }

      onPublish = (e) => {
        const msg = Object.assign({ ts: Date.now(), id: crypto.randomUUID() }, e.detail || {});
        if (msg.retain) this.retained.set(msg.topic, msg);
        for (const s of this.subs) {
          if (this.matches(msg.topic, s.pattern)) {
            try {
              s.el.dispatchEvent(new CustomEvent('pan:deliver', { detail: msg }));
            } catch (_) {}
          }
        }
      };

      onSubscribe = (e) => {
        const { topics = [], options = {}, clientId } = e.detail || {};
        const el = e.composedPath ? e.composedPath()[0] : e.target;
        for (const pattern of topics) {
          this.subs.push({ pattern, el, clientId, retained: !!options.retained });
        }
        if (options.retained) {
          for (const [topic, msg] of this.retained) {
            if (topics.some((p) => this.matches(topic, p))) {
              try {
                el.dispatchEvent(new CustomEvent('pan:deliver', { detail: msg }));
              } catch (_) {}
            }
          }
        }
      };

      onUnsubscribe = (e) => {
        const { topics = [], clientId } = e.detail || {};
        const el = e.composedPath ? e.composedPath()[0] : e.target;
        this.subs = this.subs.filter((s) => {
          const sameClient = clientId ? s.clientId === clientId : s.el === el;
          return !(sameClient && topics.includes(s.pattern));
        });
      };

      onHello = (e) => {
        const d = e.detail || {};
        if (d.id) this.clients.set(d.id, { el: e.composedPath ? e.composedPath()[0] : e.target, caps: d.caps || [] });
      };

      matches(topic, pattern) {
        if (pattern === '*' || topic === pattern) return true;
        if (pattern && pattern.includes('*')) {
          const esc = (s) => s.replace(/[|\\\\{}()\\[\\]^$+?.]/g, '\\\\$&').replace(/\\*/g, '[^.]+');
          const rx = new RegExp(\`^\${esc(pattern)}$\`);
          return rx.test(topic);
        }
        return false;
      }
    }

    customElements.define('custom-bus', CustomBus);
  </script>
</body>
</html>`;

    await page.setContent(html);

    // Wait for custom bus to be ready
    await page.waitForFunction(() => window.__panReady === true, { timeout: 5000 });

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      // Create client with custom bus selector
      const client = new PanClient(document, 'custom-bus');
      await client.ready();

      return {
        busTagName: client.bus ? client.bus.tagName.toLowerCase() : null
      };
    });

    expect(result.busTagName).toBe('custom-bus');
  });

  test('[Coverage] client ID generation without element ID', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      // Create element without ID
      const myDiv = document.createElement('div');
      document.body.appendChild(myDiv);

      const client = new PanClient(myDiv);

      return {
        clientId: client.clientId,
        startsWithDiv: client.clientId.startsWith('div#')
      };
    });

    expect(result.startsWithDiv).toBe(true);
    expect(result.clientId.length).toBeGreaterThan(5);
  });

  test('[Coverage] handles AbortSignal for automatic unsubscribe', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      let count = 0;
      const controller = new AbortController();

      // Subscribe with AbortSignal
      client.subscribe('test.abort', (msg) => {
        count++;
      }, { signal: controller.signal });

      // Publish first message
      client.publish({ topic: 'test.abort', data: { n: 1 } });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Abort the subscription
      controller.abort();

      await new Promise(resolve => setTimeout(resolve, 50));

      // Publish second message (should not be received)
      client.publish({ topic: 'test.abort', data: { n: 2 } });

      await new Promise(resolve => setTimeout(resolve, 50));

      return count;
    });

    expect(result).toBe(1); // Only first message received
  });

  test('[Coverage] publishes messages with headers', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      return new Promise((resolve) => {
        client.subscribe('test.headers', (msg) => {
          resolve({
            topic: msg.topic,
            data: msg.data,
            headers: msg.headers
          });
        });

        setTimeout(() => {
          client.publish({
            topic: 'test.headers',
            data: { value: 42 },
            headers: {
              'X-Request-ID': 'req-123',
              'X-Version': '1.0.0'
            }
          });
        }, 50);
      });
    });

    expect(result.topic).toBe('test.headers');
    expect(result.data.value).toBe(42);
    expect(result.headers['X-Request-ID']).toBe('req-123');
    expect(result.headers['X-Version']).toBe('1.0.0');
  });

  test('[Coverage] subscribes to multiple patterns as array', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const received = [];

      return new Promise((resolve) => {
        // Subscribe to multiple patterns
        client.subscribe(['users.*', 'posts.*', 'comments.*'], (msg) => {
          received.push(msg.topic);
          if (received.length === 4) resolve(received);
        });

        setTimeout(() => {
          client.publish({ topic: 'users.created', data: {} });
          client.publish({ topic: 'posts.updated', data: {} });
          client.publish({ topic: 'comments.deleted', data: {} });
          client.publish({ topic: 'users.login', data: {} });
        }, 50);
      });
    });

    expect(result).toHaveLength(4);
    expect(result).toContain('users.created');
    expect(result).toContain('posts.updated');
    expect(result).toContain('comments.deleted');
    expect(result).toContain('users.login');
  });

  test('[Coverage] ready() resolves immediately when already ready', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();

      // Wait for ready
      await client.ready();

      // Call ready() again - should resolve immediately
      const start = Date.now();
      await client.ready();
      await client.ready();
      await client.ready();
      const elapsed = Date.now() - start;

      return { elapsed };
    });

    // Should be very fast (< 100ms) since already ready
    expect(result.elapsed).toBeLessThan(100);
  });

  test('[Coverage] request cleans up on success', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      // Set up responder
      client.subscribe('echo.request', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { echo: msg.data },
            correlationId: msg.correlationId
          });
        }
      });

      // Make request
      const response = await client.request('echo.request', { test: 'value' });

      // Check bus subscriptions - reply subscription should be cleaned up
      const bus = document.querySelector('pan-bus');
      const replySubsCount = bus.subs.filter(s => s.pattern.includes('pan:$reply:')).length;

      return {
        responseData: response.data,
        replySubsCleanedUp: replySubsCount === 0
      };
    });

    expect(result.responseData.echo.test).toBe('value');
    expect(result.replySubsCleanedUp).toBe(true);
  });

  test('[Coverage] request cleans up on timeout', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      // No responder - will timeout

      try {
        await client.request('no.responder', { test: true }, { timeoutMs: 500 });
      } catch (err) {
        // Expected timeout
      }

      // Check bus subscriptions - reply subscription should be cleaned up
      const bus = document.querySelector('pan-bus');
      const replySubsCount = bus.subs.filter(s => s.pattern.includes('pan:$reply:')).length;

      return {
        replySubsCleanedUp: replySubsCount === 0
      };
    });

    expect(result.replySubsCleanedUp).toBe(true);
  });

  test('[Coverage] handles errors in subscribe handler gracefully', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      let errorThrown = false;
      let secondHandlerCalled = false;

      // Subscribe with handler that throws
      client.subscribe('test.error', (msg) => {
        errorThrown = true;
        throw new Error('Handler error');
      });

      // Subscribe with normal handler
      client.subscribe('test.error', (msg) => {
        secondHandlerCalled = true;
      });

      // Publish message
      client.publish({ topic: 'test.error', data: {} });

      await new Promise(resolve => setTimeout(resolve, 50));

      return { errorThrown, secondHandlerCalled };
    });

    expect(result.errorThrown).toBe(true);
    expect(result.secondHandlerCalled).toBe(true);
  });

  test('[Coverage] matches() handles edge cases', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      return {
        // Empty strings
        emptyTopic: PanClient.matches('', ''),
        emptyPattern: PanClient.matches('foo', ''),

        // Multiple segments
        threeSegments: PanClient.matches('a.b.c', 'a.b.c'),
        wildcardMiddle: PanClient.matches('a.b.c', 'a.*.c'),

        // Special characters
        dash: PanClient.matches('user-profile', 'user-profile'),
        underscore: PanClient.matches('user_profile', 'user_profile'),
        number: PanClient.matches('version.1.2.3', 'version.*.*.*'),

        // Case sensitive
        caseSensitive: PanClient.matches('Users', 'users'),

        // Wildcard at start
        wildcardStart: PanClient.matches('users.login', '*.login'),

        // Multiple wildcards
        multiWild: PanClient.matches('a.b.c.d', '*.*.c.*')
      };
    });

    expect(result.emptyTopic).toBe(true);
    expect(result.emptyPattern).toBe(false);
    expect(result.threeSegments).toBe(true);
    expect(result.wildcardMiddle).toBe(true);
    expect(result.dash).toBe(true);
    expect(result.underscore).toBe(true);
    expect(result.number).toBe(true);
    expect(result.caseSensitive).toBe(false);
    expect(result.wildcardStart).toBe(true);
    expect(result.multiWild).toBe(true);
  });

  test('[Coverage] subscribe filters messages by pattern', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const received = [];

      return new Promise((resolve) => {
        // Subscribe to users.* only
        client.subscribe('users.*', (msg) => {
          received.push(msg.topic);
        });

        setTimeout(() => {
          // These should match
          client.publish({ topic: 'users.login', data: {} });
          client.publish({ topic: 'users.logout', data: {} });

          // These should NOT match
          client.publish({ topic: 'posts.created', data: {} });
          client.publish({ topic: 'admin.action', data: {} });
          client.publish({ topic: 'users', data: {} }); // No dot

          setTimeout(() => resolve(received), 100);
        }, 50);
      });
    });

    expect(result).toHaveLength(2);
    expect(result).toContain('users.login');
    expect(result).toContain('users.logout');
  });

  test('[Coverage] handles delivery to removed element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      // Create temporary element
      const tempDiv = document.createElement('div');
      document.body.appendChild(tempDiv);

      const client = new PanClient(tempDiv);
      await client.ready();

      let messageReceived = false;

      client.subscribe('test.removed', (msg) => {
        messageReceived = true;
      });

      // Remove element from DOM
      tempDiv.remove();

      // Try to publish (should not crash)
      try {
        client.publish({ topic: 'test.removed', data: {} });
        await new Promise(resolve => setTimeout(resolve, 50));
        return { success: true, messageReceived };
      } catch (err) {
        return { success: false, error: err.message };
      }
    });

    expect(result.success).toBe(true);
    // Message may or may not be received depending on timing
  });

  test('[Coverage] request generates unique correlation IDs', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const correlationIds = [];

      // Set up responder that captures correlation IDs
      client.subscribe('capture.request', (msg) => {
        if (msg.correlationId) {
          correlationIds.push(msg.correlationId);
        }

        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { ok: true },
            correlationId: msg.correlationId
          });
        }
      });

      // Make multiple requests
      await Promise.all([
        client.request('capture.request', { n: 1 }),
        client.request('capture.request', { n: 2 }),
        client.request('capture.request', { n: 3 })
      ]);

      // Check all correlation IDs are unique
      const uniqueIds = new Set(correlationIds);

      return {
        totalIds: correlationIds.length,
        uniqueIds: uniqueIds.size,
        allUnique: correlationIds.length === uniqueIds.size
      };
    });

    expect(result.totalIds).toBe(3);
    expect(result.uniqueIds).toBe(3);
    expect(result.allUnique).toBe(true);
  });

  test('[Coverage] request reply topics are unique per client', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../pan/core/pan-client.mjs');

      const client1 = new PanClient();
      const client2 = new PanClient();

      await client1.ready();
      await client2.ready();

      const replyTopics = [];

      // Set up responder that captures reply topics
      client1.subscribe('capture.*', (msg) => {
        if (msg.replyTo) {
          replyTopics.push(msg.replyTo);

          client1.publish({
            topic: msg.replyTo,
            data: { ok: true },
            correlationId: msg.correlationId
          });
        }
      });

      // Make requests from both clients
      await Promise.all([
        client1.request('capture.test', { from: 'client1' }),
        client2.request('capture.test', { from: 'client2' })
      ]);

      return {
        replyTopicsCount: replyTopics.length,
        uniqueTopics: new Set(replyTopics).size,
        allContainReplyPrefix: replyTopics.every(t => t.startsWith('pan:$reply:'))
      };
    });

    expect(result.replyTopicsCount).toBe(2);
    expect(result.uniqueTopics).toBe(2);
    expect(result.allContainReplyPrefix).toBe(true);
  });
});
