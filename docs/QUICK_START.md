# PAN Quick Start Guide

Get started with PAN (Page Area Network) in 5 minutes.

---

## What is PAN?

PAN is a **DOM-native message bus** for building loosely-coupled web applications. Components communicate via topics instead of direct imports, making your code more modular and testable.

**Key Features:**
- ✅ **Zero build** - Works directly in the browser
- ✅ **Framework agnostic** - Works with vanilla JS, React, Vue, etc.
- ✅ **Shadow DOM ready** - Events cross shadow boundaries
- ✅ **Request/reply** - Built-in async request-response pattern
- ✅ **Retained messages** - Late joiners get current state
- ✅ **Wildcard subscriptions** - Subscribe to topic patterns

---

## Installation

### Option 1: Local Files (Recommended for Development)

```html
<!DOCTYPE html>
<html>
<head>
  <title>My PAN App</title>
</head>
<body>
  <!-- 1. Add the bus element -->
  <pan-bus></pan-bus>

  <!-- 2. Include autoloader -->
  <script type="module" src="./pan/core/pan-autoload.mjs"></script>

  <!-- 3. Your app code -->
  <script type="module">
    import { PanClient } from './pan/core/pan-client.mjs';

    const client = new PanClient();
    await client.ready();

    // Start using PAN!
    client.publish({
      topic: 'app.started',
      data: { timestamp: Date.now() }
    });
  </script>
</body>
</html>
```

### Option 2: CDN (Coming Soon)

```html
<pan-bus></pan-bus>
<script type="module" src="https://unpkg.com/@larc/pan-bus@1.0.0"></script>
<script type="module">
  import { PanClient } from 'https://unpkg.com/@larc/pan-client@1.0.0';
  // ...
</script>
```

---

## Your First PAN App

Let's build a simple counter that shows PAN's core concepts.

### Step 1: Create HTML

```html
<!DOCTYPE html>
<html>
<head>
  <title>Counter App</title>
</head>
<body>
  <pan-bus></pan-bus>

  <div id="app">
    <h1>Counter: <span id="count">0</span></h1>
    <button id="increment">+1</button>
    <button id="decrement">-1</button>
    <button id="reset">Reset</button>
  </div>

  <script type="module" src="./pan/core/pan-autoload.mjs"></script>
  <script type="module" src="./app.js"></script>
</body>
</html>
```

### Step 2: Create app.js

```javascript
import { PanClient } from './pan/core/pan-client.mjs';

// Create client and wait for bus
const client = new PanClient();
await client.ready();

// Current count
let count = 0;

// Publish count state
function publishCount() {
  client.publish({
    topic: 'counter.state',
    data: { count },
    retain: true  // Late subscribers get current value
  });
}

// Button handlers
document.getElementById('increment').addEventListener('click', () => {
  count++;
  publishCount();
});

document.getElementById('decrement').addEventListener('click', () => {
  count--;
  publishCount();
});

document.getElementById('reset').addEventListener('click', () => {
  count = 0;
  publishCount();
});

// Subscribe to count changes
client.subscribe('counter.state', (msg) => {
  document.getElementById('count').textContent = msg.data.count;
}, { retained: true });  // Get current count immediately

// Publish initial state
publishCount();
```

### Step 3: Run It

Open `index.html` in a browser. Click buttons to see the counter update!

**What's happening:**
1. Buttons publish counter state when clicked
2. UI subscribes to counter state and updates
3. `retain: true` means new subscribers get the current count
4. Components are decoupled - they only know about topics

---

## Core Concepts

### 1. Publish Messages

```javascript
client.publish({
  topic: 'users.updated',
  data: { id: 123, name: 'Alice' }
});
```

### 2. Subscribe to Topics

```javascript
client.subscribe('users.updated', (msg) => {
  console.log('User updated:', msg.data);
});
```

### 3. Wildcard Subscriptions

```javascript
// Match all user-related topics
client.subscribe('users.*', (msg) => {
  console.log('User event:', msg.topic);
});
```

### 4. Request/Reply

```javascript
// Make a request
const response = await client.request('users.get', { id: 123 });
console.log('User:', response.data);

// Respond to requests
client.subscribe('users.get', (msg) => {
  if (!msg.replyTo) return;

  const user = getUserFromDatabase(msg.data.id);

  client.publish({
    topic: msg.replyTo,
    data: { ok: true, user },
    correlationId: msg.correlationId
  });
});
```

### 5. Retained Messages

```javascript
// Publish retained state
client.publish({
  topic: 'app.theme',
  data: { mode: 'dark' },
  retain: true
});

// New subscribers get current value
client.subscribe('app.theme', (msg) => {
  applyTheme(msg.data.mode);
}, { retained: true });
```

---

## Common Patterns

### Pattern 1: State Management

```javascript
// Publish state
client.publish({
  topic: 'users.list.state',
  data: { users: [user1, user2, user3] },
  retain: true
});

// Subscribe to state
client.subscribe('users.list.state', (msg) => {
  renderUserList(msg.data.users);
}, { retained: true });
```

### Pattern 2: CRUD Operations

