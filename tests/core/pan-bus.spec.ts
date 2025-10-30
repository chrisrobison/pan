import { test, expect } from '@playwright/test';
import { fileUrl, waitForCustomElement, publishPanMessage, waitForPanMessage } from '../helpers/test-utils';

test.describe('pan-bus', () => {
  test('loads and becomes ready', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));

    // Wait for pan-bus to be defined
    await waitForCustomElement(page, 'pan-bus');

    // Check that pan-bus element exists
    const bus = page.locator('pan-bus');
    await expect(bus).toBeAttached();

    // Check that __panReady is set
    const isReady = await page.evaluate(() => window.__panReady);
    expect(isReady).toBe(true);
  });

  test('publishes and delivers messages', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => window.__panReady === true);

    // Set up a message listener
    const messagePromise = page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e: CustomEvent) => {
          resolve(e.detail);
        }, { once: true });
      });
    });

    // Publish a message
    await publishPanMessage(page, 'test.message', { value: 42 });

    // Wait for the message to be delivered
    const message = await messagePromise;
    expect(message).toMatchObject({
      topic: 'test.message',
      data: { value: 42 }
    });
  });

  test('supports wildcard topic patterns', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => window.__panReady === true);

    // Subscribe to wildcard pattern
    const messagesPromise = page.evaluate(() => {
      const messages: any[] = [];
      return new Promise((resolve) => {
        let count = 0;
        document.addEventListener('pan:subscribe', () => {
          document.addEventListener('pan:deliver', (e: CustomEvent) => {
            const msg = e.detail;
            if (msg.topic.startsWith('user.')) {
              messages.push(msg);
              count++;
              if (count === 2) resolve(messages);
            }
          });
        }, { once: true });

        // Subscribe to user.*
        const event = new CustomEvent('pan:subscribe', {
          detail: { topics: ['user.*'], clientId: 'test-client' },
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(event);
      });
    });

    // Publish multiple messages
    await publishPanMessage(page, 'user.login', { id: 1 });
    await publishPanMessage(page, 'user.logout', { id: 1 });
    await publishPanMessage(page, 'admin.action', { id: 2 }); // Should not match

    const messages = await messagesPromise;
    expect(messages).toHaveLength(2);
    expect(messages[0].topic).toBe('user.login');
    expect(messages[1].topic).toBe('user.logout');
  });

  test('retains messages when requested', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => window.__panReady === true);

    // Publish a retained message
    await publishPanMessage(page, 'app.config', { theme: 'dark' }, { retain: true });

    // Check that the message is retained
    const retained = await page.evaluate(() => {
      const bus = document.querySelector('pan-bus') as any;
      return bus.retained.get('app.config');
    });

    expect(retained).toMatchObject({
      topic: 'app.config',
      data: { theme: 'dark' }
    });
  });

  test('delivers retained messages to late subscribers', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => window.__panReady === true);

    // Publish a retained message first
    await publishPanMessage(page, 'app.state', { ready: true }, { retain: true });

    // Subscribe later with retained option
    const retainedMessage = await page.evaluate(() => {
      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e: CustomEvent) => {
          if (e.detail.topic === 'app.state') {
            resolve(e.detail);
          }
        }, { once: true });

        // Subscribe with retained: true
        const event = new CustomEvent('pan:subscribe', {
          detail: {
            topics: ['app.state'],
            clientId: 'late-subscriber',
            options: { retained: true }
          },
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(event);
      });
    });

    expect(retainedMessage).toMatchObject({
      topic: 'app.state',
      data: { ready: true }
    });
  });

  test('unsubscribes correctly', async ({ page }) => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.waitForFunction(() => window.__panReady === true);

    const result = await page.evaluate(() => {
      let messageCount = 0;

      return new Promise((resolve) => {
        const handler = (e: CustomEvent) => {
          if (e.detail.topic === 'test.count') {
            messageCount++;
          }
        };

        document.addEventListener('pan:deliver', handler);

        // Subscribe
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['test.count'], clientId: 'counter' },
          bubbles: true,
          composed: true
        }));

        // Publish first message
        document.dispatchEvent(new CustomEvent('pan:publish', {
          detail: { topic: 'test.count', data: { n: 1 } },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          // Unsubscribe
          document.dispatchEvent(new CustomEvent('pan:unsubscribe', {
            detail: { topics: ['test.count'], clientId: 'counter' },
            bubbles: true,
            composed: true
          }));

          // Publish second message (should not be received)
          document.dispatchEvent(new CustomEvent('pan:publish', {
            detail: { topic: 'test.count', data: { n: 2 } },
            bubbles: true,
            composed: true
          }));

          setTimeout(() => {
            document.removeEventListener('pan:deliver', handler);
            resolve(messageCount);
          }, 100);
        }, 100);
      });
    });

    expect(result).toBe(1); // Only the first message should be received
  });
});
