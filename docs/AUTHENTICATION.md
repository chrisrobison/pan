# PAN Authentication System

Complete JWT authentication with automatic header injection - **zero manual header management required**.

## 🎯 Key Features

- ✅ **Automatic header injection** - Developers never write `Authorization: Bearer ${token}`
- ✅ **Declarative setup** - Drop `<pan-auth>` on the page, done
- ✅ **Auto-refresh tokens** - Refresh before expiry, no expired token errors
- ✅ **Works everywhere** - REST, GraphQL, custom fetches
- ✅ **Zero build** - Plain JavaScript, no configuration
- ✅ **Loose coupling** - Components don't know auth exists

## Quick Start

```html
<!DOCTYPE html>
<meta charset="utf-8">
<script type="module" src="./pan/core/pan-autoload.mjs"></script>

<!-- 1. Auth Manager -->
<pan-auth storage="localStorage" auto-refresh="true"></pan-auth>

<!-- 2. Data Connector (auto-adds auth headers!) -->
<pan-data-connector resource="users" base-url="/api"></pan-data-connector>

<!-- 3. Your components (don't know about auth!) -->
<user-list></user-list>

<script type="module">
  import { PanClient } from './pan/core/pan-client.mjs';
  const pc = new PanClient();

  // Login - that's it!
  await pc.request('auth.login', {
    email: 'user@example.com',
    password: 'password123'
  });

  // Now all requests automatically include auth header
  pc.publish({ topic: 'users.list.get', data: {} });
</script>
```

## Architecture

```
┌─────────────────┐
│   <pan-auth>    │  ← Manages JWT tokens, login/logout, auto-refresh
│   Auth Manager  │     Publishes: auth.state (retained)
└────────┬────────┘
         │
         ▼ (listens to auth.internal.state)
┌─────────────────┐
│<pan-connector>  │  ← Auto-injects Authorization: Bearer ${token}
│ Data Connector  │     Works with ANY HTTP request
└─────────────────┘
```

### How It Works

1. **`<pan-auth>`** manages token lifecycle
   - Stores tokens in localStorage/sessionStorage/memory
   - Publishes `auth.internal.state` with token (for connectors)
   - Publishes `auth.state` without token (for UI components)

2. **Connectors** (`pan-data-connector`, `pan-graphql-connector`)
   - Subscribe to `auth.internal.state`
   - Automatically inject `Authorization` header if token exists
   - Developers never touch headers!

3. **Components** work as normal
   - Just publish/subscribe topics
   - Don't know auth exists
   - No imports, no config

---

## Components

### `<pan-auth>` - Authentication Manager

Manages JWT authentication state via PAN message bus.

#### Attributes

```html
<pan-auth
  storage="localStorage"          <!-- localStorage | sessionStorage | memory -->
  token-key="pan_jwt"              <!-- Key for storing token -->
  refresh-key="pan_refresh_jwt"   <!-- Key for storing refresh token -->
  auto-refresh="true"              <!-- Enable automatic token refresh -->
  refresh-before="300"             <!-- Refresh N seconds before expiry -->
  login-endpoint="/api/auth/login"    <!-- Login API endpoint -->
  refresh-endpoint="/api/auth/refresh" <!-- Refresh API endpoint -->
  logout-endpoint="/api/auth/logout">  <!-- Logout API endpoint -->
</pan-auth>
```

#### Topics

**Commands (publish these):**

```javascript
// Login
await pc.request('auth.login', {
  email: 'user@example.com',
  password: 'password123'
});
// Response: { ok: true, user: {...} }

// Logout
pc.publish({ topic: 'auth.logout', data: {} });

// Refresh token (usually automatic)
pc.publish({ topic: 'auth.refresh', data: {} });

// Set token directly (external login)
pc.publish({
  topic: 'auth.setToken',
  data: {
    token: 'eyJhbGc...',
    refreshToken: 'refresh...',
    user: { id: 1, email: 'user@example.com' }
  }
});

// Check current auth state
pc.publish({ topic: 'auth.check', data: {} });
```

**Events (subscribe to these):**