```javascript
// Create
const response = await client.request('users.item.save', {
  item: { name: 'Alice', email: 'alice@example.com' }
});

// Read
const user = await client.request('users.item.get', { id: 123 });

// Update
await client.request('users.item.save', {
  item: { id: 123, name: 'Alice Updated' }
});

// Delete
await client.request('users.item.delete', { id: 123 });
```

### Pattern 3: Events

```javascript
// Publish event
client.publish({
  topic: 'users.item.created',
  data: { item: newUser }
});

// Multiple subscribers
client.subscribe('users.item.created', (msg) => {
  console.log('User created:', msg.data.item);
});

client.subscribe('users.item.created', (msg) => {
  sendWelcomeEmail(msg.data.item);
});
```

### Pattern 4: Commands

```javascript
// Publish command
client.publish({
  topic: 'nav.goto',
  data: { route: '/users/123' }
});

// Handle command
client.subscribe('nav.goto', (msg) => {
  router.navigateTo(msg.data.route);
});
```

---

## Web Components Example

Here's how to use PAN with Web Components:

```javascript
class UserCard extends HTMLElement {
  connectedCallback() {
    this.client = new PanClient(this);

    // Subscribe to user data
    const userId = this.getAttribute('user-id');
    this.unsub = this.client.subscribe(`users.item.state.${userId}`, (msg) => {
      this.render(msg.data);
    }, { retained: true });

    // Request initial data
    this.loadUser(userId);
  }

  disconnectedCallback() {
    // Clean up subscription
    if (this.unsub) this.unsub();
  }

  async loadUser(userId) {
    const response = await this.client.request('users.item.get', { id: userId });
    if (response.data.ok) {
      this.render(response.data.item);
    }
  }

  render(user) {
    this.innerHTML = `
      <div class="user-card">
        <h3>${user.name}</h3>
        <p>${user.email}</p>
      </div>
    `;
  }
}

customElements.define('user-card', UserCard);
```

Usage:

```html
<user-card user-id="123"></user-card>
```

---

## Best Practices

### ✅ DO

**Wait for ready:**
```javascript
const client = new PanClient();
await client.ready();
// Now safe to publish
```

**Use retained for state:**
```javascript
client.publish({
  topic: 'app.state',
  data: { ... },
  retain: true
});
```

**Clean up subscriptions:**
```javascript
const unsub = client.subscribe('topic', handler);
// Later:
unsub();
```

**Use specific topics:**
```javascript
client.subscribe('users.updated', handler);  // Good
```

### ❌ DON'T

**Don't publish before ready:**
```javascript
const client = new PanClient();
client.publish({ ... });  // May be lost!
```

**Don't subscribe to everything:**
```javascript
client.subscribe('*', handler);  // Too broad!
```

**Don't forget to unsubscribe:**
```javascript
// Memory leak!
client.subscribe('topic', handler);
// Component removed but subscription remains
```

---

## Next Steps

### Learn More

- **[API Reference](./API_REFERENCE.md)** - Complete API documentation
- **[Topic Conventions](./TOPICS.md)** - Topic naming patterns
- **[Examples](../examples/)** - Working examples
- **[API Stability](./API_STABILITY.md)** - Version guarantees

### Build Something

Try building these to practice:

1. **Todo List** - CRUD operations + state management
2. **Chat App** - Real-time updates + retained messages
3. **Dashboard** - Multiple components + request/reply
4. **Form Wizard** - Multi-step process + events

### Get Help

- **Issues**: [GitHub Issues](https://github.com/chrisrobison/pan/issues)
- **Examples**: See `examples/` directory
- **Tests**: See `tests/` directory for usage patterns

---

## Troubleshooting

### Messages not received

**Problem:** Published messages aren't being received

**Solutions:**
```javascript
// 1. Wait for bus to be ready
await client.ready();

// 2. Check topic names match exactly
client.publish({ topic: 'users.updated', data: {} });
client.subscribe('users.updated', handler);  // Must match

// 3. Use wildcard for debugging
client.subscribe('*', (msg) => {
  console.log('All messages:', msg.topic);
});
```

### Subscriptions not cleaning up

**Problem:** Memory leaks from subscriptions

**Solution:**
```javascript
// Store unsubscribe function
this.unsubs = [];

// Add subscriptions
this.unsubs.push(client.subscribe('topic1', handler1));
this.unsubs.push(client.subscribe('topic2', handler2));

// Clean up all
disconnectedCallback() {
  this.unsubs.forEach(unsub => unsub());
}

// OR use AbortSignal
const controller = new AbortController();
client.subscribe('topic', handler, { signal: controller.signal });
controller.abort();  // Unsubscribe all
```

### Request timeouts

**Problem:** Requests timing out

**Solutions:**
```javascript
// 1. Increase timeout
const response = await client.request('topic', data, {
  timeoutMs: 10000  // 10 seconds
});

// 2. Check responder is subscribed
client.subscribe('topic', (msg) => {
  if (!msg.replyTo) return;  // Must check this!
  // ... send reply
});

// 3. Handle timeout gracefully
try {
  const response = await client.request('topic', data);
} catch (err) {
  console.error('Request failed:', err);
  // Fallback behavior
}
```

---

**Ready to build? Start with the [API Reference](./API_REFERENCE.md) for complete details!**

---

**Last Updated:** November 2024
