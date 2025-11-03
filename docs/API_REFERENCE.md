# PAN v1.0 API Reference

Complete reference documentation for the Page Area Network (PAN) v1.0 API.

**Quick Links:**
- [PanClient API](#panclient-api)
- [PanMessage Format](#panmessage-format)
- [Topic Patterns](#topic-patterns)
- [Request/Reply Pattern](#requestreply-pattern)
- [Retained Messages](#retained-messages)
- [Error Handling](#error-handling)

---

## Getting Started

### Installation

```html
<!-- Include PAN bus and autoloader -->
<pan-bus></pan-bus>
<script type="module" src="./pan/core/pan-autoload.mjs"></script>
```

### Basic Usage

```javascript
import { PanClient } from './pan/core/pan-client.mjs';

// Create client
const client = new PanClient();
await client.ready();

// Publish a message
client.publish({
  topic: 'users.updated',
  data: { id: 123, name: 'Alice' }
});

// Subscribe to messages
client.subscribe('users.*', (msg) => {
  console.log('Received:', msg.topic, msg.data);
});
```

---

## PanClient API

### Constructor

Creates a new PAN client instance.

```javascript
new PanClient(host?, busSelector?)
```

#### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `HTMLElement \| Document` | `document` | Element to dispatch/receive events from |
| `busSelector` | `string` | `'pan-bus'` | CSS selector for bus element |

#### Returns

New `PanClient` instance

#### Examples

```javascript
// Default: use document as host
const client = new PanClient();

// Use specific element as host
const myComponent = document.querySelector('my-component');
const client = new PanClient(myComponent);

// Custom bus selector
const client = new PanClient(document, 'custom-bus');
```

#### Use Cases

**Document-level client** (most common):
```javascript
// All components can communicate through document
const client = new PanClient();
```

**Component-scoped client**:
```javascript
// Isolate communication to specific component subtree
class MyComponent extends HTMLElement {
  connectedCallback() {
    this.client = new PanClient(this);
  }
}
```

---

### ready()

Returns a promise that resolves when the PAN bus is ready.

```javascript
client.ready(): Promise<void>
```

#### Returns

`Promise<void>` - Resolves when bus emits `pan:sys.ready`

#### Examples

```javascript
// Wait for bus before publishing
const client = new PanClient();
await client.ready();
client.publish({ topic: 'app.started', data: {} });
```

```javascript
// Use .then() syntax
client.ready().then(() => {
  console.log('Bus is ready!');
});
```

```javascript
// Safe to call multiple times (returns same promise)
await client.ready();
await client.ready(); // No-op, already ready
```

#### Best Practices

✅ **DO:** Always wait for `ready()` before publishing
```javascript
await client.ready();
client.publish({ topic: 'app.init', data: {} });
```

❌ **DON'T:** Publish before bus is ready
```javascript
// May be lost if bus not ready yet
client.publish({ topic: 'app.init', data: {} });
```

---

### publish()

Publishes a message to the PAN bus.

```javascript
client.publish(message: PanMessage): void
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `message` | `PanMessage` | Yes | Message object to publish |
| `message.topic` | `string` | Yes | Topic name |
| `message.data` | `any` | Yes | Message payload |
| `message.retain` | `boolean` | No | Retain message for late subscribers |
| `message.replyTo` | `string` | No | Topic to send reply to |
| `message.correlationId` | `string` | No | Correlation ID for request/reply |
| `message.headers` | `object` | No | Optional metadata |

#### Returns

`void` - Fire and forget

#### Examples

**Simple publish:**
```javascript
client.publish({
  topic: 'users.updated',
  data: { id: 123, name: 'Alice' }
});
```

**Retained message:**
```javascript
// Last message stored and replayed to new subscribers
client.publish({
  topic: 'app.theme',
  data: { mode: 'dark' },
  retain: true
});
```

**With metadata headers:**
```javascript
client.publish({
  topic: 'analytics.event',
  data: { action: 'click', target: 'button' },
  headers: {
    userId: '123',
    sessionId: 'abc',
    timestamp: Date.now().toString()
  }
});
```

#### Common Patterns

**State updates:**
```javascript
// Publish retained state for late joiners
function updateUserList(users) {
  client.publish({
    topic: 'users.list.state',
    data: { users },
    retain: true
  });
}
```

**Commands:**
```javascript
// Fire-and-forget command
function navigateTo(route) {
  client.publish({
    topic: 'nav.goto',
    data: { route }
  });
}
```

**Events:**
```javascript
// Notify about user actions
button.addEventListener('click', () => {
  client.publish({
    topic: 'ui.button.clicked',
    data: { buttonId: button.id }
  });
});
```

---

### subscribe()

Subscribes to one or more topic patterns.

```javascript
client.subscribe(
  topics: string | string[],
  handler: (message: PanMessage) => void,
  options?: SubscribeOptions
): UnsubscribeFunction
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topics` | `string \| string[]` | Yes | Topic pattern(s) to subscribe to |
| `handler` | `function` | Yes | Callback receiving PanMessage |
| `options` | `SubscribeOptions` | No | Subscription options |
| `options.retained` | `boolean` | No | Receive retained messages immediately |
| `options.signal` | `AbortSignal` | No | AbortSignal for automatic cleanup |

#### Returns

`UnsubscribeFunction` - Call to unsubscribe: `() => void`

#### Examples

**Simple subscription:**
```javascript
const unsub = client.subscribe('users.updated', (msg) => {
  console.log('User updated:', msg.data);
});

// Later: unsubscribe
unsub();
```

**Multiple topics:**
```javascript
client.subscribe(['users.*', 'posts.*'], (msg) => {
  console.log('Received:', msg.topic, msg.data);
});
```

**Wildcard patterns:**
```javascript
// Match all user-related topics
client.subscribe('users.*', (msg) => {
  console.log('User event:', msg.topic);
});

// Match everything
client.subscribe('*', (msg) => {
  console.log('Any message:', msg.topic);
});
```

**Retained messages:**
```javascript
// Receive current state immediately
client.subscribe('app.theme', (msg) => {
  applyTheme(msg.data.mode);
}, { retained: true });
```

**With AbortSignal:**
```javascript
const controller = new AbortController();

client.subscribe('events.*', (msg) => {
  console.log('Event:', msg.topic);
}, { signal: controller.signal });

// Later: unsubscribe automatically
controller.abort();
```

#### Common Patterns

**State synchronization:**
```javascript
// Keep UI in sync with state
client.subscribe('users.list.state', (msg) => {
  renderUserList(msg.data.users);
}, { retained: true });
```

**Event handling:**
```javascript
// Handle navigation events
client.subscribe('nav.goto', (msg) => {
  router.navigateTo(msg.data.route);
});
```

**Component cleanup:**
```javascript
class MyComponent extends HTMLElement {
  connectedCallback() {
    this.client = new PanClient(this);

    // Store unsubscribe function
    this.unsub = this.client.subscribe('data.*', (msg) => {
      this.handleData(msg.data);
    });
  }

  disconnectedCallback() {
    // Clean up subscription
    this.unsub();
  }
}
```

**Automatic cleanup:**
```javascript
class MyComponent extends HTMLElement {
  connectedCallback() {
    this.abortController = new AbortController();

    // Will auto-cleanup on abort
    this.client.subscribe('data.*', (msg) => {
      this.handleData(msg.data);
    }, { signal: this.abortController.signal });
  }

  disconnectedCallback() {
    // Unsubscribe all at once
    this.abortController.abort();
  }
}
```

---

### request()

Sends a request and waits for a reply.

```javascript
client.request(
  topic: string,
  data: any,
  options?: RequestOptions
): Promise<PanMessage>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | `string` | Yes | Request topic name |
| `data` | `any` | Yes | Request payload |
| `options` | `RequestOptions` | No | Request options |
| `options.timeoutMs` | `number` | No | Timeout in ms (default: 5000) |

#### Returns

`Promise<PanMessage>` - Resolves with reply message

#### Throws

`Error` - If request times out

#### Examples

**Simple request:**
```javascript
try {
  const response = await client.request('users.get', { id: 123 });
  console.log('User:', response.data);
} catch (err) {
  console.error('Request failed:', err);
}
```

**Custom timeout:**
```javascript
const response = await client.request('slow.operation', { ... }, {
  timeoutMs: 10000  // 10 second timeout
});
```

**CRUD operations:**
```javascript
// Create
const created = await client.request('users.item.save', {
  item: { name: 'Alice', email: 'alice@example.com' }
});

// Read
const user = await client.request('users.item.get', { id: 123 });

// Update
const updated = await client.request('users.item.save', {
  item: { id: 123, name: 'Alice Updated' }
});

// Delete
const deleted = await client.request('users.item.delete', { id: 123 });
```

**Error handling:**
```javascript
async function loadUser(id) {
  try {
    const response = await client.request('users.item.get', { id });

    if (!response.data.ok) {
      throw new Error(response.data.error);
    }

    return response.data.item;
  } catch (err) {
    if (err.message.includes('timeout')) {
      console.error('Request timed out');
    } else {
      console.error('Failed to load user:', err);
    }
    return null;
  }
}
```

#### Implementing a Responder

```javascript
// Listen for requests
client.subscribe('users.item.get', async (msg) => {
  // Only respond to requests (have replyTo)
  if (!msg.replyTo) return;

  // Process request
  const user = await db.getUser(msg.data.id);

  // Send reply
  client.publish({
    topic: msg.replyTo,
    data: { ok: true, item: user },
    correlationId: msg.correlationId
  });
});
```

---

### matches() (static)

Tests if a topic matches a pattern.

```javascript
PanClient.matches(topic: string, pattern: string): boolean
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `topic` | `string` | Yes | Topic to test |
| `pattern` | `string` | Yes | Pattern to match |

#### Returns

`boolean` - `true` if topic matches pattern

#### Pattern Rules

- **Exact match**: `users.list.state` matches `users.list.state`
- **Single wildcard**: `users.*` matches `users.list` but NOT `users.list.state`
- **Global wildcard**: `*` matches any topic
- **Wildcard position**: Can be anywhere (`*.updated`, `users.*.state`)

#### Examples

```javascript
// Exact match
PanClient.matches('users.list.state', 'users.list.state')  // true

// Single segment wildcard
PanClient.matches('users.list', 'users.*')         // true
PanClient.matches('users.list.state', 'users.*')  // false (2 segments)

// Global wildcard
PanClient.matches('users.list.state', '*')         // true
PanClient.matches('any.topic.here', '*')           // true

// Wildcard positions
PanClient.matches('users.item.updated', '*.item.updated')  // true
PanClient.matches('users.item.123', 'users.item.*')        // true

// No match
PanClient.matches('users.list', 'posts.*')         // false
```

#### Use Cases

**Manual filtering:**
```javascript
client.subscribe('*', (msg) => {
  if (PanClient.matches(msg.topic, 'users.*')) {
    handleUserEvent(msg);
  } else if (PanClient.matches(msg.topic, 'posts.*')) {
    handlePostEvent(msg);
  }
});
```

**Testing patterns:**
```javascript
const pattern = 'users.*';
const topics = ['users.list', 'users.item', 'posts.list'];

const matching = topics.filter(t => PanClient.matches(t, pattern));
console.log(matching); // ['users.list', 'users.item']
```

---

## PanMessage Format

All messages follow this structure:

```typescript
interface PanMessage {
  // Required fields
  topic: string;      // Topic name (e.g., "users.list.state")
  data: any;          // Message payload (any JSON-serializable value)

  // Optional fields (auto-generated by bus if not provided)
  id?: string;        // Unique message ID (UUID)
  ts?: number;        // Timestamp in milliseconds (epoch)

  // Optional fields (features)
  retain?: boolean;           // If true, message is retained by bus
  replyTo?: string;           // Topic to send reply to
  correlationId?: string;     // Correlation ID for request/reply
  headers?: Record<string, string>;  // Optional metadata
}
```

### Field Descriptions

#### topic (required)

Topic name using dotted notation.

**Format:** `resource.action.qualifier`

**Examples:**
- `users.list.state` - User list state
- `users.item.get` - Get user request
- `nav.goto` - Navigation command
- `ui.modal.opened` - UI event

**Best Practices:**
- Use lowercase
- Use dots to separate segments
- Be specific but concise
- Follow conventions (see [Topic Patterns](#topic-patterns))

#### data (required)

Message payload - any JSON-serializable value.

**Supported types:**
- Object: `{ id: 123, name: 'Alice' }`
- Array: `[1, 2, 3]`
- String: `"hello"`
- Number: `42`
- Boolean: `true` / `false`
- Null: `null`

**Not supported:**
- Functions
- undefined (use null instead)
- Circular references (will throw)
- DOM nodes (serialize to plain objects)

**Examples:**
```javascript
// Object payload
{ topic: 'users.updated', data: { id: 123, name: 'Alice' } }

// Array payload
{ topic: 'users.list.state', data: [user1, user2, user3] }

// Simple value
{ topic: 'counter.value', data: 42 }

// Null
{ topic: 'users.selected', data: null }  // No selection
```

#### id (optional)

Unique message identifier (UUID).

**Auto-generated:** Bus creates UUID if not provided
**Format:** `"550e8400-e29b-41d4-a716-446655440000"`

**Use cases:**
- Message deduplication
- Tracking specific messages
- Debugging

```javascript
// Let bus generate ID (recommended)
client.publish({ topic: 'users.updated', data: { ... } });

// Provide custom ID
client.publish({
  topic: 'users.updated',
  data: { ... },
  id: 'custom-id-123'
});
```

#### ts (optional)

Timestamp in milliseconds since epoch.

**Auto-generated:** Bus adds timestamp if not provided
**Format:** Number (e.g., `1699564800000`)

**Use cases:**
- Message ordering
- Time-based filtering
- Analytics

```javascript
// Let bus generate timestamp (recommended)
client.publish({ topic: 'event', data: { ... } });

// Provide custom timestamp
client.publish({
  topic: 'event',
  data: { ... },
  ts: Date.now()
});
```

#### retain (optional)

If `true`, bus stores this message and replays it to new subscribers.

**Default:** `false`
**Type:** `boolean`

**Use cases:**
- Application state
- Configuration
- Last known value

```javascript
// Retained state message
client.publish({
  topic: 'app.theme',
  data: { mode: 'dark' },
  retain: true
});

// New subscribers get current theme
client.subscribe('app.theme', (msg) => {
  console.log('Current theme:', msg.data.mode);
}, { retained: true });
```

**See:** [Retained Messages](#retained-messages)

#### replyTo (optional)

Topic to send reply to (for request/reply pattern).

**Type:** `string`
**Auto-generated:** By `client.request()`

**Use cases:**
- Request/reply pattern
- Async responses

```javascript
// Manually set replyTo
client.publish({
  topic: 'users.item.get',
  data: { id: 123 },
  replyTo: 'users.item.get.reply.abc123',
  correlationId: 'req-001'
});

// Or use client.request() (recommended)
const response = await client.request('users.item.get', { id: 123 });
```

**See:** [Request/Reply Pattern](#requestreply-pattern)

#### correlationId (optional)

Correlation identifier for matching requests and replies.

**Type:** `string`
**Auto-generated:** By `client.request()`

**Use cases:**
- Match request with reply
- Track conversation

```javascript
// Auto-generated by client.request()
const response = await client.request('users.item.get', { id: 123 });
// correlationId is automatically created and matched

// Manual correlation
const corrId = crypto.randomUUID();
client.publish({
  topic: 'task.start',
  data: { task: 'process' },
  correlationId: corrId
});

client.subscribe('task.complete', (msg) => {
  if (msg.correlationId === corrId) {
    console.log('Our task completed!');
  }
});
```

#### headers (optional)

Free-form metadata as string key-value pairs.

**Type:** `Record<string, string>`
**Default:** `undefined`

**Use cases:**
- User context (userId, sessionId)
- Tracing (traceId, spanId)
- Metadata (source, version)

```javascript
client.publish({
  topic: 'analytics.event',
  data: { action: 'click', target: 'button' },
  headers: {
    userId: '123',
    sessionId: 'abc',
    timestamp: Date.now().toString(),
    source: 'mobile-app'
  }
});
```

---

## Topic Patterns

### Naming Conventions

**Standard format:** `resource.action.qualifier`

**Examples:**
```
users.list.state        # Resource: users, Action: list, Qualifier: state
users.item.get          # Resource: users, Action: item (single), Qualifier: get
users.item.save         # Resource: users, Action: item, Qualifier: save
nav.goto                # Resource: nav, Action: goto
ui.modal.opened         # Resource: ui (modal), Action: opened
```

### Wildcard Matching

**Single segment:** `*` matches exactly one segment

```javascript
'users.*'              # Matches: users.list, users.item
                       # Does NOT match: users.list.state, users.item.get

'*.updated'            # Matches: users.updated, posts.updated
                       # Does NOT match: users.item.updated

'users.*.state'        # Matches: users.list.state, users.item.state
                       # Does NOT match: users.state, users.list.item.state
```

**Global wildcard:** `*` alone matches any topic

```javascript
'*'                    # Matches: ALL topics
```

### Reserved Namespaces

**`pan:*`** - Reserved for PAN internals

```
pan:sys.ready          # System ready event
pan:publish            # Internal publish event
pan:subscribe          # Internal subscribe event
pan:deliver            # Internal deliver event
```

❌ **DO NOT** use `pan:*` topics in application code

**`pan:$reply:*`** - Auto-generated reply topics

```
pan:$reply:client-id:correlation-id
```

❌ **DO NOT** manually create `pan:$reply:*` topics

---

## Request/Reply Pattern

### Overview

Request/reply enables async request-response communication between components.

**How it works:**
1. Requester calls `client.request(topic, data)`
2. Request is published with auto-generated `replyTo` and `correlationId`
3. Responder listens for request topic
4. Responder publishes reply to `replyTo` topic with same `correlationId`
5. Requester receives reply (promise resolves)

### Basic Example

**Requester:**
```javascript
try {
  const response = await client.request('users.item.get', { id: 123 });
  console.log('User:', response.data.item);
} catch (err) {
  console.error('Request failed:', err);
}
```

**Responder:**
```javascript
client.subscribe('users.item.get', async (msg) => {
  if (!msg.replyTo) return;  // Not a request

  const user = await database.getUser(msg.data.id);

  client.publish({
    topic: msg.replyTo,
    data: { ok: true, item: user },
    correlationId: msg.correlationId
  });
});
```

### Response Format

**Recommended format:**
```javascript
{
  ok: boolean,         // Success flag
  item?: any,          // Result data (on success)
  error?: string,      // Error message (on failure)
  code?: string        // Error code (on failure)
}
```

**Example responses:**
```javascript
// Success
{ ok: true, item: { id: 123, name: 'Alice' } }

// Error
{ ok: false, error: 'User not found', code: 'NOT_FOUND' }

// List result
{ ok: true, items: [user1, user2, user3], total: 50 }
```

### Complete CRUD Example

```javascript
// CREATE
async function createUser(userData) {
  const response = await client.request('users.item.save', {
    item: userData
  });

  if (!response.data.ok) {
    throw new Error(response.data.error);
  }

  return response.data.item;
}

// READ (single)
async function getUser(id) {
  const response = await client.request('users.item.get', { id });
  return response.data.ok ? response.data.item : null;
}

// READ (list)
async function listUsers() {
  const response = await client.request('users.list.get', {});
  return response.data.items || [];
}

// UPDATE
async function updateUser(id, changes) {
  const response = await client.request('users.item.save', {
    item: { id, ...changes }
  });
  return response.data.item;
}

// DELETE
async function deleteUser(id) {
  const response = await client.request('users.item.delete', { id });
  return response.data.ok;
}
```

### Timeout Handling

```javascript
async function getUserWithRetry(id, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.request('users.item.get', { id }, {
        timeoutMs: 5000
      });
    } catch (err) {
      if (err.message.includes('timeout') && i < maxRetries - 1) {
        console.log(`Timeout, retrying (${i + 1}/${maxRetries})...`);
        continue;
      }
      throw err;
    }
  }
}
```

---

## Retained Messages

### Overview

Retained messages are the last message published to a topic, stored by the bus and replayed to new subscribers who opt-in.

**Use cases:**
- Application state
- Configuration
- Last known value
- Avoid "no data" state on load

### Publishing Retained Messages

```javascript
// Publish retained state
client.publish({
  topic: 'app.theme',
  data: { mode: 'dark' },
  retain: true
});

// Later: publish new state (replaces previous)
client.publish({
  topic: 'app.theme',
  data: { mode: 'light' },
  retain: true
});
```

### Subscribing to Retained Messages

```javascript
// Receive current state immediately
client.subscribe('app.theme', (msg) => {
  applyTheme(msg.data.mode);
}, { retained: true });

// Without retained option (only new messages)
client.subscribe('app.theme', (msg) => {
  applyTheme(msg.data.mode);
});  // Won't receive current state
```

### Complete State Example

```javascript
// State manager
class UserListManager {
  constructor(client) {
    this.client = client;
    this.users = [];
  }

  // Publish state
  updateState(users) {
    this.users = users;
    this.client.publish({
      topic: 'users.list.state',
      data: { users: this.users },
      retain: true
    });
  }

  // Add user
  addUser(user) {
    this.users.push(user);
    this.updateState(this.users);
  }

  // Remove user
  removeUser(id) {
    this.users = this.users.filter(u => u.id !== id);
    this.updateState(this.users);
  }
}

// UI component
class UserListComponent extends HTMLElement {
  connectedCallback() {
    this.client = new PanClient(this);

    // Get current state + future updates
    this.client.subscribe('users.list.state', (msg) => {
      this.render(msg.data.users);
    }, { retained: true });
  }

  render(users) {
    this.innerHTML = users.map(u => `<li>${u.name}</li>`).join('');
  }
}
```

### Best Practices

✅ **DO:**
- Use retained messages for state
- One retained message per topic (last value)
- Keep retained data reasonably sized

❌ **DON'T:**
- Use retained for events (use normal publish)
- Rely on retained for history (only last value stored)
- Retain huge datasets (consider pagination)

---

## Error Handling

### Request Timeouts

```javascript
async function safeRequest(topic, data) {
  try {
    return await client.request(topic, data, { timeoutMs: 5000 });
  } catch (err) {
    if (err.message.includes('timeout')) {
      console.error('Request timed out');
      return { data: { ok: false, error: 'Timeout' } };
    }
    throw err;
  }
}
```

### Invalid Data

```javascript
try {
  client.publish({
    topic: 'users.updated',
    data: { circular: selfReference }  // Will throw
  });
} catch (err) {
  console.error('Failed to publish:', err);
}
```

### Missing Responders

```javascript
// Set reasonable timeout for potentially missing responders
const response = await client.request('optional.service', data, {
  timeoutMs: 1000  // Fail fast
}).catch(err => {
  // Handle gracefully
  return { data: { ok: false, error: 'Service unavailable' } };
});
```

---

## Next Steps

- **Topic Conventions:** See [TOPICS.md](./TOPICS.md) for detailed conventions
- **Code Examples:** See [examples/](../examples/) for complete working examples
- **API Stability:** See [API_STABILITY.md](./API_STABILITY.md) for guarantees

---

**Last Updated:** November 2024
