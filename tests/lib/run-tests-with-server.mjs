#!/usr/bin/env node

/**
 * Test runner that starts HTTP server, runs tests, then stops server
 * Usage: node tests/lib/run-tests-with-server.mjs [test-file-pattern]
 */

import { spawn } from 'child_process';
import { createTestServer, stopTestServer } from './test-server.mjs';

const TEST_SERVER_PORT = 3000;
const TEST_SERVER_URL = `http://localhost:${TEST_SERVER_PORT}`;

/**
 * Wait for server to be ready
 */
async function waitForServer(url, maxAttempts = 10) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${url}/package.json`);
      if (response.ok) {
        return true;
      }
    } catch (err) {
      // Server not ready yet
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error('Server failed to start');
}

/**
 * Run tests with given arguments
 */
function runTests(args) {
  return new Promise((resolve, reject) => {
    const testProcess = spawn('node', ['tests/lib/cli-runner.mjs', ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        TEST_SERVER_URL,
        TEST_SERVER_PORT: String(TEST_SERVER_PORT),
      },
    });

    testProcess.on('close', (code) => {
      resolve(code);
    });

    testProcess.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Main execution
 */
async function main() {
  let server = null;
  let exitCode = 0;

  try {
    // Start server
    console.log('Starting test server...');
    server = await createTestServer(TEST_SERVER_PORT);

    // Wait for server to be ready
    console.log('Waiting for server to be ready...');
    await waitForServer(TEST_SERVER_URL);
    console.log('Server ready!\n');

    // Run tests with any command-line arguments passed to this script
    const testArgs = process.argv.slice(2);
    exitCode = await runTests(testArgs);

  } catch (err) {
    console.error('Error running tests:', err);
    exitCode = 1;
  } finally {
    // Stop server
    if (server) {
      console.log('\nStopping test server...');
      await stopTestServer(server);
    }
    process.exit(exitCode);
  }
}

main();
