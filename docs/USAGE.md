# LARC (PAN) Usage Guide

This guide shows you how to use the `larc` package in your projects. LARC implements the PAN (Page Area Network) protocol for web component coordination.

## Installation

```bash
npm install larc
```

## Two Usage Patterns

PAN supports two main usage patterns:

### 1. **Bundler Pattern** (Vite, Webpack, etc.)
For modern build tools with tree-shaking and module resolution.

### 2. **CDN/Autoload Pattern** (Zero-build)
For direct browser usage without build tools.

---

## Pattern 1: Bundler Usage (with npm)

### Basic Setup

```javascript
// Import the core client
import { PanClient } from 'larc';

// Create a client (automatically ensures bus exists)
const client = new PanClient();

// Wait for bus to be ready
await client.ready();

// Publish a message
client.pub('user.login', { userId: 123, email: 'user@example.com' });

// Subscribe to messages
const unsubscribe = client.subscribe('user.*', (msg) => {
  console.log('Received:', msg.topic, msg.data);
});

// Later: unsubscribe
unsubscribe();
```

### Explicit Component Imports

```javascript
// Import specific components you need
import 'larc/components/pan-store.js';
import 'larc/components/pan-data-table.js';
import 'larc/ui/pan-card.js';
import 'larc/ui/pan-modal.js';

// Use them in your HTML
const html = `
  <pan-card>
    <h2 slot="header">My Data</h2>
    <pan-data-table topic="users.list"></pan-data-table>
  </pan-card>
`;
```

### Helper Functions

```javascript
import { ensureBus, createClient } from 'larc';

// Ensure bus exists (if not using createClient)
const bus = ensureBus();

// Or create client with automatic bus creation
const client = createClient();
```

### Request/Reply Pattern

```javascript
import { PanClient } from 'larc';

const client = new PanClient();
await client.ready();

// Set up a responder
client.subscribe('math.add', (msg) => {
  if (msg.replyTo) {
    const result = msg.data.a + msg.data.b;
    client.publish({
      topic: msg.replyTo,
      data: { result },
      correlationId: msg.correlationId
    });
  }
});

// Make a request
try {
  const reply = await client.request('math.add', { a: 5, b: 3 }, { timeoutMs: 2000 });
  console.log('Result:', reply.data.result); // 8
} catch (err) {
  console.error('Request timed out');
}
```

### TypeScript Support

TypeScript definitions are included. Your IDE will provide autocomplete and type checking:

```typescript
import { PanClient, PanMessage, PanBus } from 'larc';

const client = new PanClient();

client.subscribe('app.event', (msg: PanMessage) => {
  console.log(msg.topic, msg.data);
});
```

---

## Pattern 2: CDN/Autoload Usage (Zero-build)

### Basic Setup

```html
<!DOCTYPE html>
<html>
<head>
  <title>My PAN App</title>
</head>
<body>
  <!-- Declare components anywhere -->
  <pan-card>
    <h2 slot="header">Welcome</h2>
    <p>This card will be autoloaded!</p>
  </pan-card>

  <pan-data-table topic="users.list"></pan-data-table>

  <!-- Configure autoload for CDN -->
  <script type="module">
    window.panAutoload = {
      baseUrl: 'https://unpkg.com/larc@latest/',
      extension: '.js'
    };
  </script>

  <!-- Load autoload script -->
  <script type="module" src="https://unpkg.com/larc@latest/autoload.js"></script>

  <!-- Your app code -->
  <script type="module">
    import { PanClient } from 'https://unpkg.com/larc@latest/index.js';

    const client = new PanClient();
    await client.ready();

    client.pub('app.ready', { version: '1.0' });
  </script>
</body>
</html>
```

### Local Development (No CDN)

```html
<!DOCTYPE html>
<html>
<body>
  <pan-card>
    <h2 slot="header">Local Development</h2>
  </pan-card>

  <!-- Configure for local paths -->
  <script type="module">
    window.panAutoload = {
      componentsPath: './pan/',
      extension: '.mjs'
    };
  </script>

  <!-- Load autoload -->
  <script type="module" src="./pan/core/pan-autoload.mjs"></script>

  <script type="module">
    import { PanClient } from './pan/core/pan-client.mjs';

    const client = new PanClient();
    // Your app code...
  </script>
</body>
</html>
```

### Override Component Paths

```html
<!-- Load specific component from custom location -->
<my-custom-widget data-module="/path/to/my-widget.js"></my-custom-widget>

<!-- This will be autoloaded from the configured base -->
<pan-card></pan-card>
```

### Programmatic Component Loading

```html
<script type="module">
  import { panAutoload } from 'https://unpkg.com/larc@latest/autoload.js';

  // Manually trigger loading for a specific element
  const el = document.createElement('pan-modal');
  document.body.appendChild(el);
  await panAutoload.maybeLoadFor(el);

  // Observe a specific tree
  panAutoload.observeTree(document.getElementById('app'));
</script>
```

---

## Choosing a Pattern

### Use **Bundler Pattern** when:
- ✅ You're using a modern build tool (Vite, Webpack, Rollup, etc.)
- ✅ You want tree-shaking for optimal bundle size
- ✅ You're building a large application with many dependencies
- ✅ You need TypeScript support
- ✅ You want to import only specific components

### Use **CDN/Autoload Pattern** when:
- ✅ You want zero build step (rapid prototyping)
- ✅ You're building a simple app or demo
- ✅ You want lazy-loading of components
- ✅ You prefer HTML-first development
- ✅ You want to quickly test PAN without setup

---

## Publishing to npm

Once you've finalized your package:

```bash
# Build the package
npm run build

# Publish to npm (from dist/ folder)
cd dist
npm publish
```

The `dist/` folder contains everything needed for npm:
- `index.js` - Core bundle (bus + client)
- `index.d.ts` - TypeScript definitions
- `autoload.js` - Component autoloader
- `inspector.js` - DevTools inspector
- `components/` - All feature components
- `ui/` - UI building blocks
- `package.json` - Package manifest with exports map

---

## CDN Providers

Once published, your package will be available on these CDNs:

### unpkg
```html
<script type="module" src="https://unpkg.com/larc@1.0.0/index.js"></script>
<script type="module" src="https://unpkg.com/larc@latest/autoload.js"></script>
```

### jsDelivr
```html
<script type="module" src="https://cdn.jsdelivr.net/npm/larc@1.0.0/index.js"></script>
<script type="module" src="https://cdn.jsdelivr.net/npm/larc@latest/autoload.js"></script>
```

### esm.sh
```html
<script type="module" src="https://esm.sh/larc@1.0.0"></script>
```

---

## Examples

See the `test/` directory for working examples:
- `test-bundler-pattern.html` - Explicit imports
- `test-autoload-pattern.html` - Zero-build autoload

See the `examples/` directory for more comprehensive demos.

---

## Next Steps

- 📖 Read the [PAN Specification](PAN_SPEC.v1.md)
- 🔧 Check out the [component documentation](COMPONENTS.md)
- 🎨 Explore [demo applications](apps/)
- 🐛 Use the [Inspector](pan/app/pan-inspector.mjs) for debugging
