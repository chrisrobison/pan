# LARC Test Suite

Comprehensive test suite for all LARC (PAN) components.

**Philosophy:** Zero-build, plain JavaScript tests that align with the project's ethos of simplicity.

## Test Structure

```
tests/
├── helpers/
│   └── test-utils.ts          # Shared test utilities and helpers
├── core/
│   ├── pan-bus.spec.ts        # Message bus tests
│   ├── pan-client.spec.ts     # Client API tests
│   └── pan-autoload.spec.ts   # Component autoloader tests (TODO)
├── ui/
│   ├── pan-card.spec.ts       # Card component tests
│   ├── pan-modal.spec.ts      # Modal dialog tests
│   ├── pan-tabs.spec.ts       # Tabs component tests
│   └── ...                    # More UI component tests
└── components/
    ├── pan-store.spec.ts      # State management tests
    ├── pan-router.spec.ts     # Router tests
    └── ...                    # More feature component tests
```

## Running Tests

### Using npm scripts

```bash
# Run all tests (headless)
npm test

# Run tests with visible browser
npm run test:headed

# Run a specific test file
npm run test:file tests/core/pan-bus.test.mjs

# Open browser-based test runner
npm run test:browser
```

### Using make (recommended)

```bash
# Run all tests (headless)
make test

# Run tests with visible browser
make test-headed

# Open browser-based test runner
make test-browser

# Run a specific test file
make test-file FILE=tests/core/pan-bus.test.mjs

# Show help
make help
```

### Using the CLI directly

```bash
# Run all tests
node tests/lib/cli-runner.mjs

# Run with headed browser
node tests/lib/cli-runner.mjs --headed

# Run specific file
node tests/lib/cli-runner.mjs tests/core/pan-bus.test.mjs

# Filter by pattern
node tests/lib/cli-runner.mjs --pattern="pan-bus"
```

### Browser-based test runner

Open `tests/index.html` in your browser for an interactive test runner with:
- Visual test results
- Real-time updates
- Filter/search functionality
- Test details and error messages

```bash
# Option 1: Open directly
open tests/index.html

# Option 2: Serve with local server (recommended)
python3 -m http.server 8000
# Then open http://localhost:8000/tests/
```

## Test Utilities

The `lib/test-utils.mjs` file provides common utilities:

- **fileUrl(path)** - Convert relative path to file:// URL
- **createTestPage(page, content)** - Create test page with PAN bus
- **waitForCustomElement(page, tagName)** - Wait for custom element definition
- **waitForPanMessage(page, topic)** - Wait for PAN message on topic
- **publishPanMessage(page, topic, data)** - Publish PAN message from test
- **getPanMessages(page)** - Get all retained messages
- **clearPanMessages(page)** - Clear retained messages

## Test Runner API

The `lib/test-runner.mjs` provides a lightweight test framework:

- **describe(name, fn)** - Create a test suite
- **test(name, fn)** / **it(name, fn)** - Define a test
- **expect(value)** - Assertion helpers
- **beforeEach(fn)** / **afterEach(fn)** - Setup/teardown hooks
- **beforeAll(fn)** / **afterAll(fn)** - Suite-level hooks

## Writing Tests

### Basic Test Structure

```javascript
import { chromium } from '@playwright/test';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

let browser, page;

beforeAll(async () => {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
});

afterAll(async () => {
  await browser.close();
});

describe('my-component', () => {
  test('does something', async () => {
    await page.goto(fileUrl('examples/my-example.html'));

    await page.waitForFunction(() => customElements.get('my-component') !== undefined);

    const exists = await page.evaluate(() => {
      return document.querySelector('my-component') !== null;
    });
    expect(exists).toBeTruthy();

    // Your test assertions...
  });
});
```

### Testing PAN Messages

```javascript
test('publishes message on action', async () => {
  await page.goto(fileUrl('examples/test.html'));

  const messagePromise = page.evaluate(() => {
    return new Promise((resolve) => {
      document.addEventListener('pan:deliver', (e) => {
        if (e.detail.topic === 'my.topic') {
          resolve(e.detail.data);
        }
      }, { once: true });
    });
  });

  // Trigger the action
  await page.click('#trigger-button');

  const data = await messagePromise;
  expect(data.expected).toBe('value');
});
```

### Testing Component Interactions

```javascript
test('updates on user input', async () => {
  await page.goto(fileUrl('examples/form.html'));

  // Fill input
  await page.evaluate(() => {
    const input = document.querySelector('#my-input');
    input.value = 'test value';
    input.dispatchEvent(new Event('input'));
  });

  // Check output
  const outputText = await page.evaluate(() => {
    return document.querySelector('#output').textContent;
  });
  expect(outputText).toBe('test value');
});
```

## Test Coverage Goals

- ✅ **Core Components** (pan-bus, pan-client, pan-autoload)
- ✅ **UI Components** (pan-card, pan-modal, pan-tabs, etc.)
- ⏳ **Feature Components** (pan-store, pan-router, pan-data-table, etc.)
- ⏳ **Integration Tests** (component combinations)
- ⏳ **Performance Tests** (large datasets, many messages)
- ⏳ **Accessibility Tests** (ARIA, keyboard navigation)

## Current Test Status

### Completed (8 test files)
- ✅ pan-bus (7 tests) - Message bus core functionality
- ✅ pan-client (9 tests) - Client API and patterns
- ✅ pan-card (3 tests) - Card component rendering
- ✅ pan-modal (3 tests) - Modal open/close behavior
- ✅ pan-tabs (3 tests) - Tab switching and keyboard nav
- ✅ pan-store (4 tests) - State management and persistence
- ✅ pan-router (5 tests) - Routing and navigation

### To Do
- pan-autoload - Component lazy loading
- pan-data-table - Table rendering and sorting
- pan-form - Form validation
- pan-theme-provider - Theming
- pan-markdown-editor - Markdown editing
- pan-websocket - WebSocket bridge
- pan-idb - IndexedDB operations
- All remaining UI components (10+)
- All remaining feature components (20+)

## Contributing Tests

When adding new tests:

1. Create test file in appropriate directory (core/, ui/, or components/)
2. Use descriptive test names that explain what is being tested
3. Use the helpers from test-utils.ts for common operations
4. Test both happy paths and error cases
5. Ensure tests are isolated (don't depend on other tests)
6. Clean up any side effects (localStorage, etc.)
7. Add comments for complex test logic

## Debugging Tests

### Debug single test
```bash
npx playwright test tests/core/pan-bus.spec.ts --debug
```

### Generate test report
```bash
npx playwright test
npx playwright show-report
```

### Update snapshots
```bash
npx playwright test --update-snapshots
```

## CI/CD Integration

Tests run automatically on:
- Every commit (pre-commit hook)
- Every pull request
- Before publishing to npm

## Performance Considerations

- Tests should complete in < 30 seconds each
- Use `page.waitForFunction()` instead of fixed `setTimeout()`
- Clean up event listeners and subscriptions
- Use `{ once: true }` for one-time event listeners
