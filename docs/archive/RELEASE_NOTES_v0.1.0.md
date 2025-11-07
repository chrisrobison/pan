# v0.1.0 — SSE bridge, reactive stores, and live updates

Tag: v0.1.0
Date: 2025-10-17

## Highlights
- New `<pan-sse>` element to bridge Server‑Sent Events into PAN topics.
- Tiny reactive store utils and PAN bridges:
  - `pan-store`: `createStore()`, `bind()` for form ↔ state.
  - `pan-store-pan`: `syncItem()` and `syncList()` for live item/list sync and optional auto‑save.
- Live per‑item updates across components:
  - `pan-data-table` listens to `${resource}.item.state.*` for granular updates.
  - `pan-form` follows `${resource}.item.select` and live‑syncs the selected item.
  - Data providers publish per‑item snapshots (retained) and deletions (non‑retained).
- New example: `examples/10-sse-store.html` (auto‑save store + live updates).
- Minimal Node sidecar for SSE + REST: `examples/server/sse-server.js`.
- Refreshed demo suite UI and navigation; shared styles in `examples/assets/grail.css`.

## Full Changelog
See CHANGELOG.md: 0.1.0 for detailed changes.

## Upgrade Notes
- No breaking API changes to existing components.
- For realtime flows, providers now emit per‑item state on get/save and deletion notices; consumers can opt‑in via `live` attributes (default true).

## Thanks
This release introduces realtime updates and store helpers to streamline building reactive demos and apps on the PAN bus.

