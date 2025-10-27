# LARC — Lightweight Asynchronous Relay Core

> **A very lightweight DOM‑native message bus reference (PAN) and its reference implementation:** topics, request/reply, retained messages, lightweight, no build, with an Inspector!

* **Zero build:** drop a `<pan-bus>` on the page; talk via `CustomEvent`s.
* **Loose coupling:** components depend on topic contracts (JSON‑Schema), not imports.
* **Interoperable:** works with vanilla, Web Components, React/Lit/Vue, iframes.
* **Batteries included:** retained messages, req/rep, optional cross‑tab mirror, DevTools‑style inspector.

LARC is the project and reference implementation for the Page Area Network (PAN) messaging bus. The PAN bus element and topic conventions remain named with the `pan-`/`pan:` prefixes (for example `<pan-bus>` and `pan:publish`) — this repo provides LARC as the lightweight implementation, docs, and examples.

PAN (Page Area Network) is the messaging model and bus that enables a central communications hub for web components or micro-frontends. It works with any framework or no framework at all.

---

## Architecture & Goals

We are building a suite of Web Components that communicate over PAN to form composable, framework-agnostic UIs.

- Roles:
  - Providers/Connectors: talk to backends (REST/GraphQL/IndexedDB), publish retained state, answer requests.
  - Views: tables, forms, inspectors that subscribe to state and publish user intents (select, save, delete, filter).
  - Adapters/Controllers: optional mappers that translate between domain topics and transports.
- Message types:
  - Commands: `*.get`, `*.save`, `*.delete` (request/reply; not retained).
  - Events: `*.changed`, `*.error` (notifications; not retained).
  - State: `*.state` (retained snapshot for late joiners).
- Topic contracts (CRUD v1):
  - List: `${resource}.list.get` → replies `{ items }` and publishes `${resource}.list.state` (retain:true).
  - Select: `${resource}.item.select` with `{ id }` (view event, no reply).
  - Get: `${resource}.item.get` with `{ id }` → replies `{ ok, item? }`.
  - Save: `${resource}.item.save` with `{ item }` → replies `{ ok, item }`; provider updates list state.
  - Delete: `${resource}.item.delete` with `{ id }` → replies `{ ok, id }`; provider updates list state.

Security tips:

- Mirror only non-sensitive topics across tabs; avoid secrets in mirrored traffic.
- Keep payloads JSON-serializable; prefer headers for schema/version metadata.

## Quickstart (10‑second demo)

**With autoload (recommended):**

Drop one script tag, then use any component. That's it!

```html
<!doctype html><meta charset="utf-8">
<script type="module" src="./components/pan-autoload.mjs"></script>

<!-- Just declare the components you want - they load automatically -->
<x-counter></x-counter>
<pan-inspector></pan-inspector>
```

All components live in `./components/` and load on demand as they approach the viewport. **The `<pan-bus>` is automatically created for you.** No imports, no `customElements.define()`, no bundler.

---

**Manual setup (for learning):**

Copy this into an `.html` file and open it to see the minimal PAN implementation:

```html
<!doctype html><meta charset="utf-8">
<pan-bus></pan-bus>
<x-counter></x-counter>
<script type="module">
  // Minimal PanClient helper
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail);
      this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t]},bubbles:true,composed:true}));
      return ()=>{this.h.removeEventListener('pan:deliver',on);
        this.h.dispatchEvent(new CustomEvent('pan:unsubscribe',{detail:{topics:[t]},bubbles:true,composed:true}));};}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true;
      if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  // Tiny bus (reference)
  customElements.define('pan-bus', class extends HTMLElement{ subs=[]; connectedCallback(){
    document.addEventListener('pan:publish', e=>this.#pub(e), true);
    document.addEventListener('pan:subscribe', e=>this.#sub(e), true);
    document.addEventListener('pan:unsubscribe', e=>this.#unsub(e), true);
    document.dispatchEvent(new CustomEvent('pan:sys.ready',{bubbles:true,composed:true}));
  }
  #sub(e){const {topics=[]}=e.detail||{}; const el=e.composedPath?.()[0]; topics.forEach(p=>this.subs.push({p,el}));}
  #unsub(e){const {topics=[]}=e.detail||{}; const el=e.composedPath?.()[0]; this.subs=this.subs.filter(s=>s.el!==el||!topics.includes(s.p));}
  #pub(e){const m=e.detail; this.subs.forEach(s=>{ if(PanClient.matches(m.topic,s.p)) s.el.dispatchEvent(new CustomEvent('pan:deliver',{detail:m})); });}
  });
  // Demo component
  customElements.define('x-counter', class extends HTMLElement{ pc=new PanClient(this); n=0; connectedCallback(){
    this.innerHTML=`<button>Clicked 0</button>`;
    this.querySelector('button').onclick=()=>this.pc.pub({topic:'demo:click',data:{n:++this.n},retain:true});
    this.pc.sub('demo:click', m=> this.querySelector('button').textContent = `Clicked ${m.data.n}`);
  }});
</script>
```

