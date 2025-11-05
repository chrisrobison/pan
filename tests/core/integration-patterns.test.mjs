/**
 * Integration tests for common PAN patterns
 * Tests real-world scenarios and complete workflows
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('Integration: Common Patterns', () => {
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

  test('[Integration] State Management Pattern - retained state with updates', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const stateHistory = [];

      // Subscribe to state with retained option
      client.subscribe('app.state', (msg) => {
        stateHistory.push({ ...msg.data });
      }, { retained: true });

      // Publish initial state
      client.publish({
        topic: 'app.state',
        data: { count: 0, user: null },
        retain: true
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update state
      client.publish({
        topic: 'app.state',
        data: { count: 1, user: 'alice' },
        retain: true
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Update again
      client.publish({
        topic: 'app.state',
        data: { count: 2, user: 'alice' },
        retain: true
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // New subscriber should only get latest state
      const lateSubscriberState = await new Promise((resolve) => {
        client.subscribe('app.state', (msg) => {
          resolve(msg.data);
        }, { retained: true });
      });

      return {
        historyLength: stateHistory.length,
        finalCount: stateHistory[stateHistory.length - 1].count,
        lateSubscriberGotLatest: lateSubscriberState.count === 2
      };
    });

    expect(result.historyLength).toBeGreaterThan(2); // At least 3
    expect(result.finalCount).toBe(2);
    expect(result.lateSubscriberGotLatest).toBe(true);
  });

  test('[Integration] CRUD Pattern - list and item operations', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const items = [];

      // Responder for list.get
      client.subscribe('items.list.get', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { ok: true, items: [...items] },
            correlationId: msg.correlationId
          });
        }
      });

      // Responder for item.save (create/update)
      client.subscribe('items.item.save', (msg) => {
        if (msg.replyTo) {
          const item = msg.data.item;
          if (!item.id) item.id = Date.now();

          const index = items.findIndex(i => i.id === item.id);
          if (index >= 0) {
            items[index] = item;
          } else {
            items.push(item);
          }

          client.publish({
            topic: msg.replyTo,
            data: { ok: true, item },
            correlationId: msg.correlationId
          });

          // Notify about update
          client.publish({
            topic: 'items.item.updated',
            data: { item }
          });

          // Update list state
          client.publish({
            topic: 'items.list.state',
            data: { items: [...items] },
            retain: true
          });
        }
      });

      // Responder for item.delete
      client.subscribe('items.item.delete', (msg) => {
        if (msg.replyTo) {
          const index = items.findIndex(i => i.id === msg.data.id);
          if (index >= 0) {
            items.splice(index, 1);
          }

          client.publish({
            topic: msg.replyTo,
            data: { ok: true, id: msg.data.id },
            correlationId: msg.correlationId
          });

          // Notify about deletion
          client.publish({
            topic: 'items.item.deleted',
            data: { id: msg.data.id }
          });

          // Update list state
          client.publish({
            topic: 'items.list.state',
            data: { items: [...items] },
            retain: true
          });
        }
      });

      // Wait for responders to be registered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Test CRUD operations
      // CREATE
      const created = await client.request('items.item.save', {
        item: { name: 'Item 1', value: 100 }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // READ (list)
      const list1 = await client.request('items.list.get', {});

      // CREATE another
      const created2 = await client.request('items.item.save', {
        item: { name: 'Item 2', value: 200 }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // UPDATE
      const updated = await client.request('items.item.save', {
        item: { id: created.data.item.id, name: 'Item 1 Updated', value: 150 }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // READ (list)
      const list2 = await client.request('items.list.get', {});

      // DELETE
      await client.request('items.item.delete', { id: created.data.item.id });

      // READ (list)
      const list3 = await client.request('items.list.get', {});

      return {
        created: created.data.ok,
        list1Count: list1.data.items.length,
        list2Count: list2.data.items.length,
        list3Count: list3.data.items.length,
        updatedValue: updated.data.item.value,
        finalItemName: list3.data.items.length > 0 ? list3.data.items[0].name : null
      };
    });

    expect(result.created).toBe(true);
    expect(result.list1Count).toBe(1);
    expect(result.list2Count).toBe(2);
    expect(result.list3Count).toBe(1); // After delete
    expect(result.updatedValue).toBe(150);
    expect(result.finalItemName).toBe('Item 2');
  });

  test('[Integration] Request/Reply Chain - multiple service calls', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      // Service 1: Get user
      client.subscribe('users.get', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { ok: true, user: { id: msg.data.id, name: 'Alice', profileId: 123 } },
            correlationId: msg.correlationId
          });
        }
      });

      // Service 2: Get profile
      client.subscribe('profiles.get', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { ok: true, profile: { id: msg.data.id, bio: 'Developer', postsCount: 42 } },
            correlationId: msg.correlationId
          });
        }
      });

      // Service 3: Get posts count
      client.subscribe('posts.count', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { ok: true, count: 42 },
            correlationId: msg.correlationId
          });
        }
      });

      // Chain requests
      const user = await client.request('users.get', { id: 1 });
      const profile = await client.request('profiles.get', { id: user.data.user.profileId });
      const postsCount = await client.request('posts.count', { userId: user.data.user.id });

      return {
        userName: user.data.user.name,
        profileBio: profile.data.profile.bio,
        totalPosts: postsCount.data.count
      };
    });

    expect(result.userName).toBe('Alice');
    expect(result.profileBio).toBe('Developer');
    expect(result.totalPosts).toBe(42);
  });

  test('[Integration] Event Broadcasting - multiple subscribers', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const subscriber1Events = [];
      const subscriber2Events = [];
      const subscriber3Events = [];

      // Three independent subscribers
      client.subscribe('user.action.*', (msg) => {
        subscriber1Events.push(msg.topic);
      });

      client.subscribe('user.*', (msg) => {
        subscriber2Events.push(msg.topic);
      });

      client.subscribe('*', (msg) => {
        if (msg.topic.startsWith('user.')) {
          subscriber3Events.push(msg.topic);
        }
      });

      // Wait for subscriptions to be registered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish events
      client.publish({ topic: 'user.action.login', data: {} });
      client.publish({ topic: 'user.action.logout', data: {} });
      client.publish({ topic: 'user.profile.updated', data: {} });

      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        sub1Count: subscriber1Events.length, // Should match user.action.*
        sub2Count: subscriber2Events.length, // Should match user.*
        sub3Count: subscriber3Events.length, // Should match all user.*
        sub1Events: [...subscriber1Events],
        sub2Events: [...subscriber2Events],
        sub3Events: [...subscriber3Events],
        allGotLogin: subscriber1Events.includes('user.action.login') &&
                     subscriber2Events.includes('user.action.login') &&
                     subscriber3Events.includes('user.action.login')
      };
    });

    expect(result.sub1Count).toBeGreaterThan(1); // At least 2 action events
    expect(result.sub2Count).toBeGreaterThan(2); // At least 3 user events
    expect(result.sub3Count).toBeGreaterThan(2); // At least 3 user events
    expect(result.allGotLogin).toBe(true);
  });

  test('[Integration] Lifecycle - create, use, cleanup', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      // Create client
      const client = new PanClient();
      await client.ready();

      let receivedCount = 0;

      // Subscribe
      const unsub = client.subscribe('lifecycle.test', (msg) => {
        receivedCount++;
      });

      // Publish and receive
      client.publish({ topic: 'lifecycle.test', data: {} });
      await new Promise(resolve => setTimeout(resolve, 50));

      const countAfterFirst = receivedCount;

      // Cleanup
      unsub();

      // Publish after cleanup (should not receive)
      client.publish({ topic: 'lifecycle.test', data: {} });
      await new Promise(resolve => setTimeout(resolve, 50));

      const countAfterCleanup = receivedCount;

      return {
        receivedBeforeCleanup: countAfterFirst,
        receivedAfterCleanup: countAfterCleanup,
        cleanupWorked: countAfterFirst === countAfterCleanup
      };
    });

    expect(result.receivedBeforeCleanup).toBe(1);
    expect(result.receivedAfterCleanup).toBe(1);
    expect(result.cleanupWorked).toBe(true);
  });

  test('[Integration] Concurrent Requests - parallel operations', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      // Responder with simulated delay
      client.subscribe('calc.*', async (msg) => {
        if (msg.replyTo) {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 50));

          let result;
          if (msg.topic === 'calc.add') {
            result = msg.data.a + msg.data.b;
          } else if (msg.topic === 'calc.multiply') {
            result = msg.data.a * msg.data.b;
          } else if (msg.topic === 'calc.subtract') {
            result = msg.data.a - msg.data.b;
          }

          client.publish({
            topic: msg.replyTo,
            data: { ok: true, result },
            correlationId: msg.correlationId
          });
        }
      });

      // Make 5 concurrent requests
      const start = Date.now();

      const results = await Promise.all([
        client.request('calc.add', { a: 10, b: 5 }),
        client.request('calc.multiply', { a: 10, b: 5 }),
        client.request('calc.subtract', { a: 10, b: 5 }),
        client.request('calc.add', { a: 20, b: 30 }),
        client.request('calc.multiply', { a: 3, b: 7 })
      ]);

      const elapsed = Date.now() - start;

      return {
        result1: results[0].data.result,
        result2: results[1].data.result,
        result3: results[2].data.result,
        result4: results[3].data.result,
        result5: results[4].data.result,
        allSucceeded: results.every(r => r.data.ok),
        // Should complete in ~50-100ms (parallel), not 250ms (sequential)
        wasParallel: elapsed < 150
      };
    });

    expect(result.result1).toBe(15); // 10 + 5
    expect(result.result2).toBe(50); // 10 * 5
    expect(result.result3).toBe(5);  // 10 - 5
    expect(result.result4).toBe(50); // 20 + 30
    expect(result.result5).toBe(21); // 3 * 7
    expect(result.allSucceeded).toBe(true);
    expect(result.wasParallel).toBe(true);
  });

  test('[Integration] Wildcard Hierarchy - nested topic patterns', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const allEvents = [];
      const userEvents = [];
      const userActionEvents = [];

      // Subscribe to different levels
      client.subscribe('*', (msg) => allEvents.push(msg.topic));
      client.subscribe('user.*', (msg) => userEvents.push(msg.topic));
      client.subscribe('user.action.*', (msg) => userActionEvents.push(msg.topic));

      // Wait for subscriptions to be registered
      await new Promise(resolve => setTimeout(resolve, 100));

      // Publish at different levels
      client.publish({ topic: 'user.action.login', data: {} });
      client.publish({ topic: 'user.profile.updated', data: {} });
      client.publish({ topic: 'admin.settings.changed', data: {} });

      await new Promise(resolve => setTimeout(resolve, 100));

      return {
        allCount: allEvents.length,
        userCount: userEvents.length,
        userActionCount: userActionEvents.length,
        allEvents: [...allEvents],
        userEvents: [...userEvents],
        userActionEvents: [...userActionEvents],
        allIncludesAdmin: allEvents.includes('admin.settings.changed'),
        userIncludesAdmin: userEvents.includes('admin.settings.changed'),
        userActionIncludesProfile: userActionEvents.includes('user.profile.updated')
      };
    });

    expect(result.allCount).toBeGreaterThan(2); // At least 3 events
    expect(result.userCount).toBeGreaterThan(1); // At least 2 user events
    expect(result.userActionCount).toBeGreaterThan(0); // At least 1 action event
    expect(result.allIncludesAdmin).toBe(true);
    expect(result.userIncludesAdmin).toBe(false);
    expect(result.userActionIncludesProfile).toBe(false);
  });

  test('[Integration] Error Recovery - timeout and retry', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      let attemptCount = 0;

      // Responder that fails first time, succeeds second time
      client.subscribe('flaky.service', (msg) => {
        if (msg.replyTo) {
          attemptCount++;

          if (attemptCount === 1) {
            // First attempt: don't respond (will timeout)
            return;
          }

          // Second attempt: respond successfully
          client.publish({
            topic: msg.replyTo,
            data: { ok: true, message: 'Success on retry' },
            correlationId: msg.correlationId
          });
        }
      });

      // First attempt - will timeout
      let firstAttemptFailed = false;
      try {
        await client.request('flaky.service', { test: true }, { timeoutMs: 500 });
      } catch (err) {
        firstAttemptFailed = true;
      }

      // Retry - will succeed
      const secondAttempt = await client.request('flaky.service', { test: true }, { timeoutMs: 1000 });

      return {
        firstAttemptFailed,
        secondAttemptSucceeded: secondAttempt.data.ok,
        message: secondAttempt.data.message,
        totalAttempts: attemptCount
      };
    });

    expect(result.firstAttemptFailed).toBe(true);
    expect(result.secondAttemptSucceeded).toBe(true);
    expect(result.message).toBe('Success on retry');
    expect(result.totalAttempts).toBe(2);
  });
});