```javascript
// Auth state changed (retained)
pc.subscribe('auth.state', msg => {
  console.log('Authenticated:', msg.data.authenticated);
  console.log('User:', msg.data.user);
  console.log('Expires at:', msg.data.expiresAt);
}, { retained: true });

// Login events
pc.subscribe('auth.login.success', msg => {
  console.log('Login successful:', msg.data.user);
});

pc.subscribe('auth.login.error', msg => {
  console.error('Login failed:', msg.data.error);
});

// Logout event
pc.subscribe('auth.logout.success', () => {
  console.log('Logged out');
});

// Refresh events
pc.subscribe('auth.refresh.success', () => {
  console.log('Token refreshed');
});

pc.subscribe('auth.refresh.error', msg => {
  console.error('Refresh failed:', msg.data.error);
});
```

**Published State:**

```javascript
// auth.state (public - for UI components)
{
  authenticated: true,
  user: {
    id: 1,
    email: 'user@example.com',
    name: 'John Doe',
    role: 'admin'
  },
  expiresAt: 1234567890000,
  hasRefreshToken: true
}

// auth.internal.state (internal - for connectors)
{
  authenticated: true,
  token: 'eyJhbGc...', // <-- Includes actual token!
  refreshToken: 'refresh...',
  user: {...},
  expiresAt: 1234567890000
}
```

---

### Enhanced Connectors

All connectors automatically inject auth headers when available.

#### `<pan-data-connector>` (REST)

```html
<pan-data-connector
  resource="users"
  base-url="/api">
</pan-data-connector>

<script type="module">
  import { PanClient } from './pan/core/pan-client.mjs';
  const pc = new PanClient();

  // This request automatically includes:
  // Authorization: Bearer eyJhbGc...
  pc.publish({ topic: 'users.list.get', data: {} });
</script>
```

#### `<pan-graphql-connector>`

```html
<pan-graphql-connector
  resource="users"
  endpoint="/api/graphql">
  <script type="application/graphql" data-op="list">
    query GetUsers {
      users { id name email role }
    }
  </script>
</pan-graphql-connector>

<script type="module">
  import { PanClient } from './pan/core/pan-client.mjs';
  const pc = new PanClient();

  // GraphQL request automatically includes:
  // Authorization: Bearer eyJhbGc...
  pc.publish({ topic: 'users.list.get', data: {} });
</script>
```

---

### `panFetch` - Authenticated Fetch Utility

For custom API calls, use `panFetch` - a drop-in replacement for `fetch()` that auto-injects auth headers.

```javascript
import { panFetch } from './pan/core/pan-fetch.mjs';

// Automatically includes Authorization header if logged in
const response = await panFetch.fetch('/api/users');
const data = await response.json();

// Convenience methods
const users = await panFetch.get('/api/users');
const newUser = await panFetch.post('/api/users', { name: 'John' });
const updated = await panFetch.put('/api/users/1', { name: 'Jane' });
await panFetch.delete('/api/users/1');

// Check auth status
if (panFetch.isAuthenticated()) {
  console.log('User is logged in');
}
```

**API:**

```javascript
panFetch.fetch(url, options)       // Drop-in replacement for fetch()
panFetch.fetchJson(url, options)   // Fetch + auto JSON parse + error handling
panFetch.get(url, options)         // GET with JSON
panFetch.post(url, body, options)  // POST with JSON
panFetch.put(url, body, options)   // PUT with JSON
panFetch.patch(url, body, options) // PATCH with JSON
panFetch.delete(url, options)      // DELETE with JSON
panFetch.isAuthenticated()         // Check if logged in
panFetch.getAuthState()            // Get current auth state
```

---

## Complete Example

### Login Component

```javascript
customElements.define('login-form', class extends HTMLElement {
  connectedCallback() {
    this.pc = new PanClient(this);

    this.innerHTML = `
      <form id="login">
        <input name="email" type="email" required>
        <input name="password" type="password" required>
        <button>Login</button>
      </form>
    `;

    this.querySelector('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      try {
        const response = await this.pc.request('auth.login', {
          email: formData.get('email'),
          password: formData.get('password')
        });

        if (response.data.ok) {
          console.log('Logged in!', response.data.user);
        }
      } catch (error) {
        console.error('Login failed:', error);
      }
    });

    // Listen for login events
    this.pc.subscribe('auth.login.success', msg => {
      alert(`Welcome, ${msg.data.user.name}!`);
    });

    this.pc.subscribe('auth.login.error', msg => {
      alert(`Login failed: ${msg.data.error}`);
    });
  }
});
```

