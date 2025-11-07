# PAN v1 — Page Area Network (Concise Spec)

PAN is a DOM‑native message bus and topic convention for web UI interop. It enables loose coupling between components by communicating via CustomEvents instead of imports.

Non‑goals: distributed consensus, cross‑origin guarantees, security. PAN is for in‑page (and optional same‑origin) coordination.

## Envelope

Message fields:

- topic: string (e.g., `users.list.state`, `nav.goto`)
- data: any JSON‑serializable payload
- id?: string (UUID)
- ts?: number (ms epoch)
- replyTo?: string (topic to send reply)
- correlationId?: string (request/reply correlation)
- retain?: boolean (snapshot; last message per topic is replayed to retained subscribers)
- headers?: Record<string,string> (optional metadata)

## Transport

- Events bubble and are composed to cross shadow DOM:
  - publish: `CustomEvent('pan:publish', { detail: PanMessage, bubbles:true, composed:true })`
  - subscribe: `CustomEvent('pan:subscribe', { detail: { topics: string[], options?:{retained?:boolean} } })`
  - unsubscribe: `CustomEvent('pan:unsubscribe', { detail: { topics: string[] } })`
  - deliver (from bus to client): `CustomEvent('pan:deliver', { detail: PanMessage })`
- The bus is a custom element `<pan-bus>` that listens at the document root.
- Ready signal: bus dispatches `pan:sys.ready` once connected.

## Topic Patterns

- Dotted segments, e.g., `resource.section.action`.
- Wildcard `*` matches a single segment: `foo.*` matches `foo.bar` but not `foo.bar.baz`.
- Exact match otherwise.

## Semantics

- Retained: if `retain:true`, the bus stores the last message per `topic` and will deliver it immediately to subscribers that opted in (`options.retained===true`).
- Request/Reply: sender sets `replyTo` and `correlationId`; a provider replies by publishing on `replyTo` with the same `correlationId`.
- Late joiners: use retained topics or a list/get pattern.

## CRUD Topic Conventions (v1)

- List: `${resource}.list.get` → replies `{ items }` and publishes `${resource}.list.state` (retain:true)
- Select: `${resource}.item.select` with `{ id }` (view event, no reply)
- Get: `${resource}.item.get` with `{ id }` → replies `{ ok, item? }`
- Save: `${resource}.item.save` with `{ item }` → replies `{ ok, item }`; provider updates list state
- Delete: `${resource}.item.delete` with `{ id }` → replies `{ ok, id }`; provider updates list state
- Per‑item state: `${resource}.item.state.${id}` with `{ item }`, `{ patch }`, or `{ id, deleted:true }`

## Compliance

An implementation is PAN v1 compliant if it provides:

1. Bus element that supports publish/subscribe with wildcard matching and retained delivery.
2. Request/reply via `replyTo`/`correlationId` (best‑effort delivery within a page).
3. `pan:sys.ready` readiness signal.
4. Topic matching semantics: `*` is single‑segment.

Optional:

- Inspector tooling, cross‑tab mirroring, connectors/bridges (SSE, Workers, REST, GraphQL, PHP).

## Reference Implementation

- `<pan-bus>` and `PanClient` are the reference implementations included in this repo (`dist/pan-bus.js`, `dist/pan-client.js`).
- A conformance page is available at `conformance/index.html`.

## Badge

Implementations that pass the conformance page may use the badge: `badges/pan-v1.svg`.

