# Migration Guide: Enhanced PAN Bus

This guide helps you migrate from the basic `pan-bus` to the security-hardened, memory-managed `pan-bus-enhanced`.

## Why Upgrade?

The enhanced bus adds critical production features:

- ✅ **Memory safety** - LRU eviction prevents unbounded growth
- ✅ **Rate limiting** - Prevents message flooding
- ✅ **Input validation** - Rejects invalid/dangerous messages
- ✅ **Security policies** - Configurable wildcard restrictions
- ✅ **Monitoring** - Built-in statistics and error reporting
- ✅ **Debug mode** - Comprehensive logging for development

## Quick Migration

### 1. Update Your HTML

**Before:**
```html
<script type="module" src="./pan/core/pan-bus.mjs"></script>
<pan-bus></pan-bus>
```

**After:**
```html
<script type="module" src="./pan/core/pan-bus-enhanced.mjs"></script>
<pan-bus-enhanced
  max-retained="1000"
  rate-limit="1000"
  debug="false">
</pan-bus-enhanced>
```

### 2. Update Component Initialization

**No code changes required!** The enhanced bus is a drop-in replacement.

```javascript
import { PanClient } from './pan/core/pan-client.mjs';

const client = new PanClient();
await client.ready();

// Everything works exactly the same
client.publish({ topic: 'test', data: { hello: 'world' } });
client.subscribe('test', (msg) => console.log(msg));
```

## Configuration Options

All configuration is via HTML attributes:

```html
<pan-bus-enhanced
  max-retained="1000"          <!-- Maximum retained messages -->
  max-message-size="1048576"   <!-- 1MB max total message -->
  max-payload-size="524288"    <!-- 512KB max data payload -->
  rate-limit="1000"            <!-- Messages per client per second -->
  cleanup-interval="30000"     <!-- Cleanup dead subs every 30s -->
  allow-global-wildcard="true" <!-- Allow '*' subscriptions -->
  debug="false">               <!-- Enable debug logging -->
</pan-bus-enhanced>
```

### Recommended Configurations

#### Development
```html
<pan-bus-enhanced
  max-retained="5000"
  rate-limit="10000"
  allow-global-wildcard="true"
  debug="true">
</pan-bus-enhanced>
```

#### Staging
```html
<pan-bus-enhanced
  max-retained="2000"
  rate-limit="1000"
  allow-global-wildcard="true"
  debug="true">
</pan-bus-enhanced>
```

#### Production
```html
<pan-bus-enhanced
  max-retained="1000"
  max-message-size="524288"
  rate-limit="500"
  allow-global-wildcard="false"
  debug="false">
</pan-bus-enhanced>
```

## Behavioral Changes

### 1. Memory Limits (Breaking for Edge Cases)

**Old Behavior:**
```javascript
// Could create unlimited retained messages
for (let i = 0; i < 1000000; i++) {
  client.publish({ topic: `msg.${i}`, data: {}, retain: true });
}
// All 1M messages stored in memory
```

**New Behavior:**
```javascript
// LRU eviction after reaching limit
for (let i = 0; i < 1000000; i++) {
  client.publish({ topic: `msg.${i}`, data: {}, retain: true });
}
// Only last 1000 (or configured limit) retained
```

**Migration:** If you need more than 1000 retained topics, increase `max-retained`.

### 2. Rate Limiting (Breaking for High-Throughput)

**Old Behavior:**
```javascript
// No limits
for (let i = 0; i < 100000; i++) {
  client.publish({ topic: 'test', data: { i } });
}
// All messages accepted
```

**New Behavior:**
```javascript
// Rate limited per client
for (let i = 0; i < 100000; i++) {
  client.publish({ topic: 'test', data: { i } });
}
// Only first 1000 (or limit) accepted per second
// Excess dropped with error event
```

**Migration:** Increase `rate-limit` if needed, or batch operations:

```javascript
// Instead of individual messages
for (let item of items) {
  client.publish({ topic: 'item', data: item });
}

// Batch them
client.publish({
  topic: 'items.batch',
  data: { items: items }
});
```

### 3. Message Validation (Breaking for Invalid Data)

**Old Behavior:**
```javascript
// Accepted (but would fail later)
client.publish({
  topic: 'test',
  data: { fn: () => {} }  // Function
});
```

