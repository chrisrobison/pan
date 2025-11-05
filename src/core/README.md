# Core Infrastructure

Core PAN infrastructure components required for the system to function.

## Components

### pan-bus.mjs
**Message Bus** - Central pub/sub message bus for component communication.

- Topic-based routing with wildcard support
- Retained messages
- Cross-shadow-DOM delivery
- Request/reply pattern support

### pan-client.mjs
**Client Library** - JavaScript API for interacting with the PAN bus.

- Subscribe to topics
- Publish messages
- Request/reply helpers
- Wildcard subscriptions

### pan-autoload.mjs
**Component Autoloader** - Automatically loads PAN components from configured directory.

- Scans for pan-* components
- Lazy loading support
- Configurable component path

## Usage

These components are fundamental to PAN and should be included in every PAN application:

```html
<pan-bus></pan-bus>

<script type="module">
  import { PanClient } from './core/pan-client.mjs';

  const pc = new PanClient();
  pc.subscribe('my.topic', (msg) => {
    console.log('Received:', msg.data);
  });
</script>
```

Or use autoload to automatically import all components:

```html
<script type="module" src="./core/pan-autoload.mjs"></script>
```

## Dependencies

None - these are the foundation.
