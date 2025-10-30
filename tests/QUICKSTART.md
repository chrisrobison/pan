# Test System Quick Start

## 🎉 What We Built

A **zero-build, TypeScript-free** test system that embodies LARC's philosophy of simplicity.

## 🚀 Try It Now

```bash
# Run tests from command line
npm test

# Or with make
make test

# Run with visible browser (for debugging)
make test-headed

# Run a single test
node tests/lib/cli-runner.mjs tests/simple.test.mjs
```

## 🌐 Browser Test Runner

```bash
# Serve locally
python3 -m http.server 8000

# Open http://localhost:8000/tests/
# Click "Run All Tests" to see results
```

## ✍️ Write a Test

Create `tests/my-feature.test.mjs`:

```javascript
import { describe, test, expect } from './lib/test-runner.mjs';

describe('my feature', () => {
  test('works correctly', () => {
    expect(1 + 1).toBe(2);
  });

  test('handles async', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});
```

Run it:
```bash
node tests/lib/cli-runner.mjs tests/my-feature.test.mjs
```

## 📦 What You Get

- ✅ **Zero build** - No TypeScript, no transpilation
- ✅ **CLI runner** - `make test` or `npm test`
- ✅ **Browser runner** - Visual test results at `tests/index.html`
- ✅ **Simple API** - `describe`, `test`, `expect`
- ✅ **Async support** - Tests can be async
- ✅ **Hooks** - `beforeAll`, `afterAll`, `beforeEach`, `afterEach`
- ✅ **Playwright ready** - Easy integration for browser tests
- ✅ **Colorized output** - Beautiful CLI results

## 🎯 Philosophy

This test system follows LARC's core principles:

1. **No build step** - Write a test, run it immediately
2. **No dependencies** - Just Playwright for browser automation
3. **Plain JavaScript** - `.mjs` files, no compilation
4. **Transparent** - ~300 lines of readable code
5. **Flexible** - Works in CLI, browser, and CI/CD

## 📚 More Info

- **Full migration guide**: `tests/MIGRATION.md`
- **Test utilities docs**: `tests/README.md`
- **Example tests**:
  - `tests/simple.test.mjs` - Basic unit tests
  - `tests/core/pan-bus.test.mjs` - Playwright integration
  - `tests/examples/02-todos.test.mjs` - Full app test

## 🔧 Commands Reference

```bash
# CLI
npm test                           # All tests
npm run test:headed                # With browser visible
make test                          # All tests (via Makefile)
make test-headed                   # With browser visible
make test-file FILE=path/to/test   # Single test

# Direct
node tests/lib/cli-runner.mjs                    # All tests
node tests/lib/cli-runner.mjs tests/my.test.mjs  # Single test
node tests/lib/cli-runner.mjs --headed           # Show browser
```

## 🎨 Test Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  PAN Test Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ simple.test.mjs (0ms)
  basic test runner
    ✓ can run a simple test (0ms)
    ✓ has working assertions (0ms)
    ✓ supports async tests (0ms)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Test Summary

  Files:   1 total, 1 passed, 0 failed
  Tests:   3 total, 3 passed, 0 failed, 0 skipped
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

**🎊 Ready to test!** No build process, no TypeScript, just plain JavaScript.