### Protected Component

```javascript
customElements.define('user-list', class extends HTMLElement {
  connectedCallback() {
    this.pc = new PanClient(this);

    // Subscribe to auth state
    this.pc.subscribe('auth.state', msg => {
      if (msg.data.authenticated) {
        // User logged in - fetch data
        // Auth header automatically injected by connector!
        this.pc.publish({ topic: 'users.list.get', data: {} });
      } else {
        // User logged out - show login prompt
        this.innerHTML = '<p>Please log in to view users.</p>';
      }
    }, { retained: true });

    // Subscribe to users data
    this.pc.subscribe('users.list.state', msg => {
      this.renderUsers(msg.data.items);
    }, { retained: true });
  }

  renderUsers(users) {
    this.innerHTML = `
      <ul>
        ${users.map(u => `<li>${u.name} (${u.email})</li>`).join('')}
      </ul>
    `;
  }
});
```

---

## Token Refresh

### Automatic Refresh

`<pan-auth>` automatically refreshes tokens before they expire:

```html
<pan-auth
  auto-refresh="true"
  refresh-before="300">  <!-- Refresh 5 minutes before expiry -->
</pan-auth>
```

**How it works:**

1. `pan-auth` decodes JWT to get expiration time
2. Schedules refresh 5 minutes (300 seconds) before expiry
3. Calls `refresh-endpoint` with current token
4. Updates token silently
5. Publishes updated `auth.state`

### Manual Refresh

```javascript
// Manually trigger refresh
pc.publish({ topic: 'auth.refresh', data: {} });

// Listen for refresh events
pc.subscribe('auth.refresh.success', () => {
  console.log('Token refreshed successfully');
});

pc.subscribe('auth.refresh.error', msg => {
  console.error('Refresh failed:', msg.data.error);
  // Token expired - redirect to login
  window.location.href = '/login';
});
```

---

## Storage Options

### localStorage (default)

Tokens persist across browser restarts.

```html
<pan-auth storage="localStorage"></pan-auth>
```

### sessionStorage

Tokens cleared when browser tab closes.

```html
<pan-auth storage="sessionStorage"></pan-auth>
```

### memory

Tokens only in memory - cleared on page refresh.

```html
<pan-auth storage="memory"></pan-auth>
```

---

## Backend Integration

### Expected API Endpoints

#### Login: `POST /api/auth/login`

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200 OK):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

**Response (401 Unauthorized):**
```json
{
  "error": "Invalid email or password"
}
```

#### Refresh: `POST /api/auth/refresh`

**Request Headers:**
```
Authorization: Bearer refresh_token_here
```

**Request Body:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response (200 OK):**
```json
{
  "token": "new_access_token",
  "refreshToken": "new_refresh_token",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "name": "John Doe",
    "role": "admin"
  }
}
```

#### Logout: `POST /api/auth/logout`

**Request Headers:**
```
Authorization: Bearer access_token_here
```

**Response (200 OK):**
```json
{
  "ok": true
}
```

### Protected Endpoints

All requests automatically include `Authorization` header:

