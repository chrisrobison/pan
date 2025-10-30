/**
 * Test utilities for LARC component testing
 */

import { Page, Locator, expect } from '@playwright/test';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Convert a relative file path to a file:// URL for browser loading
 */
export function fileUrl(rel: string): string {
  return pathToFileURL(path.resolve(__dirname, '../..', rel)).toString();
}

/**
 * Create a test page with PAN bus and autoload
 */
export async function createTestPage(page: Page, content: string): Promise<void> {
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
export async function waitForCustomElement(page: Page, tagName: string): Promise<void> {
  await page.waitForFunction(
    (tag) => customElements.get(tag) !== undefined,
    tagName,
    { timeout: 5000 }
  );
}

/**
 * Get shadow root content of an element
 */
export async function getShadowRoot(locator: Locator): Promise<Locator> {
  // Playwright automatically pierces shadow DOM, but this helper is for clarity
  return locator;
}

/**
 * Wait for PAN message on a topic
 */
export async function waitForPanMessage(page: Page, topic: string, timeoutMs = 5000): Promise<any> {
  return page.evaluate(
    ({ topic, timeoutMs }) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          document.removeEventListener('pan:deliver', handler);
          reject(new Error(`Timeout waiting for topic: ${topic}`));
        }, timeoutMs);

        const handler = (e: CustomEvent) => {
          const msg = e.detail;
          if (msg && msg.topic === topic) {
            clearTimeout(timeout);
            document.removeEventListener('pan:deliver', handler);
            resolve(msg);
          }
        };

        document.addEventListener('pan:deliver', handler as EventListener);
      });
    },
    { topic, timeoutMs }
  );
}

/**
 * Publish a PAN message from the test
 */
export async function publishPanMessage(
  page: Page,
  topic: string,
  data: any,
  options: { retain?: boolean } = {}
): Promise<void> {
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
export async function getPanMessages(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const bus = document.querySelector('pan-bus') as any;
    if (!bus) return [];
    return Array.from(bus.retained.values());
  });
}

/**
 * Clear all retained PAN messages
 */
export async function clearPanMessages(page: Page): Promise<void> {
  await page.evaluate(() => {
    const bus = document.querySelector('pan-bus') as any;
    if (bus && bus.retained) {
      bus.retained.clear();
    }
  });
}

/**
 * Type declarations for PAN global
 */
declare global {
  interface Window {
    __panReady?: boolean;
    panAutoload?: any;
  }
}
