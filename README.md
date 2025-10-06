# Page Area Network (PAN)

> **A DOM‑native message bus for Web Components & micro‑frontends:** topics, request/reply, retained messages, lightweight,  no buildi...with an Inspector! 

* **Zero build:** drop a `<pan-bus>` on the page; talk via `CustomEvent`s.
* **Loose coupling:** components depend on topic contracts (JSON‑Schema), not imports.
* **Interoperable:** works with vanilla, Web Components, React/Lit/Vue, iframes.
* **Batteries included:** retained messages, req/rep, optional cross‑tab mirror, DevTools‑style inspector.

---

## Quickstart (10‑second demo)

Copy this into an `.html` file and open it.

```html
<!doctype html><meta charset="utf-8">
<pan-bus></pan-bus>
<x-counter></x-counter>
<script type="module">
  // Minimal PanClient helper
  class PanClient{constructor(h=document){this.h=h}
    pub(m){this.h.dispatchEvent(new CustomEvent('pan:publish',{detail:m,bubbles:true,composed:true}))}
    sub(t,fn){const on=e=>e.detail?.topic&&PAN.matches(e.detail.topic,t)&&fn(e.detail);
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

PAN is pure ESM/HTML. Use any of:

* **CDN (when published):**

  ```html
  <script type="module" src="https://cdn.example/pan-bus.min.js"></script>
  <script type="module" src="https://cdn.example/pan-client.min.js"></script>
  <script type="module" src="https://cdn.example/pan-inspector.min.js"></script>
  ```
* **Local files (clone repo):**

  ```html
  <script type="module" src="./dist/pan-bus.js"></script>
  <script type="module" src="./dist/pan-client.js"></script>
  ```

No bundler required. Works from `file://`.

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
<title>PAN – 01 Hello</title>
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
<title>PAN – 02 Todos & Inspector</title>
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
<!doctype html><meta charset="utf-8"><title>PAN – 03 BroadcastChannel</title>
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
<!doctype html><meta charset="utf-8"><title>PAN – 04 React</title>
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
<!doctype html><meta charset="utf-8"><title>PAN – 05 Lit</title>
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

---

## Spec & Guarantees

* Spec lives in `/spec` (topics, envelopes, versioning, compliance tests).
* Backwards compatibility: topic schemas versioned with semver; minor bumps are additive.

---

## Roadmap

* Inspector Pro: timeline, heatmaps, replay to Playwright tests.
* Schema registry & TS typegen.
* Cross‑origin gateway (`postMessage`) with allowlists.
* IndexedDB/Yjs providers for offline + CRDT sync.

---

## License

MIT for core libraries. Pro/enterprise add‑ons under commercial license.
