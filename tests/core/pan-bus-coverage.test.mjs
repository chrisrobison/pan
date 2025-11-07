/**
 * Comprehensive pan-bus coverage tests
 * Fills gaps in existing pan-bus.test.mjs to reach 80%+ coverage
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('pan-bus Coverage Tests', () => {
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

  test('[Coverage] auto-generates message ID and timestamp', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          const msg = e.detail;
          resolve({
            hasId: typeof msg.id === 'string' && msg.id.length > 0,
            hasTimestamp: typeof msg.ts === 'number' && msg.ts > 0,
            idIsUUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(msg.id)
          });
        }, { once: true });

        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.msg'], clientId: 'tester' },
          bubbles: true,
          composed: true
        }));

        document.dispatchEvent(new CustomEvent('pan:publish', {
          detail: { topic: 'test.msg', data: { test: true } },
          bubbles: true,
          composed: true
        }));
      });
    });

    expect(result.hasId).toBe(true);
    expect(result.hasTimestamp).toBe(true);
    expect(result.idIsUUID).toBe(true);
  });

  test('[Coverage] handles messages with headers', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          resolve(e.detail.headers);
        }, { once: true });

        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.headers'], clientId: 'tester' },
          bubbles: true,
          composed: true
        }));

        document.dispatchEvent(new CustomEvent('pan:publish', {
          detail: {
            topic: 'test.headers',
            data: { value: 42 },
            headers: { 'X-Custom': 'test', 'X-Version': '1.0' }
          },
          bubbles: true,
          composed: true
        }));
      });
    });

    expect(result['X-Custom']).toBe('test');
    expect(result['X-Version']).toBe('1.0');
  });

  test('[Coverage] handles complex wildcard patterns', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      const received = [];

      return new Promise((resolve) => {
        let count = 0;
        document.addEventListener('pan:deliver', (e) => {
          received.push(e.detail.topic);
          count++;
          if (count === 3) resolve(received);
        });

        // Subscribe to *.item.* pattern
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['*.item.*'], clientId: 'tester' },
          bubbles: true,
          composed: true
        }));

        // Publish matching messages
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'users.item.created', data: {} },
            bubbles: true,
            composed: true
          }));

          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'posts.item.updated', data: {} },
            bubbles: true,
            composed: true
          }));

          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'comments.item.deleted', data: {} },
            bubbles: true,
            composed: true
          }));

          // Should NOT match
          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'users.list.state', data: {} },
            bubbles: true,
            composed: true
          }));
        }, 50);
      });
    });

    expect(result).toHaveLength(3);
    expect(result).toContain('users.item.created');
    expect(result).toContain('posts.item.updated');
    expect(result).toContain('comments.item.deleted');
  });

  test('[Coverage] handles client registration with pan:hello', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      // Register client
      document.dispatchEvent(new CustomEvent('pan:hello', {
        detail: {
          id: 'client-123',
          caps: ['publish', 'subscribe', 'request']
        },
        bubbles: true,
        composed: true
      }));

      // Check if client was registered
      const bus = document.querySelector('pan-bus');
      const client = bus.clients.get('client-123');

      return {
        isRegistered: client !== undefined,
        hasCorrectCaps: client && client.caps.length === 3
      };
    });

    expect(result.isRegistered).toBe(true);
    expect(result.hasCorrectCaps).toBe(true);
  });

  test('[Coverage] dispatches pan:sys.ready on connection', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script>
    window.readyFired = false;
    document.addEventListener('pan:sys.ready', () => {
      window.readyFired = true;
    });
  </script>
  <script type="module" src="${fileUrl('src/pan.mjs')}"></script>
</body>
</html>`;

    await page.setContent(html);
    await page.addScriptTag({ path: './src/pan.mjs', type: 'module' });

    // Wait for bus to be ready
    await page.waitForFunction(() => window.__panReady === true, { timeout: 5000 });

    const readyFired = await page.evaluate(() => window.readyFired);
    expect(readyFired).toBe(true);
  });

  test('[Coverage] replaces retained messages on same topic', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      // Publish first retained message
      document.dispatchEvent(new CustomEvent('pan:publish', {
        detail: { topic: 'counter', data: { count: 1 }, retain: true },
        bubbles: true,
        composed: true
      }));

      // Publish second retained message (should replace first)
      document.dispatchEvent(new CustomEvent('pan:publish', {
        detail: { topic: 'counter', data: { count: 2 }, retain: true },
        bubbles: true,
        composed: true
      }));

      // Publish third retained message (should replace second)
      document.dispatchEvent(new CustomEvent('pan:publish', {
        detail: { topic: 'counter', data: { count: 3 }, retain: true },
        bubbles: true,
        composed: true
      }));

      // Check retained message
      const bus = document.querySelector('pan-bus');
      const retained = bus.retained.get('counter');

      return {
        count: retained.data.count,
        retainedSize: bus.retained.size
      };
    });

    expect(result.count).toBe(3); // Should be latest value
    expect(result.retainedSize).toBe(1); // Should only have one entry
  });

  test('[Coverage] handles pan:reply events', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      const replyTopic = 'pan:$reply:test-123';

      return new Promise((resolve) => {
        // Subscribe to reply topic
        document.addEventListener('pan:deliver', (e) => {
          if (e.detail.topic === replyTopic) {
            resolve(e.detail);
          }
        });

        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: [replyTopic], clientId: 'requester' },
          bubbles: true,
          composed: true
        }));

        // Send reply
        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('pan:reply', {
            detail: {
              topic: replyTopic,
              data: { result: 'success' },
              correlationId: 'test-123'
            },
            bubbles: true,
            composed: true
          }));
        }, 50);
      });
    });

    expect(result.topic).toBe('pan:$reply:test-123');
    expect(result.data.result).toBe('success');
    expect(result.correlationId).toBe('test-123');
  });

  test('[Coverage] matches() handles special regex characters in topics', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanBus } = await import('../src/components/pan-bus.mjs');

      return {
        // Should match literal characters, not regex
        dollarSign: PanBus.matches('price.$100', 'price.$100'),
        parentheses: PanBus.matches('calc(2+2)', 'calc(2+2)'),
        brackets: PanBus.matches('array[0]', 'array[0]'),
        // Wildcard should still work
        wildcardWithSpecial: PanBus.matches('price.$100', 'price.*'),
      };
    });

    expect(result.dollarSign).toBe(true);
    expect(result.parentheses).toBe(true);
    expect(result.brackets).toBe(true);
    expect(result.wildcardWithSpecial).toBe(true);
  });

  test('[Coverage] handles delivery errors gracefully', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      // Create an element that throws on dispatchEvent
      const badElement = document.createElement('div');
      Object.defineProperty(badElement, 'dispatchEvent', {
        value: () => {
          throw new Error('Cannot dispatch event');
        }
      });

      // Add subscription with bad element
      const bus = document.querySelector('pan-bus');
      bus.subs.push({ pattern: 'test.error', el: badElement, clientId: 'bad-client' });

      // Try to publish (should not throw)
      try {
        document.dispatchEvent(new CustomEvent('pan:publish', {
          detail: { topic: 'test.error', data: {} },
          bubbles: true,
          composed: true
        }));
        return { errorHandled: true };
      } catch (err) {
        return { errorHandled: false, error: err.message };
      }
    });

    expect(result.errorHandled).toBe(true);
  });

  test('[Coverage] handles composed path traversal', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="shadow-host"></div>
  <script type="module">
    import { PanClient } from '${fileUrl('src/components/pan-client.mjs')}';

    // Create shadow DOM
    const host = document.getElementById('shadow-host');
    const shadow = host.attachShadow({ mode: 'open' });

    const button = document.createElement('button');
    button.textContent = 'Click me';
    shadow.appendChild(button);

    // Wait for bus
    await new Promise(resolve => {
      if (customElements.get('pan-bus')) resolve();
      else document.addEventListener('pan:sys.ready', resolve, { once: true });
    });

    // Create client in shadow DOM
    const client = new PanClient(shadow);
    await client.ready();

    window.shadowClient = client;
    window.shadowElement = button;
  </script>
  <script type="module" src="${fileUrl('src/pan.mjs')}"></script>
</body>
</html>`;

    await page.setContent(html);
    await page.addScriptTag({ path: './src/components/pan-client.mjs', type: 'module' });
    await page.addScriptTag({ path: './src/pan.mjs', type: 'module' });

    // Wait for setup
    await page.waitForFunction(() => window.shadowClient !== undefined, { timeout: 5000 });

    const result = await page.evaluate(() => {
      return new Promise((resolve) => {
        window.shadowClient.subscribe('shadow.test', (msg) => {
          resolve({ received: true, data: msg.data });
        });

        setTimeout(() => {
          window.shadowClient.publish({
            topic: 'shadow.test',
            data: { fromShadow: true }
          });
        }, 100);
      });
    });

    expect(result.received).toBe(true);
    expect(result.data.fromShadow).toBe(true);
  });

  test('[Coverage] handles disconnectedCallback cleanup', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus');

      // Remove bus from DOM
      bus.remove();

      // Try to publish (listeners should be removed)
      let eventFired = false;
      document.addEventListener('pan:deliver', () => {
        eventFired = true;
      });

      document.dispatchEvent(new CustomEvent('pan:publish', {
        detail: { topic: 'test.removed', data: {} },
        bubbles: true,
        composed: true
      }));

      return { eventFired };
    });

    // Event should not be delivered since bus is disconnected
    expect(result.eventFired).toBe(false);
  });

  test('[Coverage] unsubscribes by clientId', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      let count = 0;

      return new Promise((resolve) => {
        const handler = (e) => {
          if (e.detail.topic === 'test.clientid') {
            count++;
          }
        };

        document.addEventListener('pan:deliver', handler);

        // Subscribe with clientId
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.clientid'], clientId: 'test-client-123' },
          bubbles: true,
          composed: true
        }));

        // Publish first message
        document.dispatchEvent(new CustomEvent('pan:publish', {
          detail: { topic: 'test.clientid', data: { n: 1 } },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          // Unsubscribe by clientId
          document.dispatchEvent(new CustomEvent('pan:unsubscribe', {
            detail: { topics: ['test.clientid'], clientId: 'test-client-123' },
            bubbles: true,
            composed: true
          }));

          // Publish second message (should not be received)
          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'test.clientid', data: { n: 2 } },
            bubbles: true,
            composed: true
          }));

          setTimeout(() => {
            document.removeEventListener('pan:deliver', handler);
            resolve(count);
          }, 100);
        }, 100);
      });
    });

    expect(result).toBe(1); // Only first message should be received
  });

  test('[Coverage] handles multiple topics in single subscription', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      const received = [];

      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          received.push(e.detail.topic);
          if (received.length === 3) resolve(received);
        });

        // Subscribe to multiple topics at once
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: {
            topics: ['events.a', 'events.b', 'events.c'],
            clientId: 'multi-subscriber'
          },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'events.a', data: {} },
            bubbles: true,
            composed: true
          }));

          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'events.b', data: {} },
            bubbles: true,
            composed: true
          }));

          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'events.c', data: {} },
            bubbles: true,
            composed: true
          }));
        }, 50);
      });
    });

    expect(result).toHaveLength(3);
    expect(result).toContain('events.a');
    expect(result).toContain('events.b');
    expect(result).toContain('events.c');
  });

  test('[Coverage] handles empty or invalid subscription details', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const result = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus');
      const initialSubsCount = bus.subs.length;

      // Try to subscribe with empty topics
      document.dispatchEvent(new CustomEvent('pan:subscribe', {
        detail: { topics: [], clientId: 'empty' },
        bubbles: true,
        composed: true
      }));

      const afterEmptySubsCount = bus.subs.length;

      // Try to subscribe with no detail
      document.dispatchEvent(new CustomEvent('pan:subscribe', {
        bubbles: true,
        composed: true
      }));

      const afterNullSubsCount = bus.subs.length;

      return {
        initialCount: initialSubsCount,
        afterEmptyCount: afterEmptySubsCount,
        afterNullCount: afterNullSubsCount
      };
    });

    // Should handle gracefully without adding subscriptions
    expect(result.afterEmptyCount).toBe(result.initialCount);
    expect(result.afterNullCount).toBe(result.initialCount);
  });
});
