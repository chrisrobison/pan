/**
 * PAN Performance Benchmarks
 * Measures key performance metrics for v1.0 release
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl } from '../lib/test-utils.mjs';

// Performance thresholds
const THRESHOLDS = {
  MESSAGE_THROUGHPUT: 10000, // messages per second
  SUBSCRIBE_SPEED: 1000,      // operations per second
  RETAINED_RETRIEVAL: 500,    // messages per second
  MEMORY_LEAK_MAX: 50,        // MB increase after cleanup
};

describe('Performance Benchmarks', () => {
  let browser, page, cdpSession;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    page = await context.newPage();

    // Enable Chrome DevTools Protocol for memory profiling
    cdpSession = await context.newCDPSession(page);
    await cdpSession.send('HeapProfiler.enable');
  });

  afterAll(async () => {
    if (cdpSession) {
      await cdpSession.send('HeapProfiler.disable');
    }
    if (browser) {
      await browser.close();
    }
  });

  async function getMemoryUsage() {
    const metrics = await cdpSession.send('Performance.getMetrics');
    const jsHeapUsed = metrics.metrics.find(m => m.name === 'JSHeapUsedSize');
    return jsHeapUsed ? jsHeapUsed.value / 1024 / 1024 : 0; // Convert to MB
  }

  async function forceGC() {
    try {
      await page.evaluate(() => {
        if (globalThis.gc) {
          globalThis.gc();
        }
      });
    } catch (e) {
      // GC not available
    }
  }

  test('[Benchmark] Message Throughput - 10,000 messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const MESSAGE_COUNT = 10000;
      let receivedCount = 0;

      // Subscribe
      client.subscribe('perf.test', (msg) => {
        receivedCount++;
      });

      // Small delay to ensure subscription is registered
      await new Promise(resolve => setTimeout(resolve, 50));

      // Measure publish + delivery time
      const startTime = performance.now();

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        client.publish({
          topic: 'perf.test',
          data: { index: i, payload: 'x'.repeat(100) }
        });
      }

      // Wait for all messages to be delivered
      const pollStart = Date.now();
      while (receivedCount < MESSAGE_COUNT && Date.now() - pollStart < 5000) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const elapsed = endTime - startTime;

      return {
        messageCount: MESSAGE_COUNT,
        receivedCount,
        elapsedMs: elapsed,
        messagesPerSecond: Math.round((MESSAGE_COUNT / elapsed) * 1000),
        avgLatencyMs: elapsed / MESSAGE_COUNT
      };
    });

    console.log('\n[Benchmark] Message Throughput:');
    console.log(`  Messages: ${result.messageCount}`);
    console.log(`  Received: ${result.receivedCount}`);
    console.log(`  Elapsed: ${result.elapsedMs.toFixed(2)}ms`);
    console.log(`  Throughput: ${result.messagesPerSecond.toLocaleString()} msg/sec`);
    console.log(`  Avg Latency: ${result.avgLatencyMs.toFixed(4)}ms`);

    expect(result.receivedCount).toBe(result.messageCount);
    expect(result.messagesPerSecond).toBeGreaterThan(THRESHOLDS.MESSAGE_THROUGHPUT);
  });

  test('[Benchmark] Subscribe/Unsubscribe Speed - 1,000 operations', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const OPERATION_COUNT = 1000;

      // Measure subscribe time
      const subscribeStart = performance.now();
      const unsubscribers = [];

      for (let i = 0; i < OPERATION_COUNT; i++) {
        const unsub = client.subscribe(`test.topic.${i}`, (msg) => {});
        unsubscribers.push(unsub);
      }

      const subscribeEnd = performance.now();
      const subscribeTime = subscribeEnd - subscribeStart;

      // Measure unsubscribe time
      const unsubscribeStart = performance.now();

      for (const unsub of unsubscribers) {
        unsub();
      }

      const unsubscribeEnd = performance.now();
      const unsubscribeTime = unsubscribeEnd - unsubscribeStart;

      return {
        operationCount: OPERATION_COUNT,
        subscribeTimeMs: subscribeTime,
        subscribeOpsPerSec: Math.round((OPERATION_COUNT / subscribeTime) * 1000),
        avgSubscribeMs: subscribeTime / OPERATION_COUNT,
        unsubscribeTimeMs: unsubscribeTime,
        unsubscribeOpsPerSec: Math.round((OPERATION_COUNT / unsubscribeTime) * 1000),
        avgUnsubscribeMs: unsubscribeTime / OPERATION_COUNT
      };
    });

    console.log('\n[Benchmark] Subscribe/Unsubscribe Speed:');
    console.log(`  Operations: ${result.operationCount}`);
    console.log(`  Subscribe: ${result.subscribeTimeMs.toFixed(2)}ms (${result.subscribeOpsPerSec.toLocaleString()} ops/sec)`);
    console.log(`  Avg Subscribe: ${result.avgSubscribeMs.toFixed(4)}ms`);
    console.log(`  Unsubscribe: ${result.unsubscribeTimeMs.toFixed(2)}ms (${result.unsubscribeOpsPerSec.toLocaleString()} ops/sec)`);
    console.log(`  Avg Unsubscribe: ${result.avgUnsubscribeMs.toFixed(4)}ms`);

    expect(result.subscribeOpsPerSec).toBeGreaterThan(THRESHOLDS.SUBSCRIBE_SPEED);
    expect(result.unsubscribeOpsPerSec).toBeGreaterThan(THRESHOLDS.SUBSCRIBE_SPEED);
  });

  test('[Benchmark] Retained Message Retrieval - 1,000 messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const MESSAGE_COUNT = 1000;

      // Publish retained messages
      const publishStart = performance.now();

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        client.publish({
          topic: `retained.topic.${i}`,
          data: { value: i },
          retain: true
        });
      }

      const publishEnd = performance.now();

      // Wait for messages to be stored
      await new Promise(resolve => setTimeout(resolve, 50));

      // Measure retrieval time (subscribe with retained option)
      let receivedCount = 0;
      const retrievalStart = performance.now();

      const promises = [];
      for (let i = 0; i < MESSAGE_COUNT; i++) {
        promises.push(new Promise((resolve) => {
          client.subscribe(`retained.topic.${i}`, (msg) => {
            receivedCount++;
            resolve();
          }, { retained: true });
        }));
      }

      await Promise.all(promises);
      const retrievalEnd = performance.now();

      const publishTime = publishEnd - publishStart;
      const retrievalTime = retrievalEnd - retrievalStart;

      return {
        messageCount: MESSAGE_COUNT,
        receivedCount,
        publishTimeMs: publishTime,
        publishRate: Math.round((MESSAGE_COUNT / publishTime) * 1000),
        retrievalTimeMs: retrievalTime,
        retrievalRate: Math.round((MESSAGE_COUNT / retrievalTime) * 1000),
        avgRetrievalMs: retrievalTime / MESSAGE_COUNT
      };
    });

    console.log('\n[Benchmark] Retained Message Retrieval:');
    console.log(`  Messages: ${result.messageCount}`);
    console.log(`  Retrieved: ${result.receivedCount}`);
    console.log(`  Publish Time: ${result.publishTimeMs.toFixed(2)}ms (${result.publishRate.toLocaleString()} msg/sec)`);
    console.log(`  Retrieval Time: ${result.retrievalTimeMs.toFixed(2)}ms (${result.retrievalRate.toLocaleString()} msg/sec)`);
    console.log(`  Avg Retrieval: ${result.avgRetrievalMs.toFixed(4)}ms`);

    expect(result.receivedCount).toBe(result.messageCount);
    expect(result.retrievalRate).toBeGreaterThan(THRESHOLDS.RETAINED_RETRIEVAL);
  });

  test('[Benchmark] Wildcard Subscription Performance - 10,000 messages', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const MESSAGE_COUNT = 10000;
      let receivedCount = 0;

      // Subscribe with wildcard (match single segment after users.)
      client.subscribe('users.*', (msg) => {
        receivedCount++;
      });

      // Wait longer for subscription to be registered
      await new Promise(resolve => setTimeout(resolve, 200));

      // Publish to various matching topics (single segment wildcards)
      const startTime = performance.now();

      for (let i = 0; i < MESSAGE_COUNT; i++) {
        const topic = `users.action${i % 10}`;
        client.publish({
          topic,
          data: { index: i }
        });
      }

      // Wait for delivery
      const pollStart = Date.now();
      while (receivedCount < MESSAGE_COUNT && Date.now() - pollStart < 5000) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const endTime = performance.now();
      const elapsed = endTime - startTime;

      return {
        messageCount: MESSAGE_COUNT,
        receivedCount,
        elapsedMs: elapsed,
        messagesPerSecond: Math.round((MESSAGE_COUNT / elapsed) * 1000)
      };
    });

    console.log('\n[Benchmark] Wildcard Subscription:');
    console.log(`  Messages: ${result.messageCount}`);
    console.log(`  Received: ${result.receivedCount}`);
    console.log(`  Elapsed: ${result.elapsedMs.toFixed(2)}ms`);
    console.log(`  Throughput: ${result.messagesPerSecond.toLocaleString()} msg/sec`);

    expect(result.receivedCount).toBe(result.messageCount);
    expect(result.messagesPerSecond).toBeGreaterThan(5000); // Lower threshold for wildcards
  });

  test('[Benchmark] Request/Reply Performance - 1,000 requests', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const REQUEST_COUNT = 1000;

      // Set up responder
      client.subscribe('bench.request', (msg) => {
        if (msg.replyTo) {
          client.publish({
            topic: msg.replyTo,
            data: { result: msg.data.value * 2 },
            correlationId: msg.correlationId
          });
        }
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      // Measure sequential requests
      const sequentialStart = performance.now();

      for (let i = 0; i < REQUEST_COUNT; i++) {
        await client.request('bench.request', { value: i }, { timeoutMs: 2000 });
      }

      const sequentialEnd = performance.now();
      const sequentialTime = sequentialEnd - sequentialStart;

      // Measure parallel requests (batches of 100)
      const parallelStart = performance.now();
      const batchSize = 100;
      const batches = REQUEST_COUNT / batchSize;

      for (let b = 0; b < batches; b++) {
        const promises = [];
        for (let i = 0; i < batchSize; i++) {
          promises.push(client.request('bench.request', { value: i }, { timeoutMs: 2000 }));
        }
        await Promise.all(promises);
      }

      const parallelEnd = performance.now();
      const parallelTime = parallelEnd - parallelStart;

      return {
        requestCount: REQUEST_COUNT,
        sequentialTimeMs: sequentialTime,
        sequentialRate: Math.round((REQUEST_COUNT / sequentialTime) * 1000),
        avgSequentialMs: sequentialTime / REQUEST_COUNT,
        parallelTimeMs: parallelTime,
        parallelRate: Math.round((REQUEST_COUNT / parallelTime) * 1000),
        avgParallelMs: parallelTime / REQUEST_COUNT,
        speedup: (sequentialTime / parallelTime).toFixed(2)
      };
    });

    console.log('\n[Benchmark] Request/Reply Performance:');
    console.log(`  Requests: ${result.requestCount}`);
    console.log(`  Sequential: ${result.sequentialTimeMs.toFixed(2)}ms (${result.sequentialRate.toLocaleString()} req/sec)`);
    console.log(`  Avg Sequential: ${result.avgSequentialMs.toFixed(4)}ms`);
    console.log(`  Parallel: ${result.parallelTimeMs.toFixed(2)}ms (${result.parallelRate.toLocaleString()} req/sec)`);
    console.log(`  Avg Parallel: ${result.avgParallelMs.toFixed(4)}ms`);
    console.log(`  Speedup: ${result.speedup}x`);

    expect(result.parallelRate).toBeGreaterThan(result.sequentialRate);
  });

  test('[Benchmark] Memory Usage - 30 seconds continuous operation', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    // Force GC before starting
    await forceGC();
    await new Promise(resolve => setTimeout(resolve, 100));

    const startMemory = await getMemoryUsage();

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const DURATION_MS = 30000;
      const samples = [];
      let messagesSent = 0;
      let messagesReceived = 0;

      // Set up subscriber
      client.subscribe('memory.test', (msg) => {
        messagesReceived++;
      });

      // Continuous publishing
      const startTime = Date.now();
      let lastSampleTime = startTime;

      while (Date.now() - startTime < DURATION_MS) {
        // Publish batch
        for (let i = 0; i < 100; i++) {
          client.publish({
            topic: 'memory.test',
            data: { timestamp: Date.now(), payload: 'x'.repeat(100) }
          });
          messagesSent++;
        }

        // Sample every second
        const now = Date.now();
        if (now - lastSampleTime >= 1000) {
          samples.push({
            elapsed: now - startTime,
            sent: messagesSent,
            received: messagesReceived
          });
          lastSampleTime = now;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
      }

      return {
        duration: DURATION_MS,
        messagesSent,
        messagesReceived,
        avgRate: Math.round((messagesSent / DURATION_MS) * 1000),
        samples
      };
    });

    // Force GC after test
    await forceGC();
    await new Promise(resolve => setTimeout(resolve, 100));

    const endMemory = await getMemoryUsage();
    const memoryIncrease = endMemory - startMemory;

    console.log('\n[Benchmark] Memory Usage (30 seconds):');
    console.log(`  Duration: ${result.duration / 1000}s`);
    console.log(`  Messages Sent: ${result.messagesSent.toLocaleString()}`);
    console.log(`  Messages Received: ${result.messagesReceived.toLocaleString()}`);
    console.log(`  Avg Rate: ${result.avgRate.toLocaleString()} msg/sec`);
    console.log(`  Start Memory: ${startMemory.toFixed(2)} MB`);
    console.log(`  End Memory: ${endMemory.toFixed(2)} MB`);
    console.log(`  Memory Increase: ${memoryIncrease.toFixed(2)} MB`);

    expect(result.messagesReceived).toBe(result.messagesSent);
    expect(memoryIncrease).toBeLessThan(THRESHOLDS.MEMORY_LEAK_MAX);
  });

  test('[Benchmark] Large Dataset - 10,000 item list state', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    const result = await page.evaluate(async () => {
      const { PanClient } = await import('../src/core/pan-client.mjs');

      const client = new PanClient();
      await client.ready();

      const ITEM_COUNT = 10000;

      // Generate large dataset
      const items = [];
      for (let i = 0; i < ITEM_COUNT; i++) {
        items.push({
          id: i,
          name: `Item ${i}`,
          value: Math.random() * 1000,
          description: 'Lorem ipsum dolor sit amet'.repeat(5),
          tags: ['tag1', 'tag2', 'tag3'],
          metadata: {
            created: Date.now(),
            updated: Date.now(),
            version: 1
          }
        });
      }

      // Measure publish time
      const publishStart = performance.now();

      client.publish({
        topic: 'items.list.state',
        data: { items },
        retain: true
      });

      const publishEnd = performance.now();

      // Measure retrieval time
      const retrievalStart = performance.now();

      const retrieved = await new Promise((resolve) => {
        client.subscribe('items.list.state', (msg) => {
          resolve(msg.data.items);
        }, { retained: true });
      });

      const retrievalEnd = performance.now();

      const dataSize = JSON.stringify(items).length / 1024 / 1024; // MB

      return {
        itemCount: ITEM_COUNT,
        dataSizeMB: dataSize,
        publishTimeMs: publishEnd - publishStart,
        retrievalTimeMs: retrievalEnd - retrievalStart,
        retrievedCount: retrieved.length,
        throughputMBps: dataSize / ((publishEnd - publishStart) / 1000)
      };
    });

    console.log('\n[Benchmark] Large Dataset:');
    console.log(`  Items: ${result.itemCount.toLocaleString()}`);
    console.log(`  Data Size: ${result.dataSizeMB.toFixed(2)} MB`);
    console.log(`  Publish Time: ${result.publishTimeMs.toFixed(2)}ms`);
    console.log(`  Retrieval Time: ${result.retrievalTimeMs.toFixed(2)}ms`);
    console.log(`  Retrieved: ${result.retrievedCount.toLocaleString()} items`);
    console.log(`  Throughput: ${result.throughputMBps.toFixed(2)} MB/sec`);

    expect(result.retrievedCount).toBe(result.itemCount);
    expect(result.publishTimeMs).toBeLessThan(1000); // < 1 second
    expect(result.retrievalTimeMs).toBeLessThan(100); // < 100ms
  });
});
