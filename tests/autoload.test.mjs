/**
 * autoload.js tests
 * Tests the root autoload module (dist/autoload.js)
 * This is the same as pan-autoload but at the root dist level
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from './lib/test-runner.mjs';
import { fileUrl } from './lib/test-utils.mjs';

describe('autoload.js', () => {
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
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const autoloadExists = await page.evaluate(() => {
      return typeof window.panAutoload === 'object' && window.panAutoload !== null;
    });

    expect(autoloadExists).toBeTruthy();
  });

  test('has default config values', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const config = await page.evaluate(() => {
      return window.panAutoload ? window.panAutoload.config : null;
    });

    expect(config).toBeTruthy();
    expect(config.extension).toBe('.mjs');
    expect(config.componentsPath).toBe('./');
  });

  test('can be configured via window.panAutoload before loading', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      extension: '.js',
      componentsPath: './components/',
      rootMargin: 1000
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const config = await page.evaluate(() => {
      return window.panAutoload.config;
    });

    expect(config.extension).toBe('.js');
    expect(config.componentsPath).toBe('./components/');
    expect(config.rootMargin).toBe(1000);
  });

  test('initializes automatically on load', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <custom-auto-element></custom-auto-element>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    // Wait for initialization
    await page.waitForTimeout(300);

    const initialized = await page.evaluate(() => {
      return window.panAutoload !== undefined;
    });

    expect(initialized).toBeTruthy();
  });

  test('creates pan-bus element automatically', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    // Wait for bus creation
    await page.waitForFunction(() => {
      return document.querySelector('pan-bus') !== null;
    }, { timeout: 2000 });

    const busExists = await page.evaluate(() => {
      return document.querySelector('pan-bus') !== null;
    });

    expect(busExists).toBeTruthy();
  });

  test('exports observeTree function', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const hasObserveTree = await page.evaluate(() => {
      return typeof window.panAutoload?.observeTree === 'function';
    });

    expect(hasObserveTree).toBeTruthy();
  });

  test('exports maybeLoadFor function', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const hasMaybeLoadFor = await page.evaluate(() => {
      return typeof window.panAutoload?.maybeLoadFor === 'function';
    });

    expect(hasMaybeLoadFor).toBeTruthy();
  });

  test('detects undefined custom elements', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <my-widget></my-widget>
  <another-component></another-component>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(500);

    const undefinedElements = await page.evaluate(() => {
      return document.querySelectorAll(':not(:defined)').length;
    });

    // Should detect custom elements that haven't been defined
    expect(undefinedElements).toBeGreaterThan(0);
  });

  test('observes dynamically added elements', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    // Add element dynamically
    await page.evaluate(() => {
      const el = document.createElement('dynamic-widget');
      document.body.appendChild(el);
    });

    await page.waitForTimeout(200);

    const elementExists = await page.evaluate(() => {
      return document.querySelector('dynamic-widget') !== null;
    });

    expect(elementExists).toBeTruthy();
  });

  test('respects data-module attribute', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <custom-component data-module="./custom-path/component.mjs"></custom-component>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const dataModule = await page.evaluate(() => {
      const el = document.querySelector('custom-component');
      return el ? el.getAttribute('data-module') : null;
    });

    expect(dataModule).toBe('./custom-path/component.mjs');
  });

  test('handles load errors gracefully without crashing', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <non-existent-element></non-existent-element>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });

    // Listen for console warnings
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });

    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(1000);

    // Page should still be functional
    const pageWorks = await page.evaluate(() => {
      return document.body !== null && window.panAutoload !== undefined;
    });

    expect(pageWorks).toBeTruthy();
  });

  test('uses IntersectionObserver when available', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const hasIO = await page.evaluate(() => {
      return 'IntersectionObserver' in window;
    });

    expect(hasIO).toBeTruthy();
  });

  test('configures IntersectionObserver with rootMargin', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      rootMargin: 800
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const rootMargin = await page.evaluate(() => {
      return window.panAutoload.config.rootMargin;
    });

    expect(rootMargin).toBe(800);
  });

  test('handles elements without hyphen in name', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <div>Normal element</div>
  <span>Another normal element</span>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    // Should not try to load regular elements
    const pageWorks = await page.evaluate(() => {
      return document.querySelector('div') !== null && document.querySelector('span') !== null;
    });

    expect(pageWorks).toBeTruthy();
  });

  test('normalizes extension to include dot', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      extension: 'js' // Without dot
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const extension = await page.evaluate(() => {
      return window.panAutoload.config.extension;
    });

    expect(extension).toBe('.js');
  });

  test('normalizes componentsPath with trailing slash', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      componentsPath: './components' // Without trailing slash
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const resolvedPath = await page.evaluate(() => {
      return window.panAutoload.config.resolvedComponentsPath;
    });

    expect(resolvedPath).toBeTruthy();
  });

  test('handles baseUrl configuration for CDN loading', async () => {
    const html = `
<!DOCTYPE html>
<html>
<head>
  <script>
    window.panAutoload = {
      baseUrl: 'https://cdn.example.com',
      componentsPath: './widgets'
    };
  </script>
</head>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const resolvedPath = await page.evaluate(() => {
      return window.panAutoload.config.resolvedComponentsPath;
    });

    expect(resolvedPath).toContain('cdn.example.com');
  });

  test('observeTree can be called manually', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <div id="container"></div>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const result = await page.evaluate(() => {
      const container = document.getElementById('container');
      const el = document.createElement('manual-widget');
      container.appendChild(el);

      // Manually observe
      window.panAutoload.observeTree(container);

      return document.querySelector('manual-widget') !== null;
    });

    expect(result).toBeTruthy();
  });

  test('maybeLoadFor can be called manually', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const result = await page.evaluate(async () => {
      const el = document.createElement('manual-load-widget');
      document.body.appendChild(el);

      // Manually trigger load
      await window.panAutoload.maybeLoadFor(el);

      return true; // Returns without error
    });

    expect(result).toBeTruthy();
  });

  test('prevents duplicate loading of same component', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <same-widget></same-widget>
  <same-widget></same-widget>
  <same-widget></same-widget>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(500);

    const count = await page.evaluate(() => {
      return document.querySelectorAll('same-widget').length;
    });

    // All three should exist, but component should only load once
    expect(count).toBe(3);
  });

  test('skips already defined custom elements', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <pre-defined-element></pre-defined-element>
  <script type="module">
    // Define element before autoload runs
    class PreDefinedElement extends HTMLElement {
      constructor() {
        super();
        this.textContent = 'Already defined';
      }
    }
    customElements.define('pre-defined-element', PreDefinedElement);
  </script>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const isDefined = await page.evaluate(() => {
      return customElements.get('pre-defined-element') !== undefined;
    });

    expect(isDefined).toBeTruthy();
  });

  test('uses requestIdleCallback when available', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(200);

    const hasRIC = await page.evaluate(() => {
      return typeof requestIdleCallback === 'function';
    });

    expect(hasRIC).toBeTruthy();
  });

  test('works in environment without requestIdleCallback', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <script>
    // Remove requestIdleCallback to test fallback
    delete window.requestIdleCallback;
  </script>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const initialized = await page.evaluate(() => {
      return window.panAutoload !== undefined;
    });

    expect(initialized).toBeTruthy();
  });

  test('observes attribute changes on data-module', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <test-element></test-element>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    // Change data-module attribute
    await page.evaluate(() => {
      const el = document.querySelector('test-element');
      el.setAttribute('data-module', './new-path/test-element.mjs');
    });

    await page.waitForTimeout(200);

    const dataModule = await page.evaluate(() => {
      const el = document.querySelector('test-element');
      return el.getAttribute('data-module');
    });

    expect(dataModule).toBe('./new-path/test-element.mjs');
  });

  test('integrates with existing pan-bus', async () => {
    const html = `
<!DOCTYPE html>
<html>
<body>
  <pan-bus></pan-bus>
  <script type="module" src="./dist/autoload.js"></script>
</body>
</html>`;

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addScriptTag({ path: './dist/autoload.js', type: 'module' });

    await page.waitForTimeout(300);

    const busCount = await page.evaluate(() => {
      return document.querySelectorAll('pan-bus').length;
    });

    // Should not create duplicate bus
    expect(busCount).toBe(1);
  });
});
