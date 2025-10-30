#!/usr/bin/env node

/**
 * CLI Test Runner for PAN tests
 * Uses Playwright to run tests in real browser environment
 * Zero build step - just plain JavaScript
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CLI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(color, ...args) {
  console.log(color + args.join(' ') + colors.reset);
}

// Discover test files
function discoverTests(dir, pattern = /\.test\.m?js$/) {
  const files = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory() && entry.name !== 'lib' && entry.name !== 'node_modules') {
        walk(fullPath);
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }

  walk(dir);
  return files;
}

// Run a single test file
async function runTestFile(testFile) {
  const testName = path.relative(path.join(__dirname, '..'), testFile);

  try {
    // Import the test runner first
    const { run, reset } = await import('./test-runner.mjs');

    // Reset the test runner state before loading new tests
    reset();

    // Import and run the test file directly in Node.js
    // The test file will set up its own browser instance and register tests
    const testModule = await import(pathToFileURL(testFile).toString());

    // The test file has now registered its tests via describe/test
    // Run them
    const results = await run();

    return {
      file: testName,
      error: null,
      results
    };
  } catch (error) {
    return {
      file: testName,
      error: error.message + '\n' + error.stack,
      results: null
    };
  }
}

// Format duration
function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// Print test results
function printResults(fileResults) {
  console.log();
  log(colors.bright + colors.cyan, '━'.repeat(80));
  log(colors.bright, '  PAN Test Results');
  log(colors.cyan, '━'.repeat(80));
  console.log();

  let totalPassed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;
  let totalFiles = 0;
  let failedFiles = 0;

  for (const fileResult of fileResults) {
    const { file, error, results } = fileResult;

    totalFiles++;

    if (error) {
      failedFiles++;
      log(colors.red, `✗ ${file}`);
      log(colors.red, `  Error: ${error}`);
      console.log();
      continue;
    }

    if (!results) {
      failedFiles++;
      log(colors.red, `✗ ${file}`);
      log(colors.red, `  No results returned`);
      console.log();
      continue;
    }

    const fileStatus = results.allPassed ? '✓' : '✗';
    const fileColor = results.allPassed ? colors.green : colors.red;

    log(fileColor, `${fileStatus} ${file} ${colors.gray}(${formatDuration(results.duration)})`);

    if (!results.allPassed) {
      failedFiles++;
    }

    // Print suite results
    for (const suite of results.suites) {
      const suiteStatus = suite.failed === 0 ? colors.green : colors.red;
      log(suiteStatus, `  ${suite.name}`);

      // Print failed tests with details
      for (const test of suite.tests) {
        if (test.status === 'failed') {
          log(colors.red, `    ✗ ${test.name}`);
          if (test.error) {
            const errorLines = (test.error.stack || test.error.message || String(test.error))
              .split('\n')
              .slice(0, 5)
              .map(line => `      ${colors.dim}${line}${colors.reset}`)
              .join('\n');
            console.log(errorLines);
          }
        } else if (test.status === 'skipped') {
          log(colors.yellow, `    ○ ${test.name} (skipped)`);
        } else {
          log(colors.dim + colors.green, `    ✓ ${test.name} ${colors.gray}(${formatDuration(test.duration)})`);
        }
      }
    }

    totalPassed += results.passedTests;
    totalFailed += results.failedTests;
    totalSkipped += results.skippedTests;

    console.log();
  }

  // Summary
  log(colors.cyan, '━'.repeat(80));

  const summaryColor = failedFiles === 0 ? colors.green : colors.red;
  const statusIcon = failedFiles === 0 ? '✓' : '✗';

  log(summaryColor + colors.bright, `  ${statusIcon} Test Summary`);
  console.log();
  log(colors.bright, `  Files:   ${totalFiles} total, ${colors.green}${totalFiles - failedFiles} passed${colors.reset}, ${colors.red}${failedFiles} failed${colors.reset}`);
  log(colors.bright, `  Tests:   ${totalPassed + totalFailed + totalSkipped} total, ${colors.green}${totalPassed} passed${colors.reset}, ${colors.red}${totalFailed} failed${colors.reset}, ${colors.yellow}${totalSkipped} skipped${colors.reset}`);

  log(colors.cyan, '━'.repeat(80));
  console.log();

  return failedFiles === 0;
}

// Main CLI runner
async function main() {
  const args = process.argv.slice(2);
  const options = {
    headless: !args.includes('--headed'),
    pattern: args.find(arg => arg.startsWith('--pattern='))?.split('=')[1],
    file: args.find(arg => !arg.startsWith('--'))
  };

  const testsDir = path.join(__dirname, '..');

  log(colors.cyan, '\nPAN Test Runner');
  log(colors.dim, `Mode: ${options.headless ? 'headless' : 'headed'}\n`);

  // Discover test files
  let testFiles;
  if (options.file) {
    const filePath = path.resolve(options.file);
    if (!fs.existsSync(filePath)) {
      log(colors.red, `Error: Test file not found: ${filePath}`);
      process.exit(1);
    }
    testFiles = [filePath];
  } else {
    testFiles = discoverTests(testsDir, options.pattern ? new RegExp(options.pattern) : undefined);
  }

  if (testFiles.length === 0) {
    log(colors.yellow, 'No test files found');
    process.exit(0);
  }

  log(colors.dim, `Found ${testFiles.length} test file(s)\n`);

  // Collect results
  const fileResults = [];

  for (const testFile of testFiles) {
    const result = await runTestFile(testFile);
    fileResults.push(result);
  }

  // Print results
  const allPassed = printResults(fileResults);

  // Exit with appropriate code
  process.exit(allPassed ? 0 : 1);
}

// Run CLI
main().catch(error => {
  log(colors.red, '\nFatal error:', error.message);
  console.error(error);
  process.exit(1);
});
