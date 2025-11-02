/**
 * index.js core tests
 * Tests the main PAN library exports (PanBus and PanClient)
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from './lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from './lib/test-utils.mjs';

describe('index.js exports', () => {
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

  test('exports PanBus class', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasPanBus = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return typeof mod.PanBus === 'function';
    });

    expect(hasPanBus).toBeTruthy();
  });

  test('exports PanClient class', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasPanClient = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return typeof mod.PanClient === 'function';
    });

    expect(hasPanClient).toBeTruthy();
  });

  test('exports ensureBus helper', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasEnsureBus = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return typeof mod.ensureBus === 'function';
    });

    expect(hasEnsureBus).toBeTruthy();
  });

  test('exports createClient helper', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasCreateClient = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return typeof mod.createClient === 'function';
    });

    expect(hasCreateClient).toBeTruthy();
  });

  test('default export is PanClient', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const isDefaultPanClient = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return mod.default === mod.PanClient;
    });

    expect(isDefaultPanClient).toBeTruthy();
  });

  test('ensureBus creates pan-bus element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const busCreated = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      // Remove existing bus if any
      const existing = document.querySelector('pan-bus');
      if (existing) existing.remove();

      mod.ensureBus();

      return document.querySelector('pan-bus') !== null;
    });

    expect(busCreated).toBeTruthy();
  });

  test('ensureBus does not create duplicate bus', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const busCount = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      mod.ensureBus();
      mod.ensureBus();

      return document.querySelectorAll('pan-bus').length;
    });

    expect(busCount).toBe(1);
  });

  test('createClient returns PanClient instance', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      const client = mod.createClient();
      return {
        hasClient: client !== null,
        hasClientId: client.clientId !== null && client.clientId.length > 0,
        hasPub: typeof client.pub === 'function',
        hasSub: typeof client.sub === 'function'
      };
    });

    expect(result.hasClient).toBeTruthy();
    expect(result.hasClientId).toBeTruthy();
    expect(result.hasPub).toBeTruthy();
    expect(result.hasSub).toBeTruthy();
  });

  test('createClient ensures bus exists', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const busExists = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      // Remove existing bus
      const existing = document.querySelector('pan-bus');
      if (existing) existing.remove();

      mod.createClient();

      return document.querySelector('pan-bus') !== null;
    });

    expect(busExists).toBeTruthy();
  });

  test('PanBus registers as custom element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const isDefined = await page.evaluate(async () => {
      await import('./dist/index.js');
      return customElements.get('pan-bus') !== undefined;
    });

    expect(isDefined).toBeTruthy();
  });

  test('PanBus element connects and dispatches ready event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const readyReceived = await page.evaluate(async () => {
      await import('./dist/index.js');

      return new Promise((resolve) => {
        document.addEventListener('pan:sys.ready', () => {
          resolve(true);
        }, { once: true });

        const bus = document.createElement('pan-bus');
        document.body.appendChild(bus);

        setTimeout(() => resolve(false), 1000);
      });
    });

    expect(readyReceived).toBeTruthy();
  });

  test('PanBus sets window.__panReady flag', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const isReady = await page.evaluate(async () => {
      await import('./dist/index.js');

      const bus = document.createElement('pan-bus');
      document.body.appendChild(bus);

      await new Promise(resolve => setTimeout(resolve, 100));

      return window.__panReady === true;
    });

    expect(isReady).toBeTruthy();
  });

  test('PanBus stores subscriptions', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasSubscriptions = await page.evaluate(async () => {
      await import('./dist/index.js');

      const bus = document.createElement('pan-bus');
      document.body.appendChild(bus);

      return Array.isArray(bus.subs);
    });

    expect(hasSubscriptions).toBeTruthy();
  });

  test('PanBus stores retained messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasRetained = await page.evaluate(async () => {
      await import('./dist/index.js');

      const bus = document.createElement('pan-bus');
      document.body.appendChild(bus);

      return bus.retained instanceof Map;
    });

    expect(hasRetained).toBeTruthy();
  });

  test('PanBus tracks clients', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasClients = await page.evaluate(async () => {
      await import('./dist/index.js');

      const bus = document.createElement('pan-bus');
      document.body.appendChild(bus);

      return bus.clients instanceof Map;
    });

    expect(hasClients).toBeTruthy();
  });

  test('PanBus.matches supports exact matching', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return mod.PanBus.matches('user.login', 'user.login');
    });

    expect(result).toBeTruthy();
  });

  test('PanBus.matches supports wildcard matching', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return {
        all: mod.PanBus.matches('user.login', '*'),
        suffix: mod.PanBus.matches('user.login', 'user.*'),
        prefix: mod.PanBus.matches('user.login', '*.login'),
        middle: mod.PanBus.matches('user.admin.login', 'user.*.login'),
        noMatch: mod.PanBus.matches('user.login', 'admin.*')
      };
    });

    expect(result.all).toBeTruthy();
    expect(result.suffix).toBeTruthy();
    expect(result.prefix).toBeTruthy();
    expect(result.middle).toBeTruthy();
    expect(result.noMatch).toBe(false);
  });

  test('PanClient can be instantiated with host element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();

      const div = document.createElement('div');
      div.id = 'test-host';
      document.body.appendChild(div);

      const client = new mod.PanClient(div);

      return {
        hasClient: client !== null,
        hasClientId: client.clientId.length > 0,
        clientIdContainsTag: client.clientId.includes('div')
      };
    });

    expect(result.hasClient).toBeTruthy();
    expect(result.hasClientId).toBeTruthy();
    expect(result.clientIdContainsTag).toBeTruthy();
  });

  test('PanClient generates unique client IDs', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();

      const client1 = new mod.PanClient();
      const client2 = new mod.PanClient();

      return {
        id1: client1.clientId,
        id2: client2.clientId,
        different: client1.clientId !== client2.clientId
      };
    });

    expect(result.different).toBeTruthy();
  });

  test('PanClient.ready() resolves when bus is ready', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const resolved = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();

      const client = new mod.PanClient();
      await client.ready();
      return true;
    });

    expect(resolved).toBeTruthy();
  });

  test('PanClient.publish sends messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const messageReceived = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          if (e.detail.topic === 'test.publish') {
            resolve(true);
          }
        }, { once: true });

        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.publish'], clientId: 'listener' },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          client.publish({ topic: 'test.publish', data: { test: true } });
        }, 50);

        setTimeout(() => resolve(false), 1000);
      });
    });

    expect(messageReceived).toBeTruthy();
  });

  test('PanClient.pub is alias for publish', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const messageReceived = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          if (e.detail.topic === 'test.pub') {
            resolve(true);
          }
        }, { once: true });

        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.pub'], clientId: 'listener' },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          client.pub('test.pub', { test: true });
        }, 50);

        setTimeout(() => resolve(false), 1000);
      });
    });

    expect(messageReceived).toBeTruthy();
  });

  test('PanClient.subscribe receives messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      return new Promise((resolve) => {
        client.subscribe('test.subscribe', (msg) => {
          resolve(msg);
        });

        setTimeout(() => {
          client.pub('test.subscribe', { value: 123 });
        }, 50);

        setTimeout(() => resolve(null), 1000);
      });
    });

    expect(result).toBeTruthy();
    expect(result.topic).toBe('test.subscribe');
    expect(result.data.value).toBe(123);
  });

  test('PanClient.sub is alias for subscribe', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      return new Promise((resolve) => {
        client.sub('test.sub', (msg) => {
          resolve(msg.data);
        });

        setTimeout(() => {
          client.pub('test.sub', { value: 456 });
        }, 50);

        setTimeout(() => resolve(null), 1000);
      });
    });

    expect(result).toBeTruthy();
    expect(result.value).toBe(456);
  });

  test('PanClient.subscribe returns unsubscribe function', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const count = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      let messageCount = 0;

      const unsub = client.subscribe('test.unsub', () => {
        messageCount++;
      });

      client.pub('test.unsub', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      unsub();

      client.pub('test.unsub', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      return messageCount;
    });

    expect(count).toBe(1);
  });

  test('PanClient.request implements request-reply pattern', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      // Set up responder
      client.subscribe('echo', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { echo: msg.data },
            correlationId: msg.correlationId
          });
        }
      });

      // Make request
      const reply = await client.request('echo', { message: 'hello' });
      return reply.data;
    });

    expect(result.echo.message).toBe('hello');
  });

  test('PanClient.request times out on no reply', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      try {
        await client.request('no.responder', {}, { timeoutMs: 200 });
        return { timedOut: false };
      } catch (err) {
        return { timedOut: true, message: err.message };
      }
    });

    expect(result.timedOut).toBeTruthy();
    expect(result.message).toContain('timeout');
  });

  test('PanClient.matches is static method', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return typeof mod.PanClient.matches === 'function';
    });

    expect(result).toBeTruthy();
  });

  test('PanClient.matches works same as PanBus.matches', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');
      return {
        busResult: mod.PanBus.matches('user.login', 'user.*'),
        clientResult: mod.PanClient.matches('user.login', 'user.*'),
        same: mod.PanBus.matches('user.login', 'user.*') === mod.PanClient.matches('user.login', 'user.*')
      };
    });

    expect(result.busResult).toBeTruthy();
    expect(result.clientResult).toBeTruthy();
    expect(result.same).toBeTruthy();
  });

  test('PanClient supports AbortSignal for subscriptions', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const count = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      let messageCount = 0;
      const controller = new AbortController();

      client.subscribe('test.abort', () => {
        messageCount++;
      }, { signal: controller.signal });

      client.pub('test.abort', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      controller.abort();

      client.pub('test.abort', {});
      await new Promise(resolve => setTimeout(resolve, 50));

      return messageCount;
    });

    expect(count).toBe(1);
  });

  test('PanClient supports retained subscriptions', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      // Publish retained message
      client.pub('retained.topic', { value: 999 }, { retain: true });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Subscribe later with retained option
      return new Promise((resolve) => {
        client.subscribe('retained.topic', (msg) => {
          resolve(msg.data);
        }, { retained: true });

        setTimeout(() => resolve(null), 1000);
      });
    });

    expect(result).toBeTruthy();
    expect(result.value).toBe(999);
  });

  test('PanClient subscribes to multiple topics with array', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const topics = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client = new mod.PanClient();
      await client.ready();

      const received = [];

      return new Promise((resolve) => {
        client.subscribe(['topic.one', 'topic.two'], (msg) => {
          received.push(msg.topic);
          if (received.length === 2) {
            resolve(received);
          }
        });

        setTimeout(() => {
          client.pub('topic.one', {});
          client.pub('topic.two', {});
        }, 50);

        setTimeout(() => resolve(received), 1000);
      });
    });

    expect(topics).toContain('topic.one');
    expect(topics).toContain('topic.two');
  });

  test('integration: multiple clients communicate via bus', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const mod = await import('./dist/index.js');

      mod.ensureBus();
      await new Promise(resolve => setTimeout(resolve, 100));

      const client1 = new mod.PanClient();
      const client2 = new mod.PanClient();

      await client1.ready();
      await client2.ready();

      return new Promise((resolve) => {
        client2.subscribe('client1.message', (msg) => {
          resolve({
            received: true,
            data: msg.data,
            fromDifferentClient: true
          });
        });

        setTimeout(() => {
          client1.pub('client1.message', { text: 'Hello from client1' });
        }, 50);

        setTimeout(() => resolve({ received: false }), 1000);
      });
    });

    expect(result.received).toBeTruthy();
    expect(result.data.text).toBe('Hello from client1');
  });
});