```
GET /api/users
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Backend should:
1. Extract token from `Authorization: Bearer <token>`
2. Validate token (signature, expiration)
3. Return 401 if invalid/expired
4. Return data if valid

---

## Security Best Practices

### 1. Token Storage

- ✅ **Use `localStorage`** for persistent sessions
- ✅ **Use `sessionStorage`** for temporary sessions
- ✅ **Use `memory`** for maximum security (no persistence)
- ❌ **Never** store tokens in cookies (CSRF risk)

### 2. Token Expiration

- ✅ Keep access tokens short-lived (15-60 minutes)
- ✅ Keep refresh tokens longer (7-30 days)
- ✅ Enable auto-refresh to avoid expired token errors

### 3. HTTPS Only

- ✅ Always use HTTPS in production
- ✅ Tokens should never be sent over HTTP

### 4. Token Validation

Backend must:
- ✅ Validate JWT signature
- ✅ Check expiration time
- ✅ Validate token hasn't been revoked
- ✅ Return 401 for invalid tokens

### 5. Sensitive Data

- ✅ `auth.state` is public - safe for UI
- ⚠️ `auth.internal.state` includes token - only for connectors
- ❌ Never expose tokens to console.log in production

---

## Examples

### 📁 `/examples/auth-demo.html`

Complete authentication demo with:
- Login form
- Protected user list
- Auto-header injection
- Mock backend API

```bash
# Open in browser
open examples/auth-demo.html
```

### 📁 `/examples/mock-auth-api.mjs`

Client-side JWT simulator for testing:
- Intercepts `/api/*` requests
- Simulates login/refresh/logout
- Validates tokens
- Test credentials included

**Test Credentials:**
- `admin@example.com` / `admin123`
- `user@example.com` / `user123`
- `demo@example.com` / `demo`

---

## Migration Guide

### From Manual Headers

**Before:**
```javascript
const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${token}` // Manual!
  }
});
```

**After:**
```javascript
// Just use the connector - header automatically added!
pc.publish({ topic: 'users.list.get', data: {} });

// Or use panFetch for custom calls
const response = await panFetch.fetch('/api/users');
```

### From External Auth

If you have an existing auth system:

```javascript
// After login with your system, set the token
pc.publish({
  topic: 'auth.setToken',
  data: {
    token: yourAccessToken,
    refreshToken: yourRefreshToken,
    user: { id: 1, email: 'user@example.com', name: 'John' }
  }
});

// Now all PAN requests include the token automatically
```

---

## Troubleshooting

### Tokens not being sent

**Check:**
1. Is `<pan-auth>` on the page?
2. Is user logged in? Check `auth.state`
3. Are connectors after `<pan-auth>` in HTML?

```javascript
// Debug auth state
pc.subscribe('auth.state', msg => {
  console.log('Auth State:', msg.data);
}, { retained: true });

pc.publish({ topic: 'auth.check', data: {} });
```

### 401 Errors after login

**Check:**
1. Token format correct? Should be JWT
2. Backend validating token correctly?
3. Token not expired?

```javascript
// Check token expiration
pc.subscribe('auth.state', msg => {
  const exp = new Date(msg.data.expiresAt);
  console.log('Token expires:', exp);
  console.log('Time until expiry:', Math.floor((msg.data.expiresAt - Date.now()) / 1000), 'seconds');
}, { retained: true });
```

### Auto-refresh not working

**Check:**
1. `auto-refresh="true"` on `<pan-auth>`?
2. `refresh-endpoint` correct?
3. Refresh token available?

```javascript
// Monitor refresh events
pc.subscribe('auth.refresh.success', () => {
  console.log('✓ Token refreshed');
});

pc.subscribe('auth.refresh.error', msg => {
  console.error('✗ Refresh failed:', msg.data.error);
});
```

---

## FAQ

**Q: Do I need to import anything in my components?**
A: No! Components just publish/subscribe topics. Auth is completely transparent.

**Q: What if I need a different auth header format?**
A: Connectors use `Authorization: Bearer ${token}` by default. For custom formats, modify the connector or use `panFetch` with custom headers.

**Q: Can I use this with OAuth/SSO?**
A: Yes! After OAuth callback, use `auth.setToken` to inject the token into PAN.

**Q: Does this work with GraphQL?**
A: Yes! `<pan-graphql-connector>` auto-injects headers just like REST connector.

**Q: How do I handle token expiration?**
A: Enable `auto-refresh="true"`. Tokens refresh automatically before expiry.

**Q: Can I test without a backend?**
A: Yes! Use `/examples/mock-auth-api.mjs` - a client-side JWT simulator.

---

## Summary

**Zero manual header management:**

1. Drop `<pan-auth>` on page
2. Use connectors or `panFetch`
3. That's it!

**Benefits:**

- ✅ Developers never write `Authorization: Bearer ${token}`
- ✅ Components don't know auth exists
- ✅ Auto-refresh prevents expired tokens
- ✅ Works with REST, GraphQL, custom APIs
- ✅ Zero build, zero config

**Philosophy:**

Auth should be **invisible infrastructure**, not something developers think about on every request.
