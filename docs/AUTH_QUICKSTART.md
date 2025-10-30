# Authentication Quick Start

**TL;DR:** Drop `<pan-auth>` on page, never write auth headers again.

## 30 Second Setup

```html
<!DOCTYPE html>
<meta charset="utf-8">
<script type="module" src="./pan/core/pan-autoload.mjs"></script>

<!-- 1. Add auth manager -->
<pan-auth storage="localStorage" auto-refresh="true"></pan-auth>

<!-- 2. Add connector -->
<pan-data-connector resource="users" base-url="/api"></pan-data-connector>

<!-- 3. Use it! -->
<script type="module">
  import { PanClient } from './pan/core/pan-client.mjs';
  const pc = new PanClient();

  // Login
  await pc.request('auth.login', {
    email: 'user@example.com',
    password: 'pass123'
  });

  // Fetch data - auth header automatically added!
  pc.publish({ topic: 'users.list.get', data: {} });
</script>
```

Done! All requests now automatically include `Authorization: Bearer ${token}`.

## Login Component

```javascript
customElements.define('login-form', class extends HTMLElement {
  connectedCallback() {
    const pc = new PanClient(this);

    this.innerHTML = `
      <form id="login">
        <input name="email" type="email" placeholder="Email" required>
        <input name="password" type="password" placeholder="Password" required>
        <button>Login</button>
      </form>
      <div id="message"></div>
    `;

    this.querySelector('#login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);

      const result = await pc.request('auth.login', {
        email: formData.get('email'),
        password: formData.get('password')
      });

      if (result.data.ok) {
        this.querySelector('#message').textContent = 'Login successful!';
      }
    });
  }
});
```

## Protected Component

```javascript
customElements.define('user-list', class extends HTMLElement {
  connectedCallback() {
    const pc = new PanClient(this);

    // Listen for auth state
    pc.subscribe('auth.state', msg => {
      if (msg.data.authenticated) {
        // User logged in - fetch data
        pc.publish({ topic: 'users.list.get', data: {} });
      } else {
        this.innerHTML = '<p>Please log in</p>';
      }
    }, { retained: true });

    // Display users
    pc.subscribe('users.list.state', msg => {
      this.innerHTML = `<ul>${msg.data.items.map(u =>
        `<li>${u.name}</li>`
      ).join('')}</ul>`;
    }, { retained: true });
  }
});
```

## Logout Button

```javascript
document.querySelector('#logout-btn').addEventListener('click', () => {
  const pc = new PanClient();
  pc.publish({ topic: 'auth.logout', data: {} });
});
```

## Custom Fetch

For custom API calls outside connectors:

```javascript
import { panFetch } from './pan/core/pan-fetch.mjs';

// Automatically includes auth header
const users = await panFetch.get('/api/users');
const newUser = await panFetch.post('/api/users', { name: 'John' });
```

## Topics Reference

```javascript
// Login
await pc.request('auth.login', { email, password });

// Logout
pc.publish({ topic: 'auth.logout', data: {} });

// Check if logged in
pc.subscribe('auth.state', msg => {
  if (msg.data.authenticated) {
    console.log('Logged in as:', msg.data.user);
  }
}, { retained: true });

// Login events
pc.subscribe('auth.login.success', msg => {
  console.log('Welcome!', msg.data.user);
});

pc.subscribe('auth.login.error', msg => {
  console.error('Login failed:', msg.data.error);
});
```

## Test It

```bash
# Open the demo
open examples/auth-demo.html

# Test credentials:
# - admin@example.com / admin123
# - user@example.com / user123
# - demo@example.com / demo
```

## What Gets Auto-Injected

Every request automatically includes:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Works with:**
- ✅ `<pan-data-connector>` (REST API)
- ✅ `<pan-graphql-connector>` (GraphQL)
- ✅ `panFetch` (custom fetches)

**You never write:**
- ❌ `headers: { 'Authorization': ... }`
- ❌ Token management code
- ❌ Token refresh logic

## Full Documentation

See [docs/AUTHENTICATION.md](./AUTHENTICATION.md) for complete documentation.

---

**Philosophy:** Auth should be invisible infrastructure. Developers should focus on features, not plumbing.
