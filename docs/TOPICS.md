# PAN Topic Conventions

Comprehensive guide to topic naming patterns and conventions for PAN v1.0.

---

## Table of Contents

1. [Naming Format](#naming-format)
2. [CRUD Patterns](#crud-patterns)
3. [State Management](#state-management)
4. [Events vs Commands](#events-vs-commands)
5. [Reserved Namespaces](#reserved-namespaces)
6. [Best Practices](#best-practices)
7. [Common Patterns](#common-patterns)

---

## Naming Format

### Standard Pattern

```
resource.action.qualifier
```

**Components:**
- `resource` - What you're working with (users, posts, nav, ui)
- `action` - What's happening (list, item, get, save, delete, goto)
- `qualifier` - Additional context (state, request, reply, event)

### Examples

```
users.list.state        # User list state (retained)
users.list.get          # Get user list (request)
users.item.get          # Get single user (request)
users.item.save         # Save user (request)
users.item.delete       # Delete user (request)
users.item.select       # User selected (event)
users.item.updated      # User was updated (event)

posts.list.state        # Post list state (retained)
posts.item.created      # Post created (event)

nav.goto                # Navigate (command)
nav.back                # Go back (command)

ui.modal.opened         # Modal opened (event)
ui.modal.closed         # Modal closed (event)
ui.sidebar.toggle       # Toggle sidebar (command)
```

---

## CRUD Patterns

### List Operations

**List State** (retained):
```
${resource}.list.state
```

Retained message containing current list data.

```javascript
// Publish list state
client.publish({
  topic: 'users.list.state',
  data: {
    items: [user1, user2, user3],
    total: 50,
    page: 1
  },
  retain: true
});

// Subscribe to list state
client.subscribe('users.list.state', (msg) => {
  renderUserList(msg.data.items);
}, { retained: true });
```

**List Get** (request):
```
${resource}.list.get
```

Request to fetch list data.

```javascript
// Request list
const response = await client.request('users.list.get', {
  page: 1,
  limit: 20,
  filter: { active: true }
});

// Responder
client.subscribe('users.list.get', async (msg) => {
  if (!msg.replyTo) return;

  const users = await db.getUsers(msg.data);

  client.publish({
    topic: msg.replyTo,
    data: {
      ok: true,
      items: users,
      total: await db.countUsers(msg.data.filter)
    },
    correlationId: msg.correlationId
  });

  // Also update retained state
  client.publish({
    topic: 'users.list.state',
    data: { items: users },
    retain: true
  });
});
```

---

### Item Operations

**Item Get** (request):
```
${resource}.item.get
```

Request single item by ID.

```javascript
// Request item
const response = await client.request('users.item.get', { id: 123 });

if (response.data.ok) {
  console.log('User:', response.data.item);
}

// Responder
client.subscribe('users.item.get', async (msg) => {
  if (!msg.replyTo) return;

  const user = await db.getUser(msg.data.id);

  client.publish({
    topic: msg.replyTo,
    data: user ? { ok: true, item: user } : { ok: false, error: 'Not found' },
    correlationId: msg.correlationId
  });
});
```

**Item Save** (request):
```
${resource}.item.save
```

Create or update item.

```javascript
// Save item (create or update)
const response = await client.request('users.item.save', {
  item: {
    id: 123,  // Omit for create
    name: 'Alice',
    email: 'alice@example.com'
  }
});

// Responder
client.subscribe('users.item.save', async (msg) => {
  if (!msg.replyTo) return;

  const saved = await db.saveUser(msg.data.item);

  client.publish({
    topic: msg.replyTo,
    data: { ok: true, item: saved },
    correlationId: msg.correlationId
  });

  // Update list state
  const users = await db.getUsers();
  client.publish({
    topic: 'users.list.state',
    data: { items: users },
    retain: true
  });

  // Notify about update
  client.publish({
    topic: 'users.item.updated',
    data: { item: saved }
  });
});
```

**Item Delete** (request):
```
${resource}.item.delete
```

Delete item by ID.

```javascript
// Delete item
const response = await client.request('users.item.delete', { id: 123 });

// Responder
client.subscribe('users.item.delete', async (msg) => {
  if (!msg.replyTo) return;

  await db.deleteUser(msg.data.id);

  client.publish({
    topic: msg.replyTo,
    data: { ok: true, id: msg.data.id },
    correlationId: msg.correlationId
  });

  // Update list state
  const users = await db.getUsers();
  client.publish({
    topic: 'users.list.state',
    data: { items: users },
    retain: true
  });

  // Notify about deletion
  client.publish({
    topic: 'users.item.deleted',
    data: { id: msg.data.id }
  });
});
```

**Item Select** (event):
```
${resource}.item.select
```

User selected an item (no reply needed).

```javascript
// Select item
client.publish({
  topic: 'users.item.select',
  data: { id: 123 }
});

// Handle selection
client.subscribe('users.item.select', (msg) => {
  highlightUser(msg.data.id);
  loadUserDetails(msg.data.id);
});
```

---

### Per-Item State

**Item State** (retained):
```
${resource}.item.state.${id}
```

Retained state for specific item.

```javascript
// Publish item state
client.publish({
  topic: `users.item.state.${userId}`,
  data: {
    id: userId,
    online: true,
    lastSeen: Date.now()
  },
  retain: true
});

// Subscribe to item state
client.subscribe(`users.item.state.${userId}`, (msg) => {
  updateUserStatus(msg.data);
}, { retained: true });

// Subscribe to all item states
client.subscribe('users.item.state.*', (msg) => {
  console.log('User state changed:', msg.data.id);
});
```

---

## State Management

### Retained State Pattern

**Always use `.state` suffix for retained topics:**

```javascript
// Good
'app.config.state'
'users.list.state'
'theme.current.state'
'session.user.state'

// Bad (not clear it's retained)
'app.config'
'users.list'
'theme'
```

### State Update Pattern

```javascript
class StateManager {
  constructor(topic, client) {
    this.topic = topic;
    this.client = client;
    this.state = null;
  }

  // Update state
  setState(newState) {
    this.state = newState;
    this.client.publish({
      topic: `${this.topic}.state`,
      data: newState,
      retain: true
    });
  }

  // Patch state (merge)
  patchState(changes) {
    this.state = { ...this.state, ...changes };
    this.setState(this.state);
  }

  // Subscribe to state
  subscribe(handler) {
    return this.client.subscribe(`${this.topic}.state`, (msg) => {
      this.state = msg.data;
      handler(msg.data);
    }, { retained: true });
  }
}

// Usage
const userState = new StateManager('users.current', client);

userState.setState({ id: 123, name: 'Alice' });
userState.patchState({ online: true });

userState.subscribe((state) => {
  console.log('User state:', state);
});
```

---

## Events vs Commands

### Events

Events describe something that **already happened**.

**Use past tense:**
```
users.item.created
users.item.updated
users.item.deleted
ui.modal.opened
ui.modal.closed
session.started
session.ended
```

**Characteristics:**
- Past tense
- No reply expected
- Fire-and-forget
- Multiple subscribers OK

```javascript
// Publish event
client.publish({
  topic: 'users.item.created',
  data: { item: newUser }
});

// Multiple handlers
client.subscribe('users.item.created', (msg) => {
  logAnalytics('user_created', msg.data.item);
});

client.subscribe('users.item.created', (msg) => {
  sendWelcomeEmail(msg.data.item);
});

client.subscribe('users.item.created', (msg) => {
  updateUserCount();
});
```

### Commands

Commands request something to **happen in the future**.

**Use imperative:**
```
users.item.save
users.item.delete
nav.goto
nav.back
ui.modal.open
ui.modal.close
session.start
session.end
```

**Characteristics:**
- Imperative/verb form
- May expect reply (request/reply)
- Single handler (one thing does it)
- May fail

```javascript
// Publish command (fire-and-forget)
client.publish({
  topic: 'nav.goto',
  data: { route: '/users/123' }
});

// Request command (expect reply)
const response = await client.request('users.item.save', {
  item: { name: 'Alice' }
});

// Handler
client.subscribe('nav.goto', (msg) => {
  router.navigateTo(msg.data.route);
});
```

---

## Reserved Namespaces

### `pan:*` - PAN Internals

**Reserved for PAN system use. Do not use in application code.**

```
pan:sys.ready           # System ready
pan:publish             # Internal publish
pan:subscribe           # Internal subscribe
pan:unsubscribe         # Internal unsubscribe
pan:deliver             # Internal deliver
pan:hello               # Client hello
pan:$reply:*            # Auto-generated reply topics
```

### `sys:*` - System Topics

**Reserved for future system-level topics.**

```
sys:error               # System errors (future)
sys:perf                # Performance monitoring (future)
sys:debug               # Debug information (future)
```

### Application Namespaces

**Your application should use its own namespaces:**

```
app.*                   # Application-level topics
config.*                # Configuration
session.*               # Session management
auth.*                  # Authentication
analytics.*             # Analytics events
```

---

## Best Practices

### DO ✅

**Use descriptive names:**
```javascript
// Good
'users.list.state'
'users.item.updated'
'nav.goto'

// Bad
'u.l.s'
'u.upd'
'go'
```

**Use consistent patterns:**
```javascript
// Good - same pattern for all resources
'users.list.state'
'posts.list.state'
'comments.list.state'

// Bad - inconsistent
'users.list.state'
'posts_list'
'commentList'
```

**Use retained for state:**
```javascript
// Good
client.publish({
  topic: 'app.theme.state',
  data: { mode: 'dark' },
  retain: true
});

// Bad - state without retain
client.publish({
  topic: 'app.theme.state',
  data: { mode: 'dark' }
});
```

**Use events for notifications:**
```javascript
// Good - notify about change
client.publish({
  topic: 'users.item.updated',
  data: { item: updatedUser }
});

// Good - update state too
client.publish({
  topic: 'users.list.state',
  data: { items: updatedList },
  retain: true
});
```

### DON'T ❌

**Don't use underscores:**
```javascript
// Bad
'users_list_state'
'user.item_updated'

// Good
'users.list.state'
'users.item.updated'
```

**Don't use camelCase:**
```javascript
// Bad
'users.listState'
'users.itemUpdated'

// Good
'users.list.state'
'users.item.updated'
```

**Don't use verbs for events:**
```javascript
// Bad - sounds like command
'users.update'

// Good - past tense
'users.updated'
```

**Don't overuse wildcards:**
```javascript
// Bad - too broad
client.subscribe('*', handler);

// Good - specific
client.subscribe('users.*', handler);
```

---

## Common Patterns

### Authentication

```javascript
// Login (request)
const response = await client.request('auth.login', {
  email: 'alice@example.com',
  password: 'secret'
});

// Session state (retained)
client.publish({
  topic: 'auth.session.state',
  data: {
    user: { id: 123, name: 'Alice' },
    token: 'jwt-token'
  },
  retain: true
});

// Logout (command)
client.publish({
  topic: 'auth.logout',
  data: {}
});

// Events
'auth.login.success'
'auth.login.failed'
'auth.logout'
```

### Navigation

```javascript
// Navigate (command)
client.publish({
  topic: 'nav.goto',
  data: { route: '/users/123' }
});

// History (commands)
client.publish({ topic: 'nav.back', data: {} });
client.publish({ topic: 'nav.forward', data: {} });

// Current route (retained state)
client.publish({
  topic: 'nav.route.state',
  data: { route: '/users/123', params: { id: 123 } },
  retain: true
});

// Events
'nav.navigated'        # After navigation completes
'nav.error'            # Navigation failed
```

### UI Components

```javascript
// Modal
'ui.modal.open'        # Command
'ui.modal.close'       # Command
'ui.modal.opened'      # Event
'ui.modal.closed'      # Event
'ui.modal.state'       # Retained state

// Sidebar
'ui.sidebar.toggle'    # Command
'ui.sidebar.open'      # Command
'ui.sidebar.close'     # Command
'ui.sidebar.state'     # Retained state

// Toast/Notifications
'ui.toast.show'        # Command
'ui.toast.hide'        # Command

// Loading
'ui.loading.start'     # Command
'ui.loading.stop'      # Command
'ui.loading.state'     # Retained state
```

### Data Sync

```javascript
// Initial load
const response = await client.request('users.list.get', {});

// Publish state
client.publish({
  topic: 'users.list.state',
  data: { items: response.data.items },
  retain: true
});

// Subscribe to changes
client.subscribe('users.item.updated', (msg) => {
  // Update item in list
  const items = getCurrentItems();
  const index = items.findIndex(u => u.id === msg.data.item.id);
  if (index >= 0) {
    items[index] = msg.data.item;

    // Update state
    client.publish({
      topic: 'users.list.state',
      data: { items },
      retain: true
    });
  }
});

client.subscribe('users.item.deleted', (msg) => {
  // Remove item from list
  const items = getCurrentItems().filter(u => u.id !== msg.data.id);

  // Update state
  client.publish({
    topic: 'users.list.state',
    data: { items },
    retain: true
  });
});
```

### Real-time Updates

```javascript
// Server sends updates
function handleServerUpdate(update) {
  client.publish({
    topic: `users.item.state.${update.userId}`,
    data: {
      id: update.userId,
      online: update.online,
      typing: update.typing,
      lastSeen: update.lastSeen
    },
    retain: true
  });
}

// UI subscribes
client.subscribe('users.item.state.*', (msg) => {
  updateUserPresence(msg.data);
});
```

---

## Topic Catalog Template

For larger applications, maintain a topic catalog:

```javascript
// topics.js
export const TOPICS = {
  // Users
  USERS: {
    LIST: {
      STATE: 'users.list.state',
      GET: 'users.list.get'
    },
    ITEM: {
      GET: 'users.item.get',
      SAVE: 'users.item.save',
      DELETE: 'users.item.delete',
      SELECT: 'users.item.select',
      UPDATED: 'users.item.updated',
      DELETED: 'users.item.deleted',
      STATE: (id) => `users.item.state.${id}`
    }
  },

  // Navigation
  NAV: {
    GOTO: 'nav.goto',
    BACK: 'nav.back',
    FORWARD: 'nav.forward',
    ROUTE_STATE: 'nav.route.state',
    NAVIGATED: 'nav.navigated'
  },

  // Auth
  AUTH: {
    LOGIN: 'auth.login',
    LOGOUT: 'auth.logout',
    SESSION_STATE: 'auth.session.state'
  }
};

// Usage
client.publish({
  topic: TOPICS.USERS.ITEM.UPDATED,
  data: { item: user }
});

client.subscribe(TOPICS.NAV.GOTO, (msg) => {
  router.navigateTo(msg.data.route);
});
```

---

## Summary

**Key Principles:**
1. Use `resource.action.qualifier` format
2. Use `.state` suffix for retained topics
3. Use past tense for events, imperative for commands
4. Be consistent across your application
5. Avoid `pan:*` and `sys:*` namespaces

**For more:**
- [API Reference](./API_REFERENCE.md) - Complete API documentation
- [API Stability](./API_STABILITY.md) - Stability guarantees

---

**Last Updated:** November 2024
