# Changelog

All notable changes to this project will be documented in this file.

This project adheres to Keep a Changelog, and aims to follow Semantic Versioning.

## [Unreleased]

- No changes yet.

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