**New Behavior:**
```javascript
// Rejected immediately with error event
client.publish({
  topic: 'test',
  data: { fn: () => {} }
});
// Error: Functions cannot be serialized
```

**Migration:** Ensure all published data is JSON-serializable:

```javascript
// ❌ Bad
client.publish({ topic: 'test', data: { el: document.body } });
client.publish({ topic: 'test', data: { fn: () => {} } });

// ✅ Good
client.publish({ topic: 'test', data: { id: 'body' } });
client.publish({ topic: 'test', data: { action: 'click' } });
```

### 4. Wildcard Security (Breaking if Disabled)

**Old Behavior:**
```javascript
// Always allowed
client.subscribe('*', handler);
```

**New Behavior (if allow-global-wildcard="false"):**
```javascript
// Rejected with error
client.subscribe('*', handler);
// Error: Global wildcard (*) is disabled for security
```

**Migration:** Use scoped wildcards:

```javascript
// ❌ If global wildcard disabled
client.subscribe('*', handler);

// ✅ Use scoped patterns
client.subscribe('users.*', handler);
client.subscribe('app.settings.*', handler);
```

## Error Handling

The enhanced bus emits detailed error events:

```javascript
client.subscribe('pan:sys.error', (msg) => {
  console.error('PAN Error:', msg.data);

  switch (msg.data.code) {
    case 'RATE_LIMIT_EXCEEDED':
      console.warn('Slow down publishing');
      break;

    case 'MESSAGE_INVALID':
      console.error('Invalid message:', msg.data.details);
      break;

    case 'SUBSCRIPTION_INVALID':
      console.error('Invalid subscription:', msg.data.details);
      break;
  }
});
```

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `RATE_LIMIT_EXCEEDED` | Too many messages | Slow down or increase limit |
| `MESSAGE_INVALID` | Invalid message structure | Fix message data |
| `SUBSCRIPTION_INVALID` | Invalid topic pattern | Use valid pattern |

## Monitoring

Access bus statistics for monitoring:

```javascript
// Request stats
client.publish({ topic: 'pan:sys.stats', data: {} });

// Handle stats
client.subscribe('pan:sys.stats', (msg) => {
  const {
    published,      // Total messages published
    delivered,      // Total deliveries made
    dropped,        // Messages dropped (rate limit)
    retained,       // Current retained count
    retainedEvicted, // Total evicted
    subscriptions,  // Active subscriptions
    clients,        // Registered clients
    errors          // Total errors
  } = msg.data;

  // Send to monitoring system
  sendMetrics(msg.data);
});
```

### Recommended Monitoring

```javascript
// Poll stats every minute
setInterval(() => {
  client.publish({ topic: 'pan:sys.stats', data: {} });
}, 60000);

// Alert on anomalies
client.subscribe('pan:sys.stats', (msg) => {
  if (msg.data.errors > 100) {
    alert('High error rate detected!');
  }

  if (msg.data.dropped > 1000) {
    alert('Many messages being dropped!');
  }

  if (msg.data.retained > msg.data.config.maxRetained * 0.9) {
    alert('Approaching retained message limit!');
  }
});
```

## Testing Your Migration

### 1. Unit Tests

```javascript
describe('PAN Enhanced Migration', () => {
  let client;

  beforeEach(async () => {
    document.body.innerHTML = `
      <pan-bus-enhanced
        max-retained="10"
        rate-limit="50">
      </pan-bus-enhanced>
    `;

    client = new PanClient();
    await client.ready();
  });

  it('should enforce retained limit', async () => {
    // Publish more than limit
    for (let i = 0; i < 20; i++) {
      client.publish({
        topic: `test.${i}`,
        data: { i },
        retain: true
      });
    }

    // Check stats
    const stats = await client.request('pan:sys.stats', {});
    expect(stats.data.retained).toBe(10);
    expect(stats.data.retainedEvicted).toBe(10);
  });

  it('should reject invalid data', (done) => {
    client.subscribe('pan:sys.error', (msg) => {
      expect(msg.data.code).toBe('MESSAGE_INVALID');
      done();
    });

    // Try to publish function
    client.publish({
      topic: 'test',
      data: { fn: () => {} }
    });
  });
});
```

