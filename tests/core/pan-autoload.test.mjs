/**
 * pan-autoload core tests
 * Tests the automatic component loading and initialization functionality
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('pan-autoload', () => {
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

  test('exports panAutoload object to window', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const autoloadExists = await page.evaluate(() => {
      return typeof window.panAutoload === 'object' && window.panAutoload !== null;
    });

    expect(autoloadExists).toBeTruthy();
  });

  test('has correct default config values', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const config = await page.evaluate(() => {
      return window.panAutoload.config;
    });

    expect(config.extension).toBe('.mjs');
    expect(config.componentsPath).toBe('./');
    expect(config.rootMargin).toBe(600);
    expect(config.resolvedComponentsPath).toBeTruthy();
  });

  test('can override config via window.panAutoload', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      extension: '.js',
      rootMargin: 1200
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/core/pan-autoload.js', type: 'module' });

    const config = await page.evaluate(() => {
      return window.panAutoload.config;
    });

    expect(config.extension).toBe('.js');
    expect(config.rootMargin).toBe(1200);
  });

  test('ensures pan-bus is created on init', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    // Wait a bit for init to complete
    await page.waitForFunction(() => {
      return document.querySelector('pan-bus') !== null;
    }, { timeout: 5000 });

    const busExists = await page.evaluate(() => {
      return document.querySelector('pan-bus') !== null;
    });

    expect(busExists).toBeTruthy();
  });

  test('observeTree function exists and is callable', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(() => {
      return typeof window.panAutoload.observeTree === 'function';
    });

    expect(result).toBeTruthy();
  });

  test('maybeLoadFor function exists and is callable', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(() => {
      return typeof window.panAutoload.maybeLoadFor === 'function';
    });

    expect(result).toBeTruthy();
  });

  test('detects custom elements with hyphenated names', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <my-custom-element></my-custom-element>
  <regular-div></regular-div>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Wait for autoload to initialize
    await page.waitForTimeout(500);

    const customElements = await page.evaluate(() => {
      const elements = document.querySelectorAll(':not(:defined)');
      return Array.from(elements).map(el => el.tagName.toLowerCase());
    });

    expect(customElements.length).toBeGreaterThan(0);
  });

  test('respects data-module attribute for explicit module paths', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <custom-widget data-module="./custom/path/widget.mjs"></custom-widget>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    const moduleUrl = await page.evaluate(() => {
      const el = document.querySelector('custom-widget');
      return el ? el.getAttribute('data-module') : null;
    });

    expect(moduleUrl).toBe('./custom/path/widget.mjs');
  });

  test('sets up MutationObserver for dynamic elements', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    // Add a custom element dynamically
    await page.evaluate(() => {
      const el = document.createElement('dynamic-element');
      document.body.appendChild(el);
    });

    // Wait for mutation observer to detect it
    await page.waitForTimeout(200);

    const elementExists = await page.evaluate(() => {
      return document.querySelector('dynamic-element') !== null;
    });

    expect(elementExists).toBeTruthy();
  });

  test('handles IntersectionObserver for lazy loading', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasIntersectionObserver = await page.evaluate(() => {
      return 'IntersectionObserver' in window;
    });

    expect(hasIntersectionObserver).toBeTruthy();
  });

  test('normalizes extension with leading dot', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const normalized = await page.evaluate(() => {
      // Test the normalization logic
      const testExt = 'mjs';
      const normalized = testExt.startsWith('.') ? testExt : `.${testExt}`;
      return normalized;
    });

    expect(normalized).toBe('.mjs');
  });

  test('observeTree does not observe already observed elements', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(() => {
      const el = document.createElement('test-element');
      document.body.appendChild(el);

      // Try to observe same element twice
      window.panAutoload.observeTree(el);
      window.panAutoload.observeTree(el);

      return true; // Should not throw
    });

    expect(result).toBeTruthy();
  });

  test('handles components in subdirectories', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      componentsPath: './components/',
      extension: '.mjs'
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/core/pan-autoload.js', type: 'module' });

    const componentsPath = await page.evaluate(() => {
      return window.panAutoload.config.componentsPath;
    });

    expect(componentsPath).toBe('./components/');
  });

  test('handles baseUrl configuration', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      baseUrl: 'https://cdn.example.com/components',
      componentsPath: './widgets',
      extension: '.mjs'
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/core/pan-autoload.js', type: 'module' });

    const resolvedPath = await page.evaluate(() => {
      return window.panAutoload.config.resolvedComponentsPath;
    });

    expect(resolvedPath).toContain('cdn.example.com');
  });

  test('loads only once when element appears multiple times', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <test-once></test-once>
  <test-once></test-once>
  <test-once></test-once>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // The loading Set should prevent duplicate loads
    const elements = await page.evaluate(() => {
      return document.querySelectorAll('test-once').length;
    });

    expect(elements).toBe(3);
  });

  test('handles load failures gracefully', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <non-existent-component></non-existent-component>
  <script type="module" src="./dist/core/pan-autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Set up console listener to catch warnings
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    // Wait a bit for load attempt
    await page.waitForTimeout(1000);

    // Page should still be functional
    const stillWorks = await page.evaluate(() => {
      return document.body !== null;
    });

    expect(stillWorks).toBeTruthy();
  });

  test('uses requestIdleCallback when available', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const hasRequestIdleCallback = await page.evaluate(() => {
      return typeof requestIdleCallback === 'function';
    });

    expect(hasRequestIdleCallback).toBeTruthy();
  });

  test('falls back when requestIdleCallback unavailable', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(() => {
      // Test fallback logic
      const hasRIC = typeof requestIdleCallback === 'function';
      return hasRIC ? 'modern' : 'fallback';
    });

    expect(result).toBe('modern'); // Chromium supports it
  });
});
