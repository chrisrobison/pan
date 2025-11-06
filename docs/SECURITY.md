# PAN Security Guide

This guide covers security best practices, threat models, and recommended configurations for using PAN in production environments.

## Table of Contents

1. [Threat Model](#threat-model)
2. [Memory Safety](#memory-safety)
3. [Message Validation](#message-validation)
4. [Content Security Policy (CSP)](#content-security-policy-csp)
5. [Wildcard Subscriptions](#wildcard-subscriptions)
6. [Rate Limiting](#rate-limiting)
7. [XSS Prevention](#xss-prevention)
8. [Component Security](#component-security)
9. [Production Checklist](#production-checklist)

---

## Threat Model

### Assumptions

PAN assumes all code running in the same JavaScript context is **trusted**. PAN provides:

- ✅ **Memory safety** - Prevents unbounded memory growth
- ✅ **Input validation** - Validates message structure and size
- ✅ **Rate limiting** - Prevents message flooding
- ✅ **Audit logging** - Tracks bus activity

PAN does **NOT** provide:

- ❌ **Code sandboxing** - All components share the same bus
- ❌ **Encryption** - Messages are plain objects in memory
- ❌ **Authentication** - No built-in access control

### Trust Boundaries

```
┌─────────────────────────────────────┐
│  Same-Origin Context (TRUSTED)      │
│  ┌────────────┐  ┌────────────┐    │
│  │  pan-bus   │  │ Component  │    │
│  └────────────┘  └────────────┘    │
│         ↕               ↕            │
│    CustomEvents (trusted)           │
└─────────────────────────────────────┘
         ↕ postMessage
┌─────────────────────────────────────┐
│  Cross-Origin iframe (UNTRUSTED)    │
│  Requires pan-gateway with          │
│  topic allowlisting                 │
└─────────────────────────────────────┘
```

---

## Memory Safety

### Problem: Unbounded Retained Messages

Without limits, retained messages can grow indefinitely:

```javascript
// BAD: Can exhaust memory
for (let i = 0; i < 1000000; i++) {
  client.publish({
    topic: `sensor.${i}`,
    data: { value: Math.random() },
    retain: true  // Each creates a new retained message!
  });
}
```

### Solution: Use Enhanced Bus with Limits

```html
<!-- Configure memory limits -->
<pan-bus-enhanced
  max-retained="1000"
  max-message-size="1048576"
  debug="true">
</pan-bus-enhanced>
```

```javascript
// Messages beyond limit are evicted (LRU)
for (let i = 0; i < 2000; i++) {
  client.publish({
    topic: `sensor.${i}`,
    data: { value: Math.random() },
    retain: true
  });
}
// Only 1000 most recent are kept
```

### Monitoring Memory Usage

```javascript
// Request bus statistics
client.publish({ topic: 'pan:sys.stats', data: {} });

client.subscribe('pan:sys.stats', (msg) => {
  console.log('Bus stats:', msg.data);
  // {
  //   published: 12543,
  //   delivered: 50172,
  //   retained: 850,
  //   retainedEvicted: 150,
  //   subscriptions: 23
  // }
});
```

---

## Message Validation

### JSON-Serializable Data Only

PAN automatically validates that message data is JSON-serializable:

```javascript
// ✅ GOOD: These work
client.publish({ topic: 'test', data: { name: 'Alice' } });
client.publish({ topic: 'test', data: [1, 2, 3] });
client.publish({ topic: 'test', data: 'string' });
client.publish({ topic: 'test', data: 42 });
client.publish({ topic: 'test', data: null });

// ❌ BAD: These will be rejected
client.publish({ topic: 'test', data: document.body });  // DOM node
client.publish({ topic: 'test', data: () => {} });       // Function
client.publish({ topic: 'test', data: new Map() });      // Not serializable

// Handle circular references
const obj = { name: 'Alice' };
obj.self = obj;  // Circular!
client.publish({ topic: 'test', data: obj });  // ❌ Rejected
```

### Error Handling

```javascript
// Listen for validation errors
client.subscribe('pan:sys.error', (msg) => {
  console.error('PAN Error:', msg.data);
  // {
  //   code: 'MESSAGE_INVALID',
  //   message: 'Circular references are not allowed',
  //   details: { topic: 'test' }
  // }
});
```

### Size Limits

```javascript
// Configure size limits
<pan-bus-enhanced
  max-message-size="1048576"    <!-- 1MB total -->
  max-payload-size="524288">    <!-- 512KB data -->
</pan-bus-enhanced>
```

```javascript
// Large messages are rejected
const hugeData = new Array(1000000).fill('x').join('');
client.publish({
  topic: 'test',
  data: { huge: hugeData }  // ❌ Rejected if > 512KB
});
```

---

## Content Security Policy (CSP)

### Recommended CSP Headers

For maximum security, use strict CSP headers:

```html
<!-- Strict CSP (recommended for production) -->
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self';
  frame-src 'none';
  object-src 'none';
  base-uri 'self';
  form-action 'self';
">
```

### CSP-Compatible PAN Usage

```html
<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
  ">
</head>
<body>
  <!-- ✅ Works with CSP -->
  <script type="module" src="/pan/core/pan-bus-enhanced.mjs"></script>
  <script type="module" src="/pan/core/pan-client.mjs"></script>

  <pan-bus-enhanced></pan-bus-enhanced>

  <script type="module">
    import { PanClient } from '/pan/core/pan-client.mjs';
    const client = new PanClient();
    // ... your code
  </script>
</body>
</html>
```

### Avoiding CSP Violations

```javascript
// ❌ BAD: Inline event handlers violate CSP
<button onclick="handleClick()">Click</button>

// ✅ GOOD: Use addEventListener
<button id="myButton">Click</button>
<script type="module">
  document.getElementById('myButton')
    .addEventListener('click', handleClick);
</script>

// ❌ BAD: eval() violates CSP
eval('alert("test")');

// ✅ GOOD: Don't use eval, use structured data
client.publish({ topic: 'action', data: { type: 'alert', msg: 'test' } });
```

---

## Wildcard Subscriptions

### Security Risk

Global wildcard subscriptions can expose sensitive data:

```javascript
// ⚠️ DANGEROUS: Sees ALL messages on the bus
client.subscribe('*', (msg) => {
  console.log('Intercepted:', msg.topic, msg.data);
  // Could capture passwords, tokens, PII, etc.
});
```

### Mitigation: Disable Global Wildcards

```html
<!-- Disable global wildcard in production -->
<pan-bus-enhanced allow-global-wildcard="false"></pan-bus-enhanced>
```

```javascript
// Now this will be rejected
client.subscribe('*', handler);
// Error: Global wildcard (*) is disabled for security
```

### Safe Wildcard Usage

```javascript
// ✅ GOOD: Scoped wildcards are fine
client.subscribe('users.*', handler);         // Only user topics
client.subscribe('app.settings.*', handler);  // Only app settings
```

### Topic Namespacing

Use topic prefixes to isolate sensitive data:

```javascript
// Public topics (okay to wildcard)
'public.news.*'
'public.weather.*'

// Private topics (no wildcards)
'private.user.session'
'private.auth.token'

// Internal topics (restricted)
'internal.admin.*'
```

---

## Rate Limiting

### Problem: Message Flooding

Without rate limiting, malicious or buggy code can flood the bus:

```javascript
// BAD: Can DoS the bus
setInterval(() => {
  for (let i = 0; i < 1000; i++) {
    client.publish({ topic: 'spam', data: i });
  }
}, 10);  // 100,000 messages per second!
```

### Solution: Per-Client Rate Limits

```html
<pan-bus-enhanced
  rate-limit="1000"
  rate-limit-window="1000">
</pan-bus-enhanced>
```

```javascript
// Client is limited to 1000 messages per second
// Excess messages are dropped and error is emitted

client.subscribe('pan:sys.error', (msg) => {
  if (msg.data.code === 'RATE_LIMIT_EXCEEDED') {
    console.warn('Rate limit hit:', msg.data.details);
  }
});
```

### Recommended Limits by Environment

```javascript
// Development
<pan-bus-enhanced rate-limit="10000"></pan-bus-enhanced>  // Permissive

// Staging
<pan-bus-enhanced rate-limit="1000"></pan-bus-enhanced>   // Moderate

// Production
<pan-bus-enhanced rate-limit="500"></pan-bus-enhanced>    // Conservative
```

---

## XSS Prevention

### Never Render Untrusted HTML

```javascript
// ❌ DANGEROUS: XSS vulnerability
client.subscribe('chat.message', (msg) => {
  document.body.innerHTML += msg.data.html;  // XSS!
});

// ✅ SAFE: Use textContent
client.subscribe('chat.message', (msg) => {
  const p = document.createElement('p');
  p.textContent = msg.data.text;  // Escaped automatically
  document.body.appendChild(p);
});
```

### Sanitize Markdown

If using `pan-markdown-renderer`, always sanitize:

```javascript
// ⚠️ Components like pan-markdown-renderer need audit
<pan-markdown-renderer sanitize="true"></pan-markdown-renderer>
```

### URL Validation

```javascript
// ❌ DANGEROUS: javascript: URLs
client.subscribe('link.clicked', (msg) => {
  window.location = msg.data.url;  // Can be "javascript:alert(1)"
});

// ✅ SAFE: Validate protocol
client.subscribe('link.clicked', (msg) => {
  const url = new URL(msg.data.url);
  if (url.protocol === 'http:' || url.protocol === 'https:') {
    window.location = url.href;
  }
});
```

---

## Component Security

### Components Requiring Audit (v1.0)

These components handle user input and need security review:

1. **pan-markdown-renderer** - XSS via malicious Markdown
2. **pan-files** - Path traversal attacks
3. **pan-form** - Input validation bypass
4. **pan-php-connector** - SQL injection (server-side)
5. **pan-graphql-connector** - Query injection

### Safe Component Usage

```javascript
// ✅ Use with caution in production
// 1. Review component source
// 2. Test with malicious input
// 3. Use in sandboxed context if possible
// 4. Monitor for suspicious activity

// Example: Sandboxed markdown renderer
<iframe sandbox="allow-same-origin" srcdoc="
  <pan-markdown-renderer></pan-markdown-renderer>
"></iframe>
```

---

## Production Checklist

### Before Deployment

- [ ] **Enable enhanced bus** with memory limits
- [ ] **Disable global wildcards** (`allow-global-wildcard="false"`)
- [ ] **Set rate limits** appropriate for your app
- [ ] **Enable debug logging** in staging, disable in prod
- [ ] **Implement error monitoring** for `pan:sys.error` events
- [ ] **Review all components** for security issues
- [ ] **Set strict CSP headers**
- [ ] **Validate all user input** before publishing
- [ ] **Use topic namespacing** for sensitive data
- [ ] **Monitor bus statistics** for anomalies

### Configuration Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Production App</title>

  <!-- Strict CSP -->
  <meta http-equiv="Content-Security-Policy" content="
    default-src 'self';
    script-src 'self';
    style-src 'self' 'unsafe-inline';
    connect-src 'self' https://api.example.com;
  ">
</head>
<body>
  <!-- Secure bus configuration -->
  <pan-bus-enhanced
    max-retained="500"
    max-message-size="524288"
    rate-limit="500"
    allow-global-wildcard="false"
    debug="false">
  </pan-bus-enhanced>

  <script type="module">
    import { PanClient } from '/pan/core/pan-client.mjs';

    const client = new PanClient();

    // Error monitoring
    client.subscribe('pan:sys.error', (msg) => {
      // Log to monitoring service
      console.error('PAN Error:', msg.data);
      sendToMonitoring(msg.data);
    });

    // Periodically check bus health
    setInterval(() => {
      client.publish({ topic: 'pan:sys.stats', data: {} });
    }, 60000);

    client.subscribe('pan:sys.stats', (msg) => {
      const { retained, subscriptions, errors } = msg.data;
      if (errors > 100) {
        console.warn('High error rate detected');
      }
      if (retained > 400) {
        console.warn('Approaching retained message limit');
      }
    });
  </script>
</body>
</html>
```

### Monitoring

```javascript
// Prometheus-style metrics
client.subscribe('pan:sys.stats', (msg) => {
  const metrics = {
    'pan_messages_published_total': msg.data.published,
    'pan_messages_delivered_total': msg.data.delivered,
    'pan_messages_dropped_total': msg.data.dropped,
    'pan_retained_messages': msg.data.retained,
    'pan_active_subscriptions': msg.data.subscriptions,
    'pan_errors_total': msg.data.errors
  };

  // Export to monitoring system
  pushMetrics(metrics);
});
```

---

## Incident Response

### Detecting Attacks

```javascript
// Detect suspicious patterns
client.subscribe('*', (msg) => {
  // Check for suspicious topics
  if (msg.topic.includes('..') || msg.topic.includes('admin')) {
    logSecurityEvent('SUSPICIOUS_TOPIC', msg);
  }

  // Check for large payloads
  if (JSON.stringify(msg.data).length > 100000) {
    logSecurityEvent('LARGE_PAYLOAD', msg);
  }

  // Check for high frequency from one source
  trackMessageRate(msg.clientId);
});
```

### Emergency Shutdown

```javascript
// Clear all retained messages
client.publish({ topic: 'pan:sys.clear-retained', data: {} });

// Or clear specific pattern
client.publish({
  topic: 'pan:sys.clear-retained',
  data: { pattern: 'compromised.*' }
});
```

---

## Additional Resources

- [API Security Best Practices](./API_SECURITY.md)
- [Component Security Audit Template](./SECURITY_AUDIT_TEMPLATE.md)
- [Penetration Testing Guide](./PENTEST_GUIDE.md)
- [CVE Disclosure Process](../SECURITY.md)

---

## Reporting Security Issues

**DO NOT** file public issues for security vulnerabilities.

Email: security@example.com (encrypted preferred)

PGP Key: [link to public key]

We aim to respond within 48 hours.