### 2. Load Testing

```javascript
async function loadTest() {
  const client = new PanClient();
  await client.ready();

  let dropped = 0;

  client.subscribe('pan:sys.error', (msg) => {
    if (msg.data.code === 'RATE_LIMIT_EXCEEDED') {
      dropped++;
    }
  });

  // Blast messages
  const start = Date.now();
  for (let i = 0; i < 10000; i++) {
    client.publish({ topic: 'load-test', data: { i } });
  }
  const duration = Date.now() - start;

  // Get stats
  client.publish({ topic: 'pan:sys.stats', data: {} });

  client.subscribe('pan:sys.stats', (msg) => {
    console.log('Load test results:', {
      duration,
      published: msg.data.published,
      dropped: msg.data.dropped,
      throughput: (msg.data.published / duration) * 1000
    });
  });
}
```

### 3. Memory Testing

```javascript
async function memoryTest() {
  const client = new PanClient();
  await client.ready();

  // Measure initial memory
  const before = performance.memory?.usedJSHeapSize;

  // Create lots of retained messages
  for (let i = 0; i < 100000; i++) {
    client.publish({
      topic: `test.${i}`,
      data: { value: Math.random() },
      retain: true
    });
  }

  // Check retained count (should be limited)
  client.publish({ topic: 'pan:sys.stats', data: {} });

  client.subscribe('pan:sys.stats', (msg) => {
    const after = performance.memory?.usedJSHeapSize;

    console.log('Memory test:', {
      retainedCount: msg.data.retained,
      configLimit: msg.data.config.maxRetained,
      memoryGrowth: (after - before) / 1024 / 1024 + ' MB'
    });

    // Should not grow unbounded
    expect(msg.data.retained).toBe(msg.data.config.maxRetained);
  });
}
```

## Rollback Plan

If you encounter issues:

### 1. Quick Rollback

```html
<!-- Change enhanced back to basic -->
<script type="module" src="./pan/core/pan-bus.mjs"></script>
<pan-bus></pan-bus>
```

### 2. Gradual Migration

Use both buses temporarily:

```html
<!-- Keep basic bus for critical components -->
<pan-bus id="legacy"></pan-bus>

<!-- Add enhanced bus for new features -->
<pan-bus-enhanced id="enhanced"></pan-bus-enhanced>

<script type="module">
  // Legacy code uses basic bus
  const legacyClient = new PanClient(document, '#legacy');

  // New code uses enhanced bus
  const enhancedClient = new PanClient(document, '#enhanced');
</script>
```

## Common Issues

### Issue: Messages Being Dropped

**Symptom:**
```
Error: RATE_LIMIT_EXCEEDED
```

**Solutions:**
1. Increase rate limit: `rate-limit="2000"`
2. Batch messages instead of sending individually
3. Debounce rapid updates

### Issue: Retained Messages Evicted

**Symptom:**
```
Stats show retainedEvicted > 0
```

**Solutions:**
1. Increase retained limit: `max-retained="2000"`
2. Use fewer unique retained topics
3. Clear old topics: `client.publish({ topic: 'pan:sys.clear-retained', data: { pattern: 'old.*' } })`

### Issue: Global Wildcard Rejected

**Symptom:**
```
Error: Global wildcard (*) is disabled for security
```

**Solutions:**
1. Enable in config: `allow-global-wildcard="true"`
2. Use scoped wildcards: `'users.*'` instead of `'*'`

## Support

For migration issues:

- 📖 [Security Guide](./SECURITY.md)
- 📖 [API Reference](./API_REFERENCE.md)
- 🐛 [GitHub Issues](https://github.com/youruser/pan/issues)
- 💬 [Discussions](https://github.com/youruser/pan/discussions)

## Checklist

Before deploying to production:

- [ ] Updated HTML to use `pan-bus-enhanced`
- [ ] Configured appropriate limits for your app
- [ ] Added error monitoring for `pan:sys.error`
- [ ] Added stats monitoring
- [ ] Tested with production-like load
- [ ] Verified memory doesn't grow unbounded
- [ ] Reviewed security settings
- [ ] Updated documentation for your team
- [ ] Tested rollback procedure
- [ ] Set up monitoring dashboards