---

## Install

**Recommended: Use autoload**

Clone the repo and drop a single script tag on your page:

```html
<script type="module" src="./components/pan-autoload.mjs"></script>
```

Then just use components in your HTML - they load automatically on demand:

```html
<pan-bus></pan-bus>
<todo-list></todo-list>
<pan-inspector></pan-inspector>
```

No bundler required. Works from `file://`.

---

**Alternative: Manual imports**

For fine-grained control or CDN usage (when published):

```html
<script type="module" src="./components/pan-bus.mjs"></script>
<script type="module" src="./components/pan-client.mjs"></script>
<script type="module" src="./components/pan-inspector.mjs"></script>
```

---

## Autoloading Custom Elements

**This is the recommended way to use LARC.**

Drop a single script tag on the page to progressively load Web Components from the
`components/` folder. Tags with a dash (`<my-widget>`) are auto-detected; when they
approach the viewport, the loader imports `./components/<tag>.mjs` and registers them.

**The `<pan-bus>` is automatically created** so you can start using components immediately:

```html
<script type="module" src="./components/pan-autoload.mjs"></script>

<!-- All of these load automatically - no imports needed -->
<my-widget></my-widget>
<todo-list></todo-list>
<pan-inspector></pan-inspector>
```

**Configuration (optional):**

Override the components path or file extension:

```html
<script>
  window.panAutoload = {
    componentsPath: './my-components/',
    extension: '.js',
    rootMargin: 600  // px from viewport to trigger load
  };
</script>
<script type="module" src="./components/pan-autoload.mjs"></script>
```

**Per-element override:**

Point a specific element to a different module:

```html
<my-card data-module="/components/cards/my-card.mjs"></my-card>
```

Components that don't self-register are defined automatically when they export a
default class matching the tag name.

---

## Core Concepts

* **Topics**: strings like `todos.change`, `nav.goto`, `user.update@2`.
* **Messages**: `{ topic, data, id?, ts?, replyTo?, correlationId?, retain? }`.
* **Transport**: bubbling, composed `CustomEvent`s so they cross shadow DOM.
* **Retained**: last message per topic is replayed to new subscribers.
* **Req/Rep**: set `replyTo`+`correlationId`; reply on `replyTo`.

---

## API (PanClient)

```ts
class PanClient {
  constructor(host?: HTMLElement|Document, busSelector = 'pan-bus')
  ready(): Promise<void>
  publish<T>(msg: PanMessage<T>): void
  subscribe(topics: string|string[], handler: (m: PanMessage)=>void, opts?: { retained?: boolean, signal?: AbortSignal }): () => void
  request<TReq,TRes>(topic: string, data: TReq, opts?: { timeoutMs?: number }): Promise<PanMessage<TRes>>
}
```

`PanMessage<T>` fields: `topic`, `data`, optional `id`, `ts`, `replyTo`, `correlationId`, `retain`, `headers`.

---

## Recipes

### 1) Publish/Subscribe

```js
pc.publish({ topic:'search.query', data:{ q:'punk' } });
pc.subscribe('search.results', m => render(m.data));
```

### 2) Request/Reply

```js
const { data } = await pc.request('data.get', { key:'users' });
// provider replies on a temporary reply topic created by PanClient
```

### 3) Retained State Snapshot

```js
pc.publish({ topic:'settings.theme', data:'dark', retain:true });
pc.subscribe('settings.theme', m => applyTheme(m.data), { retained:true });
```

### 4) Cross‑tab sync (BroadcastChannel mirror)

Bus option to mirror topics across tabs using `BroadcastChannel('pan')`. Example in `examples/03-broadcastchannel.html`.

---

## Inspector

Drop the Inspector to watch traffic, filter by topic, replay messages.

```html
<pan-inspector style="height:400px"></pan-inspector>
```

Features: topic/text filters, pause, clear, export/import JSON, replay, view JSON.

---

## Interop

* **React:** wrapper hook `usePan()`; components call `publish/subscribe`. See `examples/04-react-wrapper.html` (no build, CDN React).
* **Lit:** mixin using `PanClient` inside a Lit element. See `examples/05-lit-wrapper.html`.
* **Iframes:** use a gateway that validates `origin` and whitelists topics.

---

## Examples

(Each example is a single self‑contained HTML file you can open directly.)

