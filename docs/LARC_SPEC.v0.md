# LARC — Page Area Network (PAN)

**Version:** 0.1 (Draft)
**Status:** Proposal
**Editors:** (add)
**License:** MIT

---

## 1. Overview

PAN is a lightweight, build-free coordination protocol and runtime for browser UIs. It provides a **page-local message bus** so Web Components (and other DOM-based widgets) can discover each other, publish/subscribe to topics, and perform request/response without framework coupling.

### 1.1 Goals

* Simple to adopt: add a `<pan-bus>` element; components publish/subscribe via DOM events.
* Framework-agnostic: usable from Web Components, React/Vue/Svelte, vanilla JS, iframes.
* Loose coupling: components depend on topic contracts, not concrete peers.
* Inspectable: traffic can be recorded, replayed, and validated.
* No build required; no global singletons required.

### 1.2 Non‑Goals

* Not a full state management framework.
* Not a routing standard (though topics may carry navigation intents).
* Not a network protocol; transport is strictly in‑page unless extended.

---

## 2. Terminology

* **Bus**: the orchestrator custom element `<pan-bus>`; maintains topic registry and relays messages.
* **Client**: any producer/consumer of PAN messages (custom element, script, iframe).
* **Topic**: string identifier for a message category, namespaced (e.g., `pan:user.update`).
* **Message**: immutable payload published on a topic.
* **Session**: lifetime of a bus instance in a page/document.

---

## 3. Architecture

* A single `<pan-bus>` instance per document is recommended (multiple allowed with explicit scoping).
* Clients communicate with the bus via **DOM `CustomEvent`s** (primary transport).
* Optional mirrors: `BroadcastChannel` (cross‑tab), `postMessage` to sandboxed iframes, `SharedWorker` cache layer.

```html
<pan-bus id="bus" version="0.1"></pan-bus>
```

---

## 4. Message Model

### 4.1 Type Definition (TypeScript-flavored)

```ts
interface PanMessage<T=unknown> {
  topic: string;                 // e.g., "pan:user.update"
  data: T;                       // JSON-serializable payload
  id?: string;                   // ULID/UUID; assigned by bus if missing
  ts?: number;                   // ms since epoch; assigned by bus if missing
  source?: string;               // client ID or element tag/id
  replyTo?: string;              // topic for replies (RR pattern)
  correlationId?: string;        // to join requests/replies
  qos?: 0 | 1;                   // 0=fire-and-forget, 1=at-least-once w/ ack
  retain?: boolean;              // retain last message on topic
  ttlMs?: number;                // soft expiration
  headers?: Record<string,string>; // meta: schema, version, trace, etc.
}
```

### 4.2 Event Envelopes

All API interactions use bubbling, composed `CustomEvent` objects so they cross shadow DOM boundaries.

```ts
interface PanPublishEvent extends CustomEvent<PanMessage> {
  type: 'pan:publish';
}
interface PanSubscribeEvent extends CustomEvent<PanSubscribe> {
  type: 'pan:subscribe';
}
interface PanUnsubscribeEvent extends CustomEvent<PanUnsubscribe> {
  type: 'pan:unsubscribe';
}
interface PanRequestEvent extends CustomEvent<PanMessage> {
  type: 'pan:request';           // expects reply
}
interface PanReplyEvent extends CustomEvent<PanMessage> {
  type: 'pan:reply';
}
interface PanHelloEvent extends CustomEvent<PanHello> {
  type: 'pan:hello';             // discovery
}
interface PanAckEvent extends CustomEvent<PanAck> {
  type: 'pan:ack';               // QoS1 ack from bus→client or client→bus
}
```

All events **must** be dispatched with `{ bubbles: true, composed: true }`.

---

## 5. Topics & Namespacing

* Hierarchical dotted paths, lowercase kebab tokens: `pan:user.update`, `pan:navigation.goto`.
* Wildcards (subscription only): `pan:user.*`, `*` (all topics) — optional depending on security policy.
* Versioning: suffix or header, e.g., `pan:user.update@2` **or** `headers['schema'] = 'pan:user.update@2'`.
* Reserved prefixes: `pan:$` for control/meta; `pan:sys.*` for bus diagnostics.

