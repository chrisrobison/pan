/**
 * Lightweight test runner - works in both browser and Node.js
 * Zero dependencies, zero build step
 */

// Test state
const state = {
  suites: [],
  currentSuite: null,
  beforeEachHooks: [],
  afterEachHooks: [],
  beforeAllHooks: [],
  afterAllHooks: []
};

// Test results
class TestResults {
  constructor() {
    this.suites = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
    this.skippedTests = 0;
    this.startTime = 0;
    this.endTime = 0;
  }

  get duration() {
    return this.endTime - this.startTime;
  }

  get allPassed() {
    return this.failedTests === 0 && this.totalTests > 0;
  }
}

// Test suite
class TestSuite {
  constructor(name, fn) {
    this.name = name;
    this.fn = fn;
    this.tests = [];
    this.beforeEachHooks = [];
    this.afterEachHooks = [];
    this.beforeAllHooks = [];
    this.afterAllHooks = [];
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async run() {
    // Run beforeAll hooks
    for (const hook of this.beforeAllHooks) {
      await hook();
    }

    // Run tests
    for (const test of this.tests) {
      const result = await this.runTest(test);
      this.results.tests.push(result);

      if (result.status === 'passed') this.results.passed++;
      else if (result.status === 'failed') this.results.failed++;
      else if (result.status === 'skipped') this.results.skipped++;
    }

    // Run afterAll hooks
    for (const hook of this.afterAllHooks) {
      await hook();
    }

    return this.results;
  }

  async runTest(test) {
    const result = {
      name: test.name,
      status: 'passed',
      error: null,
      duration: 0
    };

    if (test.skip) {
      result.status = 'skipped';
      return result;
    }

    const startTime = Date.now();

    try {
      // Run beforeEach hooks
      for (const hook of this.beforeEachHooks) {
        await hook();
      }

      // Run test
      await test.fn();

      // Run afterEach hooks
      for (const hook of this.afterEachHooks) {
        await hook();
      }

      result.status = 'passed';
    } catch (error) {
      result.status = 'failed';
      result.error = error;
    }

    result.duration = Date.now() - startTime;
    return result;
  }
}

// Test case
class Test {
  constructor(name, fn, skip = false) {
    this.name = name;
    this.fn = fn;
    this.skip = skip;
  }
}

// Assertion helpers
class AssertionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AssertionError';
  }
}

function expect(actual) {
  return {
    toBe(expected) {
      if (actual !== expected) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be ${JSON.stringify(expected)}`);
      }
    },

    toEqual(expected) {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to equal ${JSON.stringify(expected)}`);
      }
    },

    toBeTruthy() {
      if (!actual) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be truthy`);
      }
    },

    toBeFalsy() {
      if (actual) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be falsy`);
      }
    },

    toBeNull() {
      if (actual !== null) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be null`);
      }
    },

    toBeUndefined() {
      if (actual !== undefined) {
        throw new AssertionError(`Expected ${JSON.stringify(actual)} to be undefined`);
      }
    },

    toContain(expected) {
      if (Array.isArray(actual)) {
        if (!actual.includes(expected)) {
          throw new AssertionError(`Expected array to contain ${JSON.stringify(expected)}`);
        }
      } else if (typeof actual === 'string') {
        if (!actual.includes(expected)) {
          throw new AssertionError(`Expected string to contain "${expected}"`);
        }
      } else {
        throw new AssertionError(`toContain() requires array or string`);
      }
    },

    toMatch(pattern) {
      const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
      if (!regex.test(actual)) {
        throw new AssertionError(`Expected "${actual}" to match ${pattern}`);
      }
    },

    toThrow(expected) {
      if (typeof actual !== 'function') {
        throw new AssertionError('toThrow() requires a function');
      }

      try {
        actual();
        throw new AssertionError('Expected function to throw an error');
      } catch (error) {
        if (expected && !error.message.includes(expected)) {
          throw new AssertionError(`Expected error message to include "${expected}", got "${error.message}"`);
        }
      }
    },

    toBeGreaterThan(expected) {
      if (actual <= expected) {
        throw new AssertionError(`Expected ${actual} to be greater than ${expected}`);
      }
    },

    toBeLessThan(expected) {
      if (actual >= expected) {
        throw new AssertionError(`Expected ${actual} to be less than ${expected}`);
      }
    },

    toHaveLength(expected) {
      if (actual.length !== expected) {
        throw new AssertionError(`Expected length ${actual.length} to be ${expected}`);
      }
    },

    toHaveProperty(property, value) {
      if (!(property in actual)) {
        throw new AssertionError(`Expected object to have property "${property}"`);
      }
      if (value !== undefined && actual[property] !== value) {
        throw new AssertionError(`Expected property "${property}" to be ${JSON.stringify(value)}, got ${JSON.stringify(actual[property])}`);
      }
    }
  };
}

// Test definition API
function describe(name, fn) {
  const suite = new TestSuite(name, fn);
  state.suites.push(suite);

  const previousSuite = state.currentSuite;
  state.currentSuite = suite;

  fn();

  state.currentSuite = previousSuite;
}

function test(name, fn) {
  if (!state.currentSuite) {
    throw new Error('test() must be called inside a describe() block');
  }

  const testCase = new Test(name, fn);
  state.currentSuite.tests.push(testCase);
}

function it(name, fn) {
  test(name, fn);
}

function skip(name, fn) {
  if (!state.currentSuite) {
    throw new Error('skip() must be called inside a describe() block');
  }

  const testCase = new Test(name, fn, true);
  state.currentSuite.tests.push(testCase);
}

describe.skip = (name, fn) => {
  // Skip entire suite - just don't add it
};

test.skip = skip;
it.skip = skip;

// Hooks
function beforeEach(fn) {
  if (state.currentSuite) {
    state.currentSuite.beforeEachHooks.push(fn);
  }
}

function afterEach(fn) {
  if (state.currentSuite) {
    state.currentSuite.afterEachHooks.push(fn);
  }
}

function beforeAll(fn) {
  if (state.currentSuite) {
    state.currentSuite.beforeAllHooks.push(fn);
  }
}

function afterAll(fn) {
  if (state.currentSuite) {
    state.currentSuite.afterAllHooks.push(fn);
  }
}

// Test runner
async function run() {
  const results = new TestResults();
  results.startTime = Date.now();

  for (const suite of state.suites) {
    const suiteResults = await suite.run();
    results.suites.push({
      name: suite.name,
      ...suiteResults
    });

    results.totalTests += suiteResults.passed + suiteResults.failed + suiteResults.skipped;
    results.passedTests += suiteResults.passed;
    results.failedTests += suiteResults.failed;
    results.skippedTests += suiteResults.skipped;
  }

  results.endTime = Date.now();
  return results;
}

// Reset state (useful for re-running tests)
function reset() {
  state.suites = [];
  state.currentSuite = null;
  state.beforeEachHooks = [];
  state.afterEachHooks = [];
  state.beforeAllHooks = [];
  state.afterAllHooks = [];
}

// Export for both Node.js and browser
const testRunner = {
  describe,
  test,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
  run,
  reset,
  AssertionError
};

// Browser global
if (typeof window !== 'undefined') {
  window.testRunner = testRunner;
  window.describe = describe;
  window.test = test;
  window.it = it;
  window.expect = expect;
  window.beforeEach = beforeEach;
  window.afterEach = afterEach;
  window.beforeAll = beforeAll;
  window.afterAll = afterAll;
}

export { describe, test, it, expect, beforeEach, afterEach, beforeAll, afterAll, run, reset, AssertionError };
export default testRunner;