### `examples/01-hello.html`

Minimal counter (publish/subscribe).

```html
<!DOCTYPE html>
<meta charset="utf-8" />
<title>LARC – 01 Hello</title>
<pan-bus></pan-bus>
<x-counter></x-counter>
<script type="module">
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail); this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t]},bubbles:true,composed:true}));}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true; if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  customElements.define('pan-bus', class extends HTMLElement{ subs=[]; connectedCallback(){
    document.addEventListener('pan:publish', e=>this.#pub(e), true);
    document.addEventListener('pan:subscribe', e=>this.#sub(e), true);
    document.dispatchEvent(new CustomEvent('pan:sys.ready',{bubbles:true,composed:true})); }
    #sub(e){const {topics=[]}=e.detail||{}; const el=e.composedPath?.()[0]; topics.forEach(p=>this.subs.push({p,el}));}
    #pub(e){const m=e.detail; this.subs.forEach(s=>{ if(PanClient.matches(m.topic,s.p)) s.el.dispatchEvent(new CustomEvent('pan:deliver',{detail:m})); });}
  });
  customElements.define('x-counter', class extends HTMLElement{ pc=new PanClient(this); n=0; connectedCallback(){ this.innerHTML=`<button>Clicked 0</button>`;
    this.querySelector('button').onclick=()=>this.pc.pub({topic:'demo:click',data:{n:++this.n},retain:true});
    this.pc.sub('demo:click', m=> this.querySelector('button').textContent = `Clicked ${m.data.n}`);
  }});
</script>
```

### `examples/02-todos-and-inspector.html`

Todo list + retained state + DevTools‑style Inspector.

```html
<!DOCTYPE html><meta charset="utf-8" />
<title>LARC – 02 Todos & Inspector</title>
<pan-bus></pan-bus>
<todo-provider></todo-provider>
<todo-list></todo-list>
<pan-inspector style="height:420px"></pan-inspector>
<script type="module">
  // --- PanClient (minimal) & bus (same as above, with retained storage) ---
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn,o={}){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail); this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t],options:o},bubbles:true,composed:true})); return ()=>this.h.removeEventListener('pan:deliver',on);}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true; if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  customElements.define('pan-bus', class extends HTMLElement{ subs=[]; retained=new Map(); connectedCallback(){
    document.addEventListener('pan:publish', e=>this.#pub(e), true);
    document.addEventListener('pan:subscribe', e=>this.#sub(e), true);
    document.dispatchEvent(new CustomEvent('pan:sys.ready',{bubbles:true,composed:true})); }
    #sub(e){const {topics=[],options={}}=e.detail||{}; const el=e.composedPath?.()[0]; topics.forEach(p=>{this.subs.push({p,el}); if(options.retained){ for(const [t,msg] of this.retained){ if(PanClient.matches(t,p)) el.dispatchEvent(new CustomEvent('pan:deliver',{detail:msg})); } }});}
    #pub(e){const m={id:crypto.randomUUID(),ts:Date.now(),...e.detail}; if(m.retain) this.retained.set(m.topic,m); this.subs.forEach(s=>{ if(PanClient.matches(m.topic,s.p)) s.el.dispatchEvent(new CustomEvent('pan:deliver',{detail:m})); });}
  });
  // --- Todo provider (stateful, publishes retained snapshot) ---
  customElements.define('todo-provider', class extends HTMLElement{ pc=new PanClient(this); items=[]; connectedCallback(){
    document.addEventListener('pan:sys.ready', ()=>{
      this.pc.sub('todos.change', m=>{this.items.push(m.data.item); this.broadcast();});
      this.pc.sub('todos.remove', m=>{this.items=this.items.filter(t=>t.id!==m.data.id); this.broadcast();});
      this.pc.sub('todos.toggle', m=>{const t=this.items.find(x=>x.id===m.data.id); if(t) t.done=!!m.data.done; this.broadcast();});
      this.pc.pub({topic:'todos.state', data:{items:this.items}, retain:true});
    }, {once:true});
  }
  broadcast(){ this.pc.pub({topic:'todos.state', data:{items:this.items}, retain:true}); }
  });
  // --- Todo list UI ---
  customElements.define('todo-list', class extends HTMLElement{ pc=new PanClient(this); items=[]; connectedCallback(){
    this.attachShadow({mode:'open'}); this.render();
    this.pc.sub('todos.state', m=>{this.items=m.data.items; this.render();}, {retained:true});
  }
  render(){ const h=String.raw; this.shadowRoot.innerHTML=h`
    <style> .muted{color:#888} ul{list-style:none;padding:0} li{display:flex;gap:8px;padding:6px 0;border-bottom:1px dashed #ddd} li.done .t{ text-decoration:line-through; color:#888 } </style>
    <form id=f><input id=title placeholder="Add a task…"/><button>Add</button></form>
    ${this.items.length? '' : '<div class=muted>No tasks yet.</div>'}
    <ul>${this.items.map(t=>`<li class="${t.done?'done':''}" data-id="${t.id}"><input type=checkbox ${t.done?'checked':''}><span class=t>${t.title}</span><span style="flex:1"></span><button class=del>✕</button></li>`).join('')}</ul>`;
    const $=s=>this.shadowRoot.querySelector(s);
    $('#f').onsubmit=(e)=>{e.preventDefault(); const v=$('#title').value.trim(); if(!v) return; $('#title').value=''; this.pc.pub({topic:'todos.change', data:{item:{id:crypto.randomUUID(), title:v, done:false}}, retain:true}); };
    this.shadowRoot.querySelectorAll('li input[type=checkbox]').forEach(cb=>cb.addEventListener('change',e=>{const id=e.target.closest('li').dataset.id; this.pc.pub({topic:'todos.toggle', data:{id, done:e.target.checked}, retain:true});}));
    this.shadowRoot.querySelectorAll('li .del').forEach(b=>b.addEventListener('click',e=>{const id=e.target.closest('li').dataset.id; this.pc.pub({topic:'todos.remove', data:{id}, retain:true});}));
  }
  });
  // --- Minimal Inspector (table view) ---
  customElements.define('pan-inspector', class extends HTMLElement{ pc=new PanClient(this); events=[]; connectedCallback(){ this.attachShadow({mode:'open'}); this.render(); this.pc.sub('*', m=>{this.events.push({ts:Date.now(),topic:m.topic,size:JSON.stringify(m).length}); this.render();}); }
    render(){ const h=String.raw; this.shadowRoot.innerHTML=h`<style>table{width:100%;font:12px/1.4 monospace}th{ text-align:left; position:sticky; top:0; background:#f6f6f6 }</style><table><thead><tr><th>time</th><th>topic</th><th>size</th></tr></thead><tbody>${this.events.slice(-300).map(r=>`<tr><td>${new Date(r.ts).toLocaleTimeString()}</td><td>${r.topic}</td><td>${r.size}</td></tr>`).join('')}</tbody></table>`; }
  });
