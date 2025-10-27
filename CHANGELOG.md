# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Keep a Changelog, and aims to follow Semantic Versioning.

## [Unreleased]

### Added

- **Component Autoload System** (`pan-autoload.mjs`): Automatic on-demand loading of components from the `components/` directory. No manual imports required—just use custom elements and they load automatically when approaching the viewport.
  - Configurable components path and root margin
  - Per-element module override with `data-module` attribute
  - Automatic registration of default exports

- **Router & Navigation**:
  - `<pan-router>`: URL routing with `nav.state` topic synchronization
    - History and hash mode support
    - Route guards with auth integration
    - Path parameters and query string parsing
    - Programmatic navigation via `nav.goto`, `nav.back`, `nav.forward` topics
  - `<pan-link>`: Declarative navigation links with automatic active class management
    - Exact matching support
    - Intercepts clicks for SPA navigation

- **WebSocket Bridge** (`<pan-websocket>`): Bidirectional WebSocket ↔ PAN communication
  - Automatic reconnection with exponential backoff
  - Heartbeat/ping support
  - Topic filtering for inbound and outbound messages
  - Connection status events (`ws.connected`, `ws.disconnected`, `ws.error`)

- **IndexedDB Bridge** (`<pan-idb>`): Client-side database operations via PAN topics
  - Full CRUD operations through topic-based API
  - Index support with queries
  - Multiple stores and databases
  - Automatic schema migration
  - Operations: `get`, `put`, `add`, `delete`, `clear`, `list`, `query`, `count`

- **Component Gallery** (`gallery.html`): Interactive component showcase
  - Live playground with code editor and preview
  - Search and category filtering
  - Direct links to component source code
  - Real-time examples for all components

- **New Examples**:
  - `15-router.html`: SPA routing with navigation and route parameters
  - `16-websocket.html`: Real-time chat demo with WebSocket bridge
  - `17-indexeddb.html`: Contact manager with IndexedDB persistence

- **Component Migration**: All components moved from `dist/` to `components/` with `.mjs` extension for better ES module support and consistency

### Changed

- All examples updated to use the new autoload system
- Modernized landing page (`index.html`) with hero section, features showcase, and improved documentation
- Updated README with comprehensive autoload documentation and installation instructions
- Migrated 24 component files to new `components/` directory structure

### Fixed

- `pan-form` retained subscription loop causing freeze on row click; subscribe once per selected id

### Previous Unreleased Items

- Added: Demo Browser SPA using `pan-demo-nav` and `pan-demo-viewer` over PAN `nav.*` topics
- Added: `pan-schema` and `pan-schema-form` for JSON Schema–driven UIs
- Added: `pan-php-connector` (api.php bridge) and `pan-graphql-connector` (GraphQL CRUD bridge)
- Added: Examples `09-schema-form.html`, `11-graphql-connector.html`, `12-php-connector.html`, and `pan-grid.html`

## [0.1.0] - 2025-10-17

- Added: `<pan-sse>` bridge to translate Server-Sent Events into PAN topics.
  - Attributes: `src`, `topics`, `persist-last-event`, `backoff`, `with-credentials`.
- Added: Tiny reactive store utilities.
  - `pan-store`: `createStore()`, `bind()` for wiring forms ↔ state.
  - `pan-store-pan`: `syncItem()` and `syncList()` to connect stores to PAN topics (live updates, optional auto-save).
- Added: `<pan-table>` alias for `<pan-data-table>`.
- Added: Live per-item update pathway across components.
  - `pan-data-table`: listens to `${resource}.item.state.*` for granular updates.
  - `pan-form`: follows `${resource}.item.select` and live-syncs the selected item.
  - Data providers now publish per-item snapshots (retained) and deletions (non-retained).
- Added: Example “SSE + Store (Auto‑save)” at `examples/10-sse-store.html`.
- Added: Minimal Node sidecar for SSE + REST at `examples/server/sse-server.js`.
- Changed: Refreshed demo suite UI and navigation; added shared styles at `examples/assets/grail.css`.
- Docs: Expanded README with realtime bridges and store APIs.

---

Past history (pre-0.1.0) included the initial CRUD suite, examples, and foundational PAN bus/client helpers.
