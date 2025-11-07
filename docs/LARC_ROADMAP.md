# LARC Roadmap (PAN)

Vision: deliver a lightweight, standards‑based alternative to heavy SPA frameworks using Web Components + PAN as the decoupled communication backbone. Components interoperate with vanilla JS or frameworks (React/Vue/Lit) without build steps, JSX, or globals. Heavy work runs in Web Workers to keep the UI snappy.

Principles

- Lightweight: pure ESM, no build required, no JSX in core.
- Modular: many small web components composed via PAN topics.
- Interop: adapters optional; core stays framework‑agnostic.
- Opinionated simplicity: clear topic contracts; predictable defaults.
- Performance: offload compute/fetch to Workers; retain state for late joiners.

Scope & Parity Goals (sans SSR)

- Components: custom elements with Shadow DOM, slots, CSS parts/vars.
- State: PAN `*.state` topics as stores; retained snapshots.
- Effects: subscribe/unsubscribe in component lifecycle.
- Routing: `<pan-router>` publishes `nav.state`; link helpers.
- Forms: `<pan-form>` + `<pan-schema-form>` (JSON Schema).
- Tables/Lists: `<pan-data-table>` + query orchestration.
- Data: REST/GraphQL connectors, IndexedDB cache, WebSocket/SSE bridge.
- DevTools: `<pan-inspector>` traffic console, export/import, replay.
- Workers: `<pan-worker>` and worker RPC for heavy/long tasks.

Proposed Next Steps

1) Workers & Query Orchestration
- Implement `<pan-worker>` (topic bridge to a Worker; publish results as PAN messages).
- Add example offloading filter/sort/paginate of 10k rows to a Worker.
- Publish computed `${resource}.list.state` from worker; accept `${resource}.query.set`.

2) Query Orchestrator
- `<pan-query>` retains `filter/sort/page` as `${resource}.query.state` (retained).
- Issues `${resource}.list.get` with params; listens to URL params via `<pan-router>`.

3) Schema‑Driven Form
- `<pan-schema-form>` renders from JSON Schema; validates and displays errors.
- Publishes `${resource}.item.save`/`.patch`; subscribes to replies and errors.

4) Router
- `<pan-router>` syncs URL ↔ `nav.state`; link component publishes `nav.goto`.
- Guards integrate with retained `auth.state`.

5) Connectors & Cache
- GraphQL connector; IndexedDB cache layer for offline/low‑latency snapshots.
- WebSocket/SSE bridge to stream `*.state` updates in real time.

6) Inspector Enhancements
- Recorder/replayer (export/import traces), time travel, per‑topic latency.

Security & Configuration

- Mirror only explicit, non‑sensitive topics across tabs.
- Optional JSON Schema validation on publish with standardized `pan:sys.error`.

Milestones

- M1: pan-worker + workers demo + query orchestrator (basic).
- M2: schema form + router + GraphQL connector.
- M3: IndexedDB cache + SSE/WebSocket bridge + Inspector Pro.