</script>
```

### `examples/03-broadcastchannel.html`

Mirror specific topics across tabs using `BroadcastChannel('pan')`.

```html
<!doctype html><meta charset="utf-8"><title>LARC – 03 BroadcastChannel</title>
<pan-bus mirror="settings.*"></pan-bus>
<script type="module">
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail); this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t]},bubbles:true,composed:true}));}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true; if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  customElements.define('pan-bus', class extends HTMLElement{ subs=[]; bc=null; connectedCallback(){ const allow=(this.getAttribute('mirror')||'').split(/\s+/).filter(Boolean);
    this.bc = new BroadcastChannel('pan'); this.bc.onmessage = (ev)=> this.#deliver(ev.data);
    document.addEventListener('pan:publish', e=>{const m=e.detail; this.#deliver(m); if(allow.some(p=>PanClient.matches(m.topic,p))) this.bc.postMessage(m);}, true);
    document.addEventListener('pan:subscribe', e=>{const {topics=[]}=e.detail||{}; const el=e.composedPath?.()[0]; topics.forEach(p=>this.subs.push({p,el}));}, true);
  }
  #deliver(m){ this.subs.forEach(s=> PanClient.matches(m.topic,s.p) && s.el.dispatchEvent(new CustomEvent('pan:deliver',{detail:m}))); }
  });
  // Demo usage
  const pc = new PanClient();
  setInterval(()=> pc.pub({ topic:'settings.clock', data: Date.now(), retain:true }), 1000);
  pc.sub('settings.clock', m=> console.log('tick', m.data));
</script>
```

### `examples/04-react-wrapper.html`

Use PAN from React with no build (CDN React, plain JS, no JSX).

```html
<!doctype html><meta charset="utf-8"><title>LARC – 04 React</title>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<pan-bus></pan-bus>
<div id="app"></div>
<script type="module">
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail); this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t]},bubbles:true,composed:true})); return ()=>this.h.removeEventListener('pan:deliver',on);}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true; if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  const pc = new PanClient();
  function usePan(topic){ const [msg,setMsg]=React.useState(null);
    React.useEffect(()=>{ const off=pc.sub(topic, setMsg); return ()=>off&&off(); },[topic]);
    return [msg, (m)=>pc.pub(m)]; }
  function App(){ const [msg, send] = usePan('chat.message');
    const [text,setText] = React.useState('');
    return React.createElement('div',{},
      React.createElement('h3',{},'React ↔ PAN'),
      msg && React.createElement('pre',{}, JSON.stringify(msg.data,null,2)),
      React.createElement('input',{value:text,onChange:e=>setText(e.target.value)}),
      React.createElement('button',{onClick:()=>{send({topic:'chat.message', data:{text}}); setText('');}},'Send')
    );
  }
  ReactDOM.createRoot(document.getElementById('app')).render(React.createElement(App));