---

## 6. Discovery

Clients announce themselves and capabilities.

```ts
interface PanHello { id?: string; caps?: string[]; wants?: string[]; version?: string }
// Client → Bus
node.dispatchEvent(new CustomEvent('pan:hello', { detail: { id: 'x-foo#1', caps:['ui','fetch'] }, bubbles:true, composed:true }));
// Bus → Client reply on 'pan:$hello.reply'
```

Bus maintains a registry of `clientId → { element, caps }` for inspection and targeted messaging.

---

## 7. Subscription API

```ts
interface PanSubscribe {
  clientId?: string;             // bus assigns if absent
  topics: string[];              // allowed wildcards if policy permits
  options?: {
    retained?: boolean;          // immediately receive last retained message per topic
    filter?: Record<string, unknown>; // optional header/data matchers
    signal?: AbortSignal;        // auto-unsubscribe on abort
  }
}
```

* Bus emits messages to subscribers via a **DOM event** targeted at the subscriber element:

  * Event type: `pan:deliver`
  * `detail`: `PanMessage`
* Unsubscribe mirrors subscribe with `PanUnsubscribe` (same shape, or `signal.abort()`).

---

## 8. Publish & Request/Reply

### 8.1 Publish

```js
node.dispatchEvent(new CustomEvent('pan:publish', {
  detail: { topic:'pan:user.update', data:{ id:'u1', name:'Ada' }, retain:true },
  bubbles:true, composed:true
}));
```

### 8.2 Request/Reply

```js
// Requester
const correlationId = crypto.randomUUID();
node.dispatchEvent(new CustomEvent('pan:request', {
  detail: { topic:'pan:data.get', data:{ key:'users' }, replyTo:'pan:$reply', correlationId },
  bubbles:true, composed:true
}));
// Replier (subscriber to pan:data.get)
// on receipt, reply
node.dispatchEvent(new CustomEvent('pan:reply', {
  detail: { topic:'pan:$reply', correlationId, data:{ users:[/*...*/] } },
  bubbles:true, composed:true
}));
```

* Bus may provide a convenience RPC wrapper (see §13 Helper API).

---

## 9. QoS & Backpressure

* `qos:0` (default): deliver best-effort; no ack.
* `qos:1`: bus requires a `pan:ack` from each subscribed client; if missing after `ackTimeoutMs`, it retries or logs.
* Bus implements **coalescing** per topic and optional **rate limits** per publisher. Recommended defaults:

  * `deliverBatchMax=64`, `deliverIntervalMs=8`, `maxQueueDepth=10_000` (drop oldest with warning when exceeded).

---

## 10. Retained Messages & Snapshots

* If `retain:true`, bus stores the **last** message per topic and immediately delivers it to new subscribers (if `options.retained`).
* Bus exposes snapshot API via control topic `pan:sys.snapshot` returning `{ topics: string[], counts, retained }`.

---

## 11. Schema & Validation

* Each topic **should** define a JSON Schema (`$id = topic@version`).
* Bus can validate on publish; invalid messages produce `pan:sys.error` with `{ code:'SCHEMA_VIOLATION', details }`.
* Suggested headers: `headers: { schema: 'pan:user.update@2' }`.

---

## 12. Security Model

* **Trust domains**:

  * Same-origin components: full access by default.
  * Cross-origin iframes: must communicate via a gateway component (see §15) with an allowlist.
* **Permissions**: optional policy map `topic → { publish:[roles], subscribe:[roles] }`.
* **Sanitization**: data must be JSON-serializable; functions/DOM nodes rejected.
* **Isolation**: sensitive providers can be sandboxed in iframes; gateway validates topics & schemas.

---

## 13. Helper API (Reference)

A tiny helper for clients; pure ES module, no build.

