# Data & State Management

Components that manage application state, data persistence, and business logic.

## Components

### pan-invoice-store.mjs
State management for invoice application.

**Features:**
- LocalStorage persistence
- Multiple invoice management
- Auto-save with debouncing
- Import/Export JSON
- Coordinates state via PAN bus

**PAN Events:**
- Subscribes: `invoice.*` commands
- Publishes: `invoice.load`, `invoice.saved`, `invoice.list-updated`

**Usage:**
```html
<pan-invoice-store auto-save="true"></pan-invoice-store>

<script type="module">
  import { PanClient } from '../core/pan-client.mjs';
  const pc = new PanClient();

  // Save invoice
  pc.publish({
    topic: 'invoice.save',
    data: {}
  });

  // Listen for saves
  pc.subscribe('invoice.saved', (msg) => {
    console.log('Invoice saved:', msg.data.id);
  });
</script>
```

## Design Philosophy

Data components:
- **Manage state** - Central source of truth
- **Handle persistence** - LocalStorage, IndexedDB, etc.
- **Coordinate updates** - Broadcast changes via PAN
- **Encapsulate logic** - Business rules in one place
- **No UI** - Pure data/logic layer

## Pattern: State Management

Data components follow this pattern:

1. **Subscribe to commands** - Listen for actions (save, load, delete)
2. **Update state** - Process commands and update internal state
3. **Persist data** - Save to localStorage/IndexedDB/API
4. **Broadcast changes** - Publish state updates via PAN
5. **Coordinate components** - Keep UI in sync

## When to Use

Create a data component when you need:
- Centralized state management
- Persistent data storage
- Complex business logic
- Coordination between multiple UI components
- Separation of concerns (data from presentation)

## Example: Creating a Data Component

```javascript
export class PanDataStore extends HTMLElement {
  constructor() {
    super();
    this._data = {};
  }

  connectedCallback() {
    this._setupPanListeners();
    this._loadFromStorage();
  }

  _setupPanListeners() {
    const bus = document.querySelector('pan-bus');

    // Listen for commands
    bus.subscribe('data.save', (msg) => {
      this._save(msg.data);
    });

    bus.subscribe('data.load', (msg) => {
      this._load(msg.data.id);
    });
  }

  _save(data) {
    this._data = data;
    localStorage.setItem('mydata', JSON.stringify(data));

    // Broadcast success
    const bus = document.querySelector('pan-bus');
    bus.publish('data.saved', { id: data.id });
  }

  _load(id) {
    const data = JSON.parse(localStorage.getItem('mydata'));
    const bus = document.querySelector('pan-bus');
    bus.publish('data.loaded', data);
  }
}
```

## Dependencies

- Core: pan-bus (required for state coordination)
- Storage: Browser APIs (localStorage, IndexedDB, etc.)

## Future Components

Potential additions to this directory:
- `pan-cache.mjs` - Caching layer with TTL
- `pan-sync.mjs` - Sync state to backend
- `pan-offline.mjs` - Offline-first data management
- `pan-realtime.mjs` - Real-time data synchronization
- `pan-history.mjs` - Undo/redo state management
