# PAN v1.0 API Stability Contract

**Status:** 🔒 LOCKED FOR v1.0
**Last Updated:** November 2024

This document defines the **stable, public API surface** for PAN v1.0. All items marked as **STABLE** are guaranteed not to have breaking changes in v1.x releases. Breaking changes require a major version bump (v2.0).

---

## Table of Contents

1. [PanClient API](#panclient-api)
2. [PanMessage Format](#panmessage-format)
3. [CustomEvents](#customevents)
4. [Topic Conventions](#topic-conventions)
5. [Semantic Versioning Policy](#semantic-versioning-policy)
6. [Stability Guarantees](#stability-guarantees)

---

## PanClient API

### Constructor

**STABLE** - Constructor signature locked for v1.0

```javascript
new PanClient(host?: HTMLElement|Document, busSelector?: string)
```

**Parameters:**
- `host` (optional) - Element to dispatch/receive events from. Default: `document`
- `busSelector` (optional) - CSS selector for bus element. Default: `'pan-bus'`

**Guarantees:**
- ✅ Constructor will accept these parameters in all v1.x releases
- ✅ Default values will not change
- ✅ Parameter order will not change
- ⚠️ Additional optional parameters MAY be added at the end (non-breaking)

---

### ready()

**STABLE** - Method signature locked for v1.0

```javascript
client.ready(): Promise<void>
```

**Returns:** Promise that resolves when PAN bus is ready

**Guarantees:**
- ✅ Method name will not change
- ✅ Return type will not change (always returns Promise<void>)
- ✅ Resolves once bus emits `pan:sys.ready`
- ✅ Safe to call multiple times (returns same promise)

**Example:**
```javascript
const client = new PanClient();
await client.ready();
// Bus is now ready for use
```

---

### publish()

**STABLE** - Method signature locked for v1.0

```javascript
client.publish(message: PanMessage): void
```

**Parameters:**
- `message` - PanMessage object with required `topic` and `data` fields

**Required fields:**
- `message.topic` (string) - Topic name
- `message.data` (any) - Message payload

**Optional fields:**
- `message.retain` (boolean) - If true, message is retained
- `message.replyTo` (string) - Topic to send reply to
- `message.correlationId` (string) - Correlation ID for request/reply
- `message.headers` (object) - Optional metadata

**Guarantees:**
- ✅ Method name will not change
- ✅ Accepts object parameter with topic and data
- ✅ All PanMessage fields will be honored
- ✅ Returns void (fire-and-forget)
- ⚠️ Additional optional message fields MAY be added (non-breaking)

**Example:**
```javascript
// Simple publish
client.publish({
  topic: 'users.updated',
  data: { id: 123, name: 'Alice' }
});

// Retained message
client.publish({
  topic: 'app.state',
  data: { theme: 'dark' },
  retain: true
});
```

---

### subscribe()

**STABLE** - Method signature locked for v1.0

```javascript
client.subscribe(
  topics: string | string[],
  handler: (message: PanMessage) => void,
  options?: SubscribeOptions
): UnsubscribeFunction
```

**Parameters:**
- `topics` - Topic pattern(s) to subscribe to (string or array)
- `handler` - Callback function receiving PanMessage
- `options` (optional) - Subscription options

**SubscribeOptions:**
- `retained` (boolean) - If true, receive retained messages immediately
- `signal` (AbortSignal) - AbortSignal for automatic cleanup

**Returns:** Unsubscribe function `() => void`

**Guarantees:**
- ✅ Method name will not change
- ✅ Parameter order will not change
- ✅ Topic patterns support wildcards (`*`) as documented
- ✅ Returns unsubscribe function
- ✅ Handler receives full PanMessage object
- ✅ AbortSignal integration works as documented
- ⚠️ Additional optional options MAY be added (non-breaking)

**Example:**
```javascript
// Subscribe to single topic
const unsub = client.subscribe('users.updated', (msg) => {
  console.log('User updated:', msg.data);
});

// Subscribe to multiple topics with wildcard
client.subscribe(['users.*', 'posts.*'], (msg) => {
  console.log('Received:', msg.topic, msg.data);
});

// With retained messages
client.subscribe('app.state', (msg) => {
  console.log('Current state:', msg.data);
}, { retained: true });

// With AbortSignal
const controller = new AbortController();
client.subscribe('events.*', handler, { signal: controller.signal });
// Later: controller.abort(); // Unsubscribes automatically
```

---

### request()

**STABLE** - Method signature locked for v1.0

```javascript
client.request(
  topic: string,
  data: any,
  options?: RequestOptions
): Promise<PanMessage>
```

**Parameters:**
- `topic` - Request topic name
- `data` - Request payload
- `options` (optional) - Request options

**RequestOptions:**
- `timeoutMs` (number) - Request timeout in milliseconds. Default: 5000

**Returns:** Promise<PanMessage> that resolves with reply message

**Throws:** Error if request times out

**Guarantees:**
- ✅ Method name will not change
- ✅ Parameter order will not change
- ✅ Default timeout (5000ms) will not change
- ✅ Returns Promise<PanMessage>
- ✅ Rejects on timeout with Error
- ✅ Automatic correlation ID generation
- ⚠️ Additional optional options MAY be added (non-breaking)

**Example:**
```javascript
// Simple request
try {
  const response = await client.request('users.get', { id: 123 });
  console.log('User:', response.data);
} catch (err) {
  console.error('Request failed:', err);
}

// Custom timeout
const response = await client.request('slow.operation', { ... }, {
  timeoutMs: 10000  // 10 second timeout
});
```

---

### PanClient.matches() (static)

**STABLE** - Static method signature locked for v1.0

```javascript
PanClient.matches(topic: string, pattern: string): boolean
```

**Parameters:**
- `topic` - Topic to test (e.g., "users.list.state")
- `pattern` - Pattern to match (e.g., "users.*" or "*")

**Returns:** boolean - true if topic matches pattern

**Guarantees:**
- ✅ Method name will not change
- ✅ Parameter order will not change
- ✅ Wildcard semantics as documented (single segment match)
- ✅ Exact match when no wildcards
- ✅ Global wildcard `*` matches any topic

**Pattern Rules:**
- Exact match: `users.list.state` matches `users.list.state`
- Single wildcard: `users.*` matches `users.list` but NOT `users.list.state`
- Global wildcard: `*` matches any topic

**Example:**
```javascript
PanClient.matches('users.list.state', 'users.*')  // true
PanClient.matches('users.list.state', 'users.list.state')  // true
PanClient.matches('users.list.state', '*')  // true
PanClient.matches('users.list.state', 'posts.*')  // false
PanClient.matches('users.item.123', 'users.item.*')  // true
```

---

## PanMessage Format

**STABLE** - Message envelope format locked for v1.0

### Required Fields

```typescript
interface PanMessage {
  topic: string;      // Topic name (e.g., "users.list.state")
  data: any;          // Message payload (any JSON-serializable value)

  // Optional fields - auto-generated by bus if not provided
  id?: string;        // Unique message ID (UUID)
  ts?: number;        // Timestamp in milliseconds (epoch)

  // Optional fields - for message features
  retain?: boolean;           // If true, message is retained by bus
  replyTo?: string;           // Topic to send reply to
  correlationId?: string;     // Correlation ID for request/reply
  headers?: Record<string, string>;  // Optional metadata
}
```

### Field Guarantees

**topic (required)**
- ✅ Always a string
- ✅ Dotted segment notation (e.g., "resource.action.state")
- ✅ Case-sensitive
- ⚠️ No validation on topic format in v1.0 (MAY add in v1.x as non-breaking warning)

**data (required)**
- ✅ Any JSON-serializable value (object, array, string, number, boolean, null)
- ✅ No size limits enforced by PAN (browser/memory limits apply)
- ⚠️ Circular references will throw (native JSON serialization)

**id (optional)**
- ✅ Auto-generated UUID by bus if not provided
- ✅ String format
- ⚠️ User-provided IDs are not validated for uniqueness

**ts (optional)**
- ✅ Auto-generated timestamp by bus if not provided
- ✅ Number in milliseconds since epoch
- ⚠️ User-provided timestamps are not validated

**retain (optional)**
- ✅ Boolean flag
- ✅ If true, bus stores last message per topic
- ✅ Retained messages delivered to late subscribers who opt-in
- ✅ Default: false (not retained)

**replyTo (optional)**
- ✅ String topic name
- ✅ Used in request/reply pattern
- ✅ Reply should be published to this topic

**correlationId (optional)**
- ✅ String identifier
- ✅ Used to match requests and replies
- ✅ Auto-generated by `client.request()` if not provided

**headers (optional)**
- ✅ Object with string keys and string values
- ✅ Free-form metadata
- ⚠️ No reserved header names in v1.0 (MAY add conventions in v1.x)

---

## CustomEvents

**STABLE** - CustomEvent names and signatures locked for v1.0

All PAN CustomEvents use `bubbles: true, composed: true` to cross shadow DOM boundaries.

### pan:sys.ready

**Purpose:** Signal that PAN bus is ready

```javascript
new CustomEvent('pan:sys.ready', {
  bubbles: true,
  composed: true
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ Dispatched once when bus connects
- ✅ No event detail
- ✅ Bubbles and composed

---

### pan:publish

**Purpose:** Publish a message to the bus

```javascript
new CustomEvent('pan:publish', {
  detail: PanMessage,
  bubbles: true,
  composed: true
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ `detail` is PanMessage object
- ✅ Bubbles and composed
- ✅ Bus listens at document root with capture

---

### pan:subscribe

**Purpose:** Subscribe to topics

```javascript
new CustomEvent('pan:subscribe', {
  detail: {
    clientId: string,
    topics: string[],
    options?: { retained?: boolean }
  },
  bubbles: true,
  composed: true
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ `detail.topics` is array of topic patterns
- ✅ `detail.options.retained` enables retained message delivery
- ✅ Bubbles and composed

---

### pan:unsubscribe

**Purpose:** Unsubscribe from topics

```javascript
new CustomEvent('pan:unsubscribe', {
  detail: {
    clientId: string,
    topics: string[]
  },
  bubbles: true,
  composed: true
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ `detail.topics` is array of topic patterns
- ✅ Bubbles and composed

---

### pan:deliver

**Purpose:** Deliver message from bus to subscriber

```javascript
new CustomEvent('pan:deliver', {
  detail: PanMessage,
  bubbles: false,
  composed: false
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ `detail` is full PanMessage object
- ✅ Dispatched on subscribing element
- ⚠️ Does NOT bubble (targeted delivery)

---

### pan:hello

**Purpose:** Client announces presence to bus

```javascript
new CustomEvent('pan:hello', {
  detail: {
    id: string,
    caps?: string[]
  },
  bubbles: true,
  composed: true
})
```

**Guarantees:**
- ✅ Event name will not change
- ✅ `detail.id` is client identifier
- ✅ `detail.caps` is optional capabilities array
- ✅ Bubbles and composed

---

### Reserved Event Names

**LOCKED:** The following event name pattern is **reserved** for PAN:

- `pan:*` - All events starting with `pan:` are reserved
- `pan:sys.*` - System-level events
- `pan:ext.*` - Reserved for extensions/plugins

**Guarantees:**
- ✅ Application code MUST NOT dispatch `pan:*` events
- ✅ Only PAN bus and official extensions may use `pan:*` namespace
- ⚠️ New `pan:*` events MAY be added in v1.x (non-breaking if properly ignored)

---

## Topic Conventions

**STABLE** - Core conventions locked for v1.0

### Naming Pattern

**Standard Format:** `resource.action.qualifier`

Examples:
- `users.list.state` - List of users (retained state)
- `users.item.get` - Get single user (request)
- `users.item.save` - Save user (request)
- `nav.goto` - Navigate to route (command)

**Guarantees:**
- ✅ Dotted segment notation is the convention
- ✅ Case-sensitive matching
- ✅ No enforced rules on segment count
- ⚠️ Naming best practices MAY evolve (documentation only)

---

### Wildcard Matching

**Single Segment Wildcard:** `*`

Rules:
- `users.*` matches `users.list` but NOT `users.list.state`
- `*` matches any single topic
- Wildcards can be anywhere: `users.*.state`, `*.item.get`

**Guarantees:**
- ✅ Wildcard semantics will not change
- ✅ `*` always matches single segment only
- ⚠️ Multi-segment wildcards (`**`) NOT supported in v1.0

---

### Reserved Namespaces

**LOCKED** - Reserved for PAN internals

- `pan:*` - Internal bus communication (system events)
- `pan:$reply:*` - Generated reply topics for request/reply

**Guarantees:**
- ✅ Application code MUST NOT use `pan:*` topics
- ✅ `pan:$reply:*` topics are auto-generated by `client.request()`
- ⚠️ Additional reserved namespaces MAY be added in v1.x with documentation

---

### CRUD Conventions (Recommended)

**Status:** RECOMMENDED (not enforced)

These are **conventions**, not requirements. Applications MAY use different patterns.

**List Operations:**
- `${resource}.list.get` - Request list (responds with `{ items }`)
- `${resource}.list.state` - List state (retained)

**Item Operations:**
- `${resource}.item.select` - Select item (no reply, event only)
- `${resource}.item.get` - Get item by ID (request/reply)
- `${resource}.item.save` - Save item (request/reply)
- `${resource}.item.delete` - Delete item (request/reply)
- `${resource}.item.state.${id}` - Per-item state (retained)

**Examples:**
```javascript
// List users
const response = await client.request('users.list.get', {});
console.log(response.data.items);

// Subscribe to list state
client.subscribe('users.list.state', (msg) => {
  console.log('User list:', msg.data.items);
}, { retained: true });

// Get single user
const user = await client.request('users.item.get', { id: 123 });

// Save user
await client.request('users.item.save', { item: { id: 123, name: 'Alice' } });

// Select user (no reply)
client.publish({ topic: 'users.item.select', data: { id: 123 } });
```

**Guarantees:**
- ✅ These patterns are documented and recommended
- ⚠️ NOT enforced by PAN - applications may use different conventions
- ⚠️ Conventions MAY evolve in v1.x (documentation only)

---

## Semantic Versioning Policy

PAN follows [Semantic Versioning 2.0.0](https://semver.org/)

### Version Format: MAJOR.MINOR.PATCH

**Example:** v1.2.3
- MAJOR = 1 (breaking changes)
- MINOR = 2 (new features, backward compatible)
- PATCH = 3 (bug fixes, backward compatible)

---

### What Constitutes a BREAKING Change (requires MAJOR bump)

**PanClient API:**
- ❌ Removing a public method
- ❌ Changing method signature (parameter order, required params)
- ❌ Changing return type
- ❌ Changing default values that affect behavior
- ❌ Renaming methods or properties

**PanMessage Format:**
- ❌ Removing required fields
- ❌ Changing field types
- ❌ Changing field semantics

**CustomEvents:**
- ❌ Renaming events
- ❌ Changing event detail structure
- ❌ Changing bubbling/composed behavior

**Topic Conventions:**
- ❌ Changing wildcard matching semantics
- ❌ Breaking documented topic patterns

---

### What is a NON-BREAKING Change (MINOR or PATCH)

**Allowed in MINOR versions:**
- ✅ Adding new methods to PanClient
- ✅ Adding new optional parameters (at end of param list)
- ✅ Adding new optional fields to PanMessage
- ✅ Adding new CustomEvents (if ignorable by old code)
- ✅ Adding new topic conventions (documentation only)
- ✅ Adding new optional features

**Allowed in PATCH versions:**
- ✅ Bug fixes that don't change API
- ✅ Performance improvements
- ✅ Documentation updates
- ✅ Internal refactoring
- ✅ Test additions

---

### Deprecation Policy

When removing features, we follow this timeline:

1. **v1.x.0** - Feature marked as deprecated in documentation
   - Still works, logs deprecation warning to console
   - Alternative documented

2. **v1.(x+1).0** - At least 1 MINOR version later
   - Feature still works, stricter warnings
   - Removal date announced

3. **v2.0.0** - MAJOR version bump
   - Feature removed
   - Migration guide provided

**Minimum Deprecation Period:** 2 MINOR versions or 6 months (whichever is longer)

---

## Stability Guarantees

### What is STABLE (guaranteed not to break in v1.x)

✅ **PanClient API**
- All public methods: `constructor`, `ready()`, `publish()`, `subscribe()`, `request()`, `matches()`
- Method signatures and return types
- Parameter order and defaults

✅ **PanMessage Format**
- All fields: `topic`, `data`, `id`, `ts`, `retain`, `replyTo`, `correlationId`, `headers`
- Field types and semantics

✅ **CustomEvents**
- Event names: `pan:sys.ready`, `pan:publish`, `pan:subscribe`, `pan:unsubscribe`, `pan:deliver`, `pan:hello`
- Event detail structures
- Bubbling/composed behavior

✅ **Topic Matching**
- Wildcard `*` matching single segment
- Exact match behavior

✅ **Reserved Namespaces**
- `pan:*` for internal use
- `pan:$reply:*` for request/reply

---

### What is UNSTABLE (may change in v1.x)

⚠️ **Internal Implementation**
- Private methods (prefixed with `_`)
- Internal event handling
- Bus internals

⚠️ **CRUD Conventions**
- Recommended patterns may evolve
- Not enforced, just documented

⚠️ **Error Messages**
- Text of error messages may change
- Error types are stable

---

### What is EXPERIMENTAL (may be removed)

🧪 **None in v1.0**

All APIs in v1.0 are either STABLE or documented as UNSTABLE. No experimental features at release.

---

## Migration Guide (Future)

When v2.0 is released, a comprehensive migration guide will be provided covering:
- All breaking changes
- Automated migration tools (if applicable)
- Step-by-step upgrade instructions
- Deprecation timeline

---

## Feedback and Changes

This document is **LOCKED** for v1.0 release. Changes require:

1. **Non-breaking additions** - Require MINOR version bump and documentation update
2. **Breaking changes** - Require MAJOR version bump (v2.0) and deprecation period
3. **Clarifications** - Documentation fixes only, no version bump

**Last Review:** November 2024
**Next Review:** Before v1.1.0 release

---

**End of API Stability Contract**