```ts
class PanClient {
  constructor(host: HTMLElement | Document = document, busSelector = 'pan-bus') {}
  async ready(): Promise<void> {}
  publish<T>(msg: PanMessage<T>): void {}
  subscribe(topics: string | string[], handler: (m: PanMessage)=>void, opts?: { retained?: boolean, signal?: AbortSignal }): () => void {}
  request<TReq, TRes>(topic: string, data: TReq, opts?: { timeoutMs?: number, schema?: string }): Promise<PanMessage<TRes>> {}
}
```

Minimal semantics:

* `ready()` resolves when the bus announces `pan:sys.ready`.
* `subscribe()` returns an unsubscribe function and auto-uses an `AbortSignal` if provided.
* `request()` handles correlation, temporary `replyTo`, and timeout.

---

## 14. Control & Diagnostics Topics

* `pan:sys.ready` — fired when bus starts.
* `pan:sys.clients` — query list of clients/caps.
* `pan:sys.snapshot` — retained topics & counts.
* `pan:sys.log` — structured log stream from bus.
* `pan:sys.error` — standardized errors:

```ts
interface PanError { code: string; message: string; cause?: unknown; correlationId?: string }
```

---

## 15. Cross‑Context Bridges (Optional)

* **BroadcastChannel('pan')** mirror for multi‑tab sync:

  * Mirrored topics must be declared in bus attr: `mirror-topics="pan:user.* pan:settings.*"`.
* **Iframe Gateway**:

  * Embedded `<pan-gateway target="https://example.com" allow-topics="pan:public.*">` translates PAN⇆`postMessage`.
  * Gateway validates `origin`, topic allowlist, and schemas.
* **SharedWorker cache** for data providers to dedupe network fetches across tabs.

---

## 16. Lifecycle

* Bus boot:

  1. Initialize registries and retained store
  2. Attach listeners for `pan:*` events at `document`
  3. Emit `pan:sys.ready`

* Client boot:

  1. Wait for `pan:sys.ready` (or poll for `pan-bus`)
  2. Dispatch `pan:hello`
  3. Subscribe to topics

* Cleanup: clients must unsubscribe or provide `AbortSignal`; bus purges dead targets on GC signals or delivery failures.

---

## 17. Shadow DOM Rules

* All bus-bound events **must** use `{ bubbles:true, composed:true }`.
* Delivery events target the subscriber element; for closed shadow roots, delivery targets the host element.

---

## 18. Versioning & Capability Negotiation

* Semver for topic schemas; clients may advertise `caps: ['pan:user.update@^2', 'pan:data.get@~1.3']`.
* Bus exposes `supports(schemaRange: string): boolean` via control request `pan:$supports`.

---

## 19. Performance Guidance

* Prefer coarse topics plus fine-grained fields over chatty micro-topics.
* Batch deliveries per animation frame; coalesce duplicate retained updates.
* Avoid large payloads (>100KB); use references to caches or streams.

---

## 20. Accessibility Guidance

* PAN must not be the only trigger path; all user actions should map to semantic controls.
* Announce significant state changes via ARIA‑friendly components, not just PAN traffic.

---

## 21. Compliance Tests (CT)

* CT‑01: subscribe receives retained on join when `retained:true`.
* CT‑02: wildcard subscription respects allowlist.
* CT‑03: request/reply correlation within timeout.
* CT‑04: schema validation rejects and logs error.
* CT‑05: shadow DOM crossing works with `composed:true`.

---

## 22. Minimal Reference Implementation Sketch

```html
<pan-bus id="bus"></pan-bus>
<script type="module">
class PanBus extends HTMLElement {
  registry = new Map();        // clientId -> element
  subs = new Map();            // topic -> Set(clientId)
  retained = new Map();        // topic -> PanMessage
  connectedCallback() {
    this.addEventListener('pan:publish', this.onPublish, { capture:true });
    this.addEventListener('pan:request', this.onRequest, { capture:true });
    this.addEventListener('pan:reply', this.onReply, { capture:true });
    this.addEventListener('pan:subscribe', this.onSubscribe, { capture:true });
    this.addEventListener('pan:unsubscribe', this.onUnsubscribe, { capture:true });
    this.addEventListener('pan:hello', this.onHello, { capture:true });
    queueMicrotask(()=>document.dispatchEvent(new CustomEvent('pan:sys.ready', { bubbles:true, composed:true })));
  }
  // ...handlers deliver via target.dispatchEvent(new CustomEvent('pan:deliver', {detail:m}))
}
customElements.define('pan-bus', PanBus);
</script>
```

