/**
 * Test utilities for LARC component testing
 * Plain JavaScript - no build step required
 */

import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert a relative file path to a file:// URL for browser loading
 */
export function fileUrl(rel) {
  return pathToFileURL(path.resolve(__dirname, '../..', rel)).toString();
}

/**
 * Create a test page with PAN bus and autoload
 * For use in Playwright page.evaluate() context
 */
export async function createTestPage(page, content) {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Test Page</title>
</head>
<body>
  ${content}
  <script type="module">
    window.panAutoload = {
      componentsPath: './pan/',
      extension: '.mjs'
    };
  </script>
  <script type="module" src="./pan/core/pan-autoload.mjs"></script>
</body>
</html>
  `;

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  // Wait for pan-bus to be ready
  await page.waitForFunction(() => window.__panReady === true, { timeout: 5000 });
}

/**
 * Wait for a custom element to be defined
 */
export async function waitForCustomElement(page, tagName) {
  await page.waitForFunction(
    (tag) => customElements.get(tag) !== undefined,
    tagName,
    { timeout: 5000 }
  );
}

/**
 * Wait for PAN message on a topic
 */
export async function waitForPanMessage(page, topic, timeoutMs = 5000) {
  return page.evaluate(
    ({ topic, timeoutMs }) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          document.removeEventListener('pan:deliver', handler);
          reject(new Error(`Timeout waiting for topic: ${topic}`));
        }, timeoutMs);

        const handler = (e) => {
          const msg = e.detail;
          if (msg && msg.topic === topic) {
            clearTimeout(timeout);
            document.removeEventListener('pan:deliver', handler);
            resolve(msg);
          }
        };

        document.addEventListener('pan:deliver', handler);
      });
    },
    { topic, timeoutMs }
  );
}

/**
 * Publish a PAN message from the test
 */
export async function publishPanMessage(page, topic, data, options = {}) {
  await page.evaluate(
    ({ topic, data, options }) => {
      const event = new CustomEvent('pan:publish', {
        detail: { topic, data, ...options },
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);
    },
    { topic, data, options }
  );
}

/**
 * Get all PAN messages that have been published
 */
export async function getPanMessages(page) {
  return page.evaluate(() => {
    const bus = document.querySelector('pan-bus');
    if (!bus) return [];
    return Array.from(bus.retained.values());
  });
}

/**
 * Clear all retained PAN messages
 */
export async function clearPanMessages(page) {
  await page.evaluate(() => {
    const bus = document.querySelector('pan-bus');
    if (bus && bus.retained) {
      bus.retained.clear();
    }
  });
}

/**
 * Playwright-specific helpers for component testing
 */
export const playwrightHelpers = {
  /**
   * Check if element is visible in viewport
   */
  async isInViewport(locator) {
    return await locator.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= window.innerHeight &&
        rect.right <= window.innerWidth
      );
    });
  },

  /**
   * Get computed style of element
   */
  async getStyle(locator, property) {
    return await locator.evaluate((el, prop) => {
      return window.getComputedStyle(el).getPropertyValue(prop);
    }, property);
  },

  /**
   * Wait for element to have specific attribute value
   */
  async waitForAttribute(locator, attribute, value, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const attrValue = await locator.getAttribute(attribute);
      if (attrValue === value) return true;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Timeout waiting for attribute ${attribute} to be ${value}`);
  },

  /**
   * Get shadow root content
   */
  async getShadowRoot(locator) {
    return await locator.evaluate(el => el.shadowRoot);
  }
};

/**
 * Browser test helpers (for use in page.evaluate() context)
 * These are serializable functions that can be passed to page.evaluate()
 */
export const browserHelpers = {
  /**
   * Wait for condition with timeout
   */
  waitFor: `
    function waitFor(condition, timeout = 5000) {
      return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
          if (condition()) {
            clearInterval(interval);
            resolve();
          } else if (Date.now() - start > timeout) {
            clearInterval(interval);
            reject(new Error('Timeout waiting for condition'));
          }
        }, 50);
      });
    }
  `,

  /**
   * Dispatch custom event
   */
  dispatch: `
    function dispatch(element, eventName, detail = {}) {
      const event = new CustomEvent(eventName, {
        detail,
        bubbles: true,
        composed: true
      });
      element.dispatchEvent(event);
    }
  `,

  /**
   * Query shadow DOM
   */
  queryShadow: `
    function queryShadow(element, selector) {
      if (!element.shadowRoot) return null;
      return element.shadowRoot.querySelector(selector);
    }
  `,

  /**
   * Query all in shadow DOM
   */
  queryShadowAll: `
    function queryShadowAll(element, selector) {
      if (!element.shadowRoot) return [];
      return Array.from(element.shadowRoot.querySelectorAll(selector));
    }
  `
};

/**
 * Assertion helpers for Playwright
 */
export function createPlaywrightAssertions(expect) {
  return {
    async toBeVisible(locator) {
      await expect(locator).toBeVisible();
    },

    async toHaveText(locator, text) {
      await expect(locator).toHaveText(text);
    },

    async toHaveCount(locator, count) {
      await expect(locator).toHaveCount(count);
    },

    async toHaveAttribute(locator, attr, value) {
      await expect(locator).toHaveAttribute(attr, value);
    },

    async toHaveClass(locator, className) {
      const classes = await locator.getAttribute('class');
      if (!classes || !classes.split(' ').includes(className)) {
        throw new Error(`Expected element to have class "${className}"`);
      }
    }
  };
}