</script>
```

### `examples/05-lit-wrapper.html`

Use PAN from a Lit element (CDN Lit, no build).

```html
<!doctype html><meta charset="utf-8"><title>LARC – 05 Lit</title>
<script type="module">
  import { LitElement, html, css } from 'https://unpkg.com/lit?module';
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PanClient.matches(e.detail.topic,t)&&fn(e.detail); this.h.addEventListener('pan:deliver',on);
      this.h.dispatchEvent(new CustomEvent('pan:subscribe',{detail:{topics:[t]},bubbles:true,composed:true})); return ()=>this.h.removeEventListener('pan:deliver',on);}
    static matches(topic, pattern){ if(pattern==='*'||topic===pattern) return true; if(pattern.includes('*')){const esc=s=>s.replace(/[|\\{}()\[\]^$+?.]/g,'\\$&').replace(/\*/g,'[^.]+' );return new RegExp(`^${esc(pattern)}$`).test(topic);} return false; }
  }
  customElements.define('pan-bus', class extends HTMLElement{ subs=[]; connectedCallback(){
    document.addEventListener('pan:publish', e=>this.#pub(e), true);
    document.addEventListener('pan:subscribe', e=>this.#sub(e), true);
  } #sub(e){const {topics=[]}=e.detail||{}; const el=e.composedPath?.()[0]; topics.forEach(p=>this.subs.push({p,el}));}
    #pub(e){const m=e.detail; this.subs.forEach(s=> PanClient.matches(m.topic,s.p) && s.el.dispatchEvent(new CustomEvent('pan:deliver',{detail:m}))); }
  });
  class LitChat extends LitElement{
    static styles = css`:host{display:block;padding:12px;border:1px solid #ccc;border-radius:8px}`;
    pc = new PanClient(this);
    firstUpdated(){ this.off = this.pc.sub('chat.message', m=>{ this.last = m.data; this.requestUpdate(); }); }
    disconnectedCallback(){ super.disconnectedCallback(); this.off && this.off(); }
    render(){ return html`
      <h3>Lit ↔ PAN</h3>
      ${this.last ? html`<pre>${JSON.stringify(this.last,null,2)}</pre>` : html`<em>no messages yet</em>`}
      <form @submit=${e=>{e.preventDefault(); const v=this.renderRoot.getElementById('t').value.trim(); if(!v) return; this.pc.pub({topic:'chat.message', data:{text:v}}); this.renderRoot.getElementById('t').value='';}}>
        <input id="t" placeholder="Say hi" />
        <button>Send</button>
      </form>` }
  }
  customElements.define('lit-chat', LitChat);
</script>
<pan-bus></pan-bus>
<lit-chat></lit-chat>
```

### `examples/06-crud.html`

Basic CRUD stack wired to a mock provider (local state, optional `localStorage` persistence).

```html
<!doctype html><meta charset="utf-8">
<pan-bus></pan-bus>
<div class="row">
  <pan-data-table resource="users" columns="id,name,email"></pan-data-table>
  <pan-form resource="users" fields="name,email"></pan-form>
  <pan-inspector style="height:320px"></pan-inspector>
  <pan-data-provider resource="users" persist="localStorage">
    <script type="application/json">[{"id":"u1","name":"Ada","email":"ada@example.com"}]</script>
  </pan-data-provider>
  <script type="module">
    import '../dist/pan-bus.js';
    import '../dist/pan-client.js';
    import '../dist/pan-inspector.js';
    import '../dist/pan-data-provider-mock.js';
    import '../dist/pan-data-table.js';
    import '../dist/pan-form.js';
  </script>
  <!-- Open examples/06-crud.html to try it. -->
```

### `examples/07-rest-connector.html`

CRUD stack driving a remote REST API via `<pan-data-connector>`. Uses JSONPlaceholder for demo.

```html
<!doctype html><meta charset="utf-8">
<pan-bus></pan-bus>
<pan-data-table resource="users" columns="id,name,email"></pan-data-table>
<pan-form resource="users" fields="name,email"></pan-form>
<pan-inspector style="height:340px"></pan-inspector>
<pan-data-connector resource="users" base-url="https://jsonplaceholder.typicode.com"></pan-data-connector>
<script type="module">
  import '../dist/pan-bus.js';
  import '../dist/pan-client.js';
  import '../dist/pan-inspector.js';
  import '../dist/pan-data-table.js';
  import '../dist/pan-form.js';
  import '../dist/pan-data-connector.js';
  // Optional refresh
  import { PanClient } from '../dist/pan-client.js';
  new PanClient().publish({ topic:'users.list.get', data:{} });
  // Open examples/07-rest-connector.html to try it.
</script>
```

---

### `examples/08-workers.html`

Offload filter/sort of 10k records to a Web Worker via `<pan-worker>`; publishes computed `${resource}.list.state` for `<pan-data-table>`.

```html
<!doctype html><meta charset="utf-8">
<pan-bus></pan-bus>
<pan-worker topics="users.list.get users.query.set">
  <script type="application/worker">
    // Worker: generate 10k users, compute filter/sort, publish users.list.state
    let items=[]; for(let i=0;i<10000;i++){ const id=`u${i+1}`; const name=`User ${String(i+1).padStart(5,'0')}`; items.push({id,name,email:`${name.toLowerCase().replace(/\s+/g,'')}@example.com`}); }
    let q={q:'',sort:'name:asc'};
    function pub(){ const [k,d]=(q.sort||'name:asc').split(':'); let v=items; if(q.q){const s=q.q.toLowerCase(); v=v.filter(it=>it.name.toLowerCase().includes(s)||it.email.toLowerCase().includes(s));} v=v.slice().sort((a,b)=>{const av=a[k],bv=b[k];return (av>bv?1:av<bv?-1:0)*(d==='desc'?-1:1)}); postMessage({topic:'users.list.state',data:{items:v},retain:true}); }
    onmessage=(e)=>{ const m=e.data||{}; if(m.topic==='users.query.set'){ q=Object.assign({},q,m.data||{}); pub(); } if(m.topic==='users.list.get'){ pub(); } };
  </script>
</pan-worker>
<pan-data-table resource="users" columns="id,name,email"></pan-data-table>
<script type="module">
  import '../dist/pan-bus.js';
  import '../dist/pan-client.js';
  import '../dist/pan-data-table.js';
  import '../dist/pan-worker.js';
  import { PanClient } from '../dist/pan-client.js';
  new PanClient().publish({ topic:'users.list.get', data:{} });
</script>
```

---

## CRUD Components

- `pan-data-table`: subscribes to `${resource}.list.state` and renders a table. Publishes row clicks as `${resource}.item.select`.
- `pan-form`: listens for `${resource}.item.select`, requests `${resource}.item.get`, and submits to `${resource}.item.save` / `${resource}.item.delete`.
- `pan-data-provider`: mock in‑memory provider. Seeds from child JSON script and can persist to `localStorage`. Handles get/save/delete topics and publishes `${resource}.list.state` (retained).
- `pan-data-connector`: REST bridge. Maps PAN CRUD topics to HTTP endpoints. Publishes `${resource}.list.state` (retained).
- `pan-query`: query orchestrator; retains `${resource}.query.state` and triggers `${resource}.list.get`. Supports URL sync via `sync-url="search|hash"`.

### Schema-driven Components

- `pan-schema`: publishes retained `${resource}.schema.state` from a `src` URL or inline JSON.
- `pan-schema-form`: renders a form from JSON Schema, validates locally, and performs `${resource}.item.get`/`.save`/`.delete`. Listens to `${resource}.item.state.*` for live updates.

### Additional Connectors

- `pan-php-connector`: bridges `${resource}.list.*` topics to a PHP endpoint shaped like `api.php` (supports paging, filters). Publishes aggregated `${resource}.list.state`.
- `pan-graphql-connector`: maps CRUD topics to GraphQL queries/mutations provided as child `<script type="application/graphql" data-op="...">` and extracts results via a JSON `data-paths` map.

Realtime bridges and stores:

- `pan-sse`: bridges Server-Sent Events into PAN topics. Attributes: `src`, optional `topics` (space-separated), `persist-last-event`, and `backoff` (e.g., `1000,15000`). Emits events where either `event:` is the topic or JSON payload contains `{ topic, data }`.
- `pan-forwarder`: forwards selected topics to an HTTP endpoint (e.g., `sse.php` POST). Attributes: `dest`, `topics`, optional `headers`, `with-credentials`.
- `pan-store`: tiny reactive store and `bind()` helper for wiring form fields ↔ state.
- `pan-store-pan`: helpers `syncItem()` and `syncList()` to connect stores to PAN topics (auto-save, live updates).

Defaults and attributes:

- `resource`: logical name (default `items`).
- `pan-data-table` attributes: `columns="col1,col2"`, optional `key` (id field, default `id`).
- `pan-form` attributes: `fields="name,email"`, optional `key` (id field, default `id`).
- `pan-data-provider` attributes: `persist="localStorage"`, optional `key`.
- `pan-data-connector` attributes: `base-url`, optional `list-path` (default `/${resource}`), `item-path` (default `/${resource}/:id`), `update-method` (`PUT`|`PATCH`, default `PUT`), `credentials` (e.g. `include`). Optional child `<script type="application/json">` supplies fetch options (e.g., headers).

Topic contract (generic CRUD):

- Request list: `${resource}.list.get` → replies `{ items }`; also causes `${resource}.list.state` to be retained.
- Select row: `${resource}.item.select` with `{ id }`.
- Get item: `${resource}.item.get` with `{ id }` → replies `{ ok, item? }`.
- Save item: `${resource}.item.save` with `{ item }` → replies `{ ok, item }`.
- Delete item: `${resource}.item.delete` with `{ id }` → replies `{ ok, id }`.

Realtime updates (optional, generic):

- Per‑item state: providers may publish retained `${resource}.item.state.${id}` with `{ item }` when an item changes.
- Deletions: publish `${resource}.item.state.${id}` with `{ id, deleted: true }` (not retained).
- `pan-data-table` and `pan-form` listen for these automatically when `live="true"` (default).

---

## SSE Sidecar + Store Example

Run a minimal SSE + REST sidecar (no deps):

```
node examples/server/sse-server.js
```

Then open: `examples/10-sse-store.html`

- The page uses `<pan-sse>` to receive server events and republish as PAN topics.
- `<pan-data-connector>` points to the sidecar REST API for CRUD.
- A small store auto-saves changes to `${resource}.item.save` and updates live from `${resource}.item.state.${id}`.

---

## Stores & Sync APIs

`pan-store` (dist/pan-store.js)

- createStore(initial)
  - Returns `{ state, subscribe(fn), snapshot(), set(k,v), patch(obj), update(fn) }`.
  - Proxy-backed `state` emits a `state` event on key change.
- bind(el, store, map, opts?)
  - Two-way binds form elements to store keys.
  - `map`: `{ 'input[name=name]':'name', 'input[name=email]':'email' }`.
  - `opts.events`: default `['input','change']`.

`pan-store-pan` (dist/pan-store-pan.js)

- syncItem(store, opts)
  - Bridges a store to item topics; applies live updates and (optionally) auto-saves edits.
  - Options:
    - `resource='items'`, `key='id'`
    - `id`: fixed id; if omitted and `followSelect=true`, follows `${resource}.item.select`.
    - `live=true`: subscribe to `${resource}.item.state.${id}` (retained) and apply `{ item }`, `{ patch }`, or top-level patches; clear on `{ deleted:true }`.
    - `autoSave=true`: debounce changes and request `${resource}.item.save` with `{ item: store.snapshot() }`.
    - `debounceMs=300`, `followSelect=true`.
  - Returns an `unsubscribe` function.
- syncList(store, opts)
  - Tracks `${resource}.list.state` and `${resource}.item.state.*` into an in-memory array.
  - Options: `resource='items'`, `key='id'`, `live=true`.
  - Expects a store with at least an `items` key; updates via `store._setAll({ items })`.

`pan-sse` (dist/pan-sse.js)

- Attributes
  - `src`: SSE endpoint URL (absolute or relative).
  - `topics`: optional space-separated list; added as `?topics=...` to the request.
  - `persist-last-event`: key for localStorage to resume with `?lastEventId=`.
  - `backoff`: `min,max` in ms (e.g., `1000,15000`).
  - `with-credentials`: include cookies; default true if present.
- Server payloads supported
  - Event-as-topic: `event: users.item.state.u123` + `data: {"item":{...}}`.
  - JSON envelope: `event: message` + `data: {"topic":"users.item.state.u123","data":{...},"retain":true}`.
  - The bridge republishes `{ topic, data, retain? }` onto the PAN bus.

`pan-form` and `pan-data-table`

- Both now support `live` (default `true`) and optional `key` for id field.
- `pan-data-table` remains subscribed to `${resource}.list.state` and merges `${resource}.item.state.*` updates.
- `pan-form` follows `${resource}.item.select` and keeps the selected item live-synced.

`pan-table`

- `dist/pan-table.js` defines `<pan-table>` as an alias for `<pan-data-table>`.

---

## Demo Browser (SPA)

`index.html` hosts a SPA-style browser powered by PAN topics:

- `<pan-demo-nav>`: renders the example list from inline JSON, publishes retained `nav.state` and `nav.goto` topics on selection (hash-synced).
- `<pan-demo-viewer>`: subscribes to `nav.state` and loads the selected example in an iframe (or inline HTML in `mode="inline"`).

Navigation topics:

- `nav.state` (retained): `{ href, id }` current selection
- `nav.goto`: `{ href, id }` imperative navigation

Open `index.html` to browse all examples in a single page.

---

## More Examples

- `examples/08-workers.html`: Workers + Query orchestrator (10k synthetic records).
- `examples/09-schema-form.html`: Schema-driven form + mock provider.
- `examples/11-graphql-connector.html`: GraphQL connector (GraphQLZero) with list/get/save/delete.
- `examples/12-php-connector.html`: PHP connector against local `api.php`; list + paging.
- `registry/index.html`: Component registry viewer (loads `registry/index.json`).
- `conformance/index.html`: PAN v1 conformance tests for the reference implementation.
- `templates/provider-kit/`: Starter kit for a minimal CRUD provider component.
- `examples/13-sse-pan.html`: Local PHP SSE hub (`sse.php`) broadcasting into PAN.
- `pan-grid.html`: DB grid wired to `api.php` using PAN.

Topic patterns in use

- Bulk: `${resource}.list.state` with `{ items: [...] }` (retained).
- Per-item: `${resource}.item.state.${id}` with either `{ item }` (retained) or `{ patch }`.
- Deletion: `${resource}.item.state.${id}` with `{ id, deleted:true }` (not retained).

Providers

- `pan-data-provider` (mock) and `pan-data-connector` (REST) now also publish per-item snapshots on get/save and deletion notices.
  - Mock: dist/pan-data-provider-mock.js
  - REST: dist/pan-data-connector.js

Operational notes (PHP)

- For PHP (mod_php or PHP-FPM), prefer using the small sidecar for SSE/WebSocket rather than holding long-lived connections in PHP workers.
- If serving SSE from PHP directly, disable output buffering, avoid locking sessions, send keep-alives regularly, and ensure reverse proxies don’t buffer.

Local PHP SSE hub

- `sse.php` implements a simple file-backed SSE stream and a `POST` endpoint:
  - `GET /pan/sse.php?topics=users.*` streams events (with keepalives; respects `lastEventId`).
  - `POST /pan/sse.php` with `{ "topic":"chat.message", "data":{...}, "retain":false }` appends and broadcasts.
  - Use `<pan-sse src="/pan/sse.php" topics="chat.message demo.*">` to bridge into PAN.


---

## Spec & Guarantees

* Spec lives in `LARC_SPEC.v0.md` (topics, envelopes, versioning, compliance tests).
* Backwards compatibility: topic schemas versioned with semver; minor bumps are additive.

---

## Roadmap

* Inspector Pro: timeline, heatmaps, replay to Playwright tests.
* Schema registry & TS typegen.
* Cross‑origin gateway (`postMessage`) with allowlists.
* IndexedDB/Yjs providers for offline + CRDT sync.

---

## Sample Data

Static JSON you can load in examples or serve via a simple static server:

- `examples/data/users.json`
- `examples/data/products.json`
- `examples/data/todos.json`

---

## E2E Tests (Playwright)

- Prereqs: Node 18+.
- Install Playwright (downloads browsers):
  - `npx -y playwright install`
- Run tests:
  - `npx playwright test` (headless)
  - `npx playwright test --headed` (headed)
  - `npx playwright test --ui` (watch mode)
- Notes: tests open the example pages via `file://` URLs and validate UI actions and bus traffic.

---

## License

MIT for core libraries. Pro/enterprise add‑ons under commercial license.

---

## PAN v1, Registry, and Packages

- Spec: `PAN_SPEC.v1.md` (concise)
- Conformance: open `conformance/index.html` — passing implementations may use `badges/pan-v1.svg`.
- Registry: `registry/index.json` + `registry/index.html` to browse components by topic/type.
- npm scaffold: `packages/` contains publishable entries for `@pan/bus`, `@pan/client`, `@pan/inspector`.
  - Sync dist into packages: `npm run packages:sync`
  - Then publish from each package folder (remove root `private:true` if you split repos).
- Build registry from packages: `npm run registry:build` updates `registry/index.json` from `packages/*/package.json` `pan` metadata.
- Conformance badge: `npm run conformance:badge` writes `conformance/badge.json` and `badges/pan-v1-status.svg` using Playwright.
- RFCs: see `rfcs/README.md` and `.github/ISSUE_TEMPLATE/rfc.md`.