---

## 23. Example Topics (Starter Set)

* `pan:navigation.goto` — `{ href:string, replace?:boolean }`
* `pan:user.update` — `{ id:string, name?:string, email?:string }`
* `pan:settings.set` — `{ key:string, value:any }`
* `pan:data.get` / `pan:data.put` — `{ key:string, value?:any }`

---

## 24. Open Questions

* Should the bus support Streams (ReadableStream) as payload references?
* Built‑in persistence (IndexedDB) for retained topics?
* Formal ACL spec vs pluggable policy hooks?

---

## 25. Next Steps

* Publish JSON Schemas for starter topics.
* Ship `pan-client` helper (1KB gz).
* Build PAN Inspector (traffic console + replay).
* Author compliance test suite (Web Test Runner).

---

## 26. CRUD Suite v1 (Draft)

This section specifies a minimal, interoperable contract for CRUD-style components communicating over PAN. It defines topics, message shapes, and component roles so tables, forms, and connectors can be mixed-and-matched.

### 26.1 Topics

- List request: `${resource}.list.get` with `data?: { page?, size?, sort?, filter? }`
  - Provider optionally replies on `replyTo` with `{ items, page?, size?, total? }`.
  - Provider publishes `${resource}.list.state` with `{ items, page?, size?, total? }` and `retain:true`.
- List state: `${resource}.list.state` (retained snapshot for subscribers with `retained:true`).
- Item select: `${resource}.item.select` with `{ id }` (view → provider hint; no reply required).
- Item get: `${resource}.item.get` with `{ id }` → reply `{ ok:boolean, item?:object, error?:any }`.
- Item save: `${resource}.item.save` with `{ item:object }` → reply `{ ok:boolean, item?:object, error?:any }`.
- Item delete: `${resource}.item.delete` with `{ id }` → reply `{ ok:boolean, id?:string|number, error?:any }`.

Notes:

- Providers SHOULD publish an updated `${resource}.list.state` after save/delete.
- Providers SHOULD accept `key` other than `id` (attribute or header-driven), but reply payloads MUST include the resolved identifier.
- Versioning MAY be conveyed via topic suffix `@N` or header `schema: '<topic>@<N>'`.

### 26.2 Component Roles

- Data Table (`<pan-data-table>`): subscribes to `${resource}.list.state` (retained), renders tabular rows, and publishes `${resource}.item.select` on row click. Attributes: `resource`, `columns`, optional `key`.
- Form (`<pan-form>`): listens for `${resource}.item.select`, requests `${resource}.item.get`, and publishes `${resource}.item.save` / `${resource}.item.delete`. Attributes: `resource`, `fields`, optional `key`.
- Mock Provider (`<pan-data-provider>`): in-memory storage, optional localStorage persistence; handles CRUD topics and publishes list state.
- REST Connector (`<pan-data-connector>`): maps CRUD topics to HTTP endpoints. Attributes: `base-url`, optional `list-path`, `item-path`, `update-method`, `credentials`. Accepts child JSON for fetch options.

### 26.3 Error Semantics

- On failure, providers SHOULD reply `{ ok:false, error }` on the original request's `replyTo`; `error` MAY include `status`, `statusText`, and parsed body when applicable.
- Providers MAY also emit `*.error` event topics for ambient error displays.

### 26.4 Security & Privacy

- Only mirror non-sensitive topics across tabs (e.g., view filters). Do not mirror PII or secrets.
- Keep payload sizes small; consider pagination and server-side filtering.
