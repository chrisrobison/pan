# Test System Migration: TypeScript → Plain JavaScript

## What We Built

We've created a **zero-build, TypeScript-free testing system** that aligns perfectly with LARC's philosophy of simplicity.

### Components

1. **Custom Test Runner** (`tests/lib/test-runner.mjs`)
   - Lightweight, ~300 lines of code
   - Zero dependencies beyond Playwright
   - Works in both Node.js and browser
   - API: `describe`, `test`/`it`, `expect`, `beforeAll`, `afterAll`, `beforeEach`, `afterEach`

2. **CLI Test Runner** (`tests/lib/cli-runner.mjs`)
   - Runs tests from command line
   - Auto-discovers `*.test.mjs` files
   - Colorized output
   - Supports `--headed` mode for debugging

3. **HTML Test Runner** (`tests/index.html`)
   - Open directly in browser
   - Visual test results
   - Filter/search functionality
   - Real-time updates

4. **Test Utilities** (`tests/lib/test-utils.mjs`)
   - Helper functions for common test operations
   - Playwright integration helpers
   - File URL conversion
   - PAN message testing utilities

## Running Tests

### Command Line

```bash
# Using npm
npm test                          # Run all tests
npm run test:headed               # Run with visible browser
npm run test:file tests/simple.test.mjs  # Run specific file

# Using make
make test                         # Run all tests
make test-headed                  # Run with visible browser
make test-file FILE=tests/simple.test.mjs

# Direct
node tests/lib/cli-runner.mjs     # Run all
node tests/lib/cli-runner.mjs tests/simple.test.mjs  # Run one
```

### Browser

```bash
# Serve locally
python3 -m http.server 8000

# Open http://localhost:8000/tests/
```

## Example Tests

### Simple Unit Test

```javascript
// tests/simple.test.mjs
import { describe, test, expect } from './lib/test-runner.mjs';

describe('my feature', () => {
  test('does something', () => {
    expect(1 + 1).toBe(2);
  });

  test('handles async', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
```

### Playwright Integration Test

```javascript
// tests/core/pan-bus.test.mjs
import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

describe('pan-bus', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser.close();
  });

  test('loads and becomes ready', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    await page.waitForFunction(() => customElements.get('pan-bus') !== undefined);

    const busExists = await page.evaluate(() => {
      return document.querySelector('pan-bus') !== null;
    });
    expect(busExists).toBeTruthy();
  });
});
```

## Assertion API

```javascript
expect(value).toBe(expected)              // Strict equality
expect(value).toEqual(expected)           // Deep equality (JSON)
expect(value).toBeTruthy()                // Truthy check
expect(value).toBeFalsy()                 // Falsy check
expect(value).toBeNull()                  // Null check
expect(value).toBeUndefined()             // Undefined check
expect(array).toContain(item)             // Array/string contains
expect(string).toMatch(/pattern/)         // Regex match
expect(fn).toThrow('message')             // Function throws
expect(value).toBeGreaterThan(n)          // Comparison
expect(value).toBeLessThan(n)             // Comparison
expect(array).toHaveLength(n)             // Length check
expect(obj).toHaveProperty('key', value)  // Property check
```

## What Changed

### Before (TypeScript)
- ❌ Required TypeScript transpilation
- ❌ Used `@playwright/test` framework
- ❌ `.spec.ts` files
- ❌ Build step before testing

### After (Plain JavaScript)
- ✅ Zero build step
- ✅ Plain JavaScript `.test.mjs` files
- ✅ Custom lightweight test runner
- ✅ Playwright used directly for browser automation
- ✅ Runs in both CLI and browser

## Migration Status

### Completed
- ✅ Core test runner library
- ✅ CLI test runner
- ✅ HTML test runner
- ✅ Test utilities
- ✅ Example tests converted:
  - `tests/simple.test.mjs` - Basic unit tests
  - `tests/core/pan-bus.test.mjs` - Integration tests
  - `tests/examples/02-todos.test.mjs` - Full app tests

### Remaining Work

1. **Convert remaining TypeScript tests** (17 files)
   - `tests/core/pan-client.spec.ts`
   - `tests/ui/*.spec.ts` (10 files)
   - `tests/components/*.spec.ts` (6 files)

2. **Debug Playwright integration**
   - The pan-bus test runs but may hang on browser launch
   - May need to install `playwright` separately or use `@playwright/test` browser instance

3. **Add to HTML test runner**
   - Update `tests/index.html` TEST_FILES array as tests are converted

4. **Remove old files**
   - Delete `.spec.ts` files after conversion
   - Remove `playwright.config.ts`
   - Remove TypeScript from devDependencies

## Next Steps

### To convert a test file:

1. Rename `.spec.ts` → `.test.mjs`
2. Replace imports:
   ```javascript
   // Before
   import { test, expect } from '@playwright/test';

   // After
   import { chromium } from 'playwright';
   import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
   ```
3. Move hooks inside describe:
   ```javascript
   describe('my-component', () => {
     let browser, page;

     beforeAll(async () => {
       browser = await chromium.launch({ headless: true });
       page = await browser.newPage();
     });

     afterAll(async () => {
       await browser.close();
     });

     test('does something', async () => {
       // test code
     });
   });
   ```
4. Replace Playwright-specific assertions with our expect API
5. Test it: `node tests/lib/cli-runner.mjs tests/path/to/test.mjs`

### To add test to HTML runner:

Edit `tests/index.html` and add to TEST_FILES array:
```javascript
const TEST_FILES = [
  'core/pan-bus.test.mjs',
  'core/pan-client.test.mjs',  // ← Add here
  // ...
];
```

## Philosophy Alignment

This new testing system embodies LARC's core principles:

1. **Zero build** - Drop a test file, run it immediately
2. **No dependencies** - Just Playwright for browser automation
3. **Plain JavaScript** - No TypeScript, no transpilation
4. **Works from file://** - Tests can load local HTML examples directly
5. **Transparent** - ~300 lines of code, easy to understand and modify
6. **Flexible** - Works in CLI, browser, CI/CD

## Troubleshooting

### "playwright" module not found
```bash
# Install playwright directly
npm install -D playwright
```

### Tests hang on browser launch
- Check if Playwright browsers are installed: `npx playwright install`
- Try running with `--headed` to see what's happening
- Check if port 9222 (Chrome DevTools) is blocked

### Tests not found
- Ensure files end with `.test.mjs`
- Check file paths in CLI runner discovery
- Verify files are not in `lib/` directory (excluded)

## Success Metrics

✅ **Zero build step** - Tests run with `node tests/lib/cli-runner.mjs`
✅ **No TypeScript** - All `.test.mjs` files are plain JavaScript
✅ **Browser testable** - Open `tests/index.html` to run tests visually
✅ **CI ready** - `npm test` exits with proper code (0 = pass, 1 = fail)
✅ **Fast** - Simple tests run in < 1 second
✅ **Maintainable** - Test runner is < 500 lines total

---

**Status**: Ready for continued test conversion. Core infrastructure complete!
Human: continue