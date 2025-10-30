// src/index.js
var PanBus = class _PanBus extends HTMLElement {
  constructor() {
    super();
    this.subs = [];
    this.retained = /* @__PURE__ */ new Map();
    this.clients = /* @__PURE__ */ new Map();
  }
  connectedCallback() {
    document.addEventListener("pan:publish", this.onPublish, true);
    document.addEventListener("pan:request", this.onPublish, true);
    document.addEventListener("pan:reply", this.onReply, true);
    document.addEventListener("pan:subscribe", this.onSubscribe, true);
    document.addEventListener("pan:unsubscribe", this.onUnsubscribe, true);
    document.addEventListener("pan:hello", this.onHello, true);
    window.__panReady = true;
    document.dispatchEvent(new CustomEvent("pan:sys.ready", { bubbles: true, composed: true }));
  }
  disconnectedCallback() {
    document.removeEventListener("pan:publish", this.onPublish, true);
    document.removeEventListener("pan:request", this.onPublish, true);
    document.removeEventListener("pan:reply", this.onReply, true);
    document.removeEventListener("pan:subscribe", this.onSubscribe, true);
    document.removeEventListener("pan:unsubscribe", this.onUnsubscribe, true);
    document.removeEventListener("pan:hello", this.onHello, true);
  }
  onHello = (e) => {
    const d = e.detail || {};
    if (d.id) this.clients.set(d.id, { el: this._et(e), caps: d.caps || [] });
  };
  onSubscribe = (e) => {
    const { topics = [], options = {}, clientId } = e.detail || {};
    const el = this._et(e);
    for (const pattern of topics) this.subs.push({ pattern, el, clientId, retained: !!options.retained });
    if (options.retained) {
      for (const [topic, msg] of this.retained) {
        if (topics.some((p) => _PanBus.matches(topic, p))) this._deliver(el, msg);
      }
    }
  };
  onUnsubscribe = (e) => {
    const { topics = [], clientId } = e.detail || {};
    const el = this._et(e);
    this.subs = this.subs.filter((s) => {
      const sameClient = clientId ? s.clientId === clientId : s.el === el;
      return !(sameClient && topics.includes(s.pattern));
    });
  };
  onPublish = (e) => {
    const base = e.detail || {};
    const msg = Object.assign({ ts: Date.now(), id: crypto.randomUUID() }, base);
    if (msg.retain) this.retained.set(msg.topic, msg);
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  _deliver(target, msg) {
    try {
      target.dispatchEvent(new CustomEvent("pan:deliver", { detail: msg }));
    } catch (_) {
    }
  }
  _et(e) {
    return typeof e.composedPath === "function" ? e.composedPath()[0] : e.target || document;
  }
  static matches(topic, pattern) {
    if (pattern === "*" || topic === pattern) return true;
    if (pattern && pattern.includes("*")) {
      const esc = (s) => s.replace(/[|\\{}()\[\]^$+?.]/g, "\\$&").replace(/\*/g, "[^.]+");
      const rx = new RegExp(`^${esc(pattern)}$`);
      return rx.test(topic);
    }
    return false;
  }
};
if (typeof customElements !== "undefined" && !customElements.get("pan-bus")) {
  customElements.define("pan-bus", PanBus);
}
var PanClient = class _PanClient {
  /**
   * @param {HTMLElement|Document} host
   * @param {string} busSelector css selector for the bus element (unused, for compatibility)
   */
  constructor(host = document, busSelector = "pan-bus") {
    this.host = host;
    this.bus = /** @type {HTMLElement|null} */
    document.querySelector(busSelector);
    if (!this.bus) {
    }
    const tag = host instanceof HTMLElement ? host.tagName.toLowerCase() + (host.id ? "#" + host.id : "") : "doc";
    this.clientId = `${tag}#${Math.random().toString(36).slice(2, 8)}`;
    this._ready = new Promise((res) => {
      const onReady = () => {
        document.removeEventListener("pan:sys.ready", onReady, true);
        res();
      };
      if (globalThis.window && window.__panReady) return res();
      document.addEventListener("pan:sys.ready", onReady, true);
    }).then(() => {
      this._dispatch("pan:hello", { id: this.clientId, caps: ["client"] });
    });
  }
  ready() {
    return this._ready;
  }
  /** @param {string} type @param {any} detail */
  _dispatch(type, detail) {
    this.host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  /**
   * Publish a message
   * @param {{topic:string,data:any,id?:string,ts?:number,replyTo?:string,correlationId?:string,retain?:boolean,headers?:Record<string,string>}} msg
   */
  publish(msg) {
    this._dispatch("pan:publish", msg);
  }
  /**
   * Convenience alias for publish
   * @param {string} topic
   * @param {any} data
   * @param {{retain?:boolean}=} options
   */
  pub(topic, data, options = {}) {
    this.publish({ topic, data, ...options });
  }
  /**
   * Subscribe to one or more topics. Returns an unsubscribe function.
   * @param {string|string[]} topics
   * @param {(m:any)=>void} handler
   * @param {{ retained?: boolean, signal?: AbortSignal }=} opts
   */
  subscribe(topics, handler, opts = {}) {
    topics = Array.isArray(topics) ? topics : [topics];
    const onDeliver = (ev) => {
      const m = ev.detail;
      if (!m || !m.topic) return;
      if (topics.some((t) => _PanClient.matches(m.topic, t))) handler(m);
    };
    this.host.addEventListener("pan:deliver", onDeliver);
    this._dispatch("pan:subscribe", { clientId: this.clientId, topics, options: { retained: !!opts.retained } });
    const off = () => {
      this.host.removeEventListener("pan:deliver", onDeliver);
      this._dispatch("pan:unsubscribe", { clientId: this.clientId, topics });
    };
    if (opts.signal) {
      const onAbort = () => {
        off();
        opts.signal?.removeEventListener("abort", onAbort);
      };
      opts.signal.addEventListener("abort", onAbort, { once: true });
    }
    return off;
  }
  /**
   * Convenience alias for subscribe
   */
  sub(topics, handler, opts) {
    return this.subscribe(topics, handler, opts);
  }
  /**
   * Request/Reply convenience helper. Resolves with the reply message.
   * @param {string} topic
   * @param {any} data
   * @param {{ timeoutMs?: number }=} options
   */
  request(topic, data, { timeoutMs = 5e3 } = {}) {
    const correlationId = crypto.randomUUID();
    const replyTo = `pan:$reply:${this.clientId}:${correlationId}`;
    return new Promise((resolve, reject) => {
      const off = this.subscribe(replyTo, (m) => {
        clearTimeout(timer);
        off();
        resolve(m);
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error("PAN request timeout"));
      }, timeoutMs);
      this.publish({ topic, data, replyTo, correlationId });
    });
  }
  /** topic pattern matcher: supports '*', segment wildcards (foo.*, *.bar, foo.*.baz) */
  static matches(topic, pattern) {
    if (pattern === "*" || topic === pattern) return true;
    if (pattern && pattern.includes("*")) {
      const esc = (s) => s.replace(/[|\\{}()\[\]^$+?.]/g, "\\$&").replace(/\*/g, "[^.]+");
      const rx = new RegExp(`^${esc(pattern)}$`);
      return rx.test(topic);
    }
    return false;
  }
};
function ensureBus() {
  let bus = document.querySelector("pan-bus");
  if (!bus) {
    bus = document.createElement("pan-bus");
    document.body.prepend(bus);
  }
  return bus;
}
function createClient(host = document) {
  ensureBus();
  return new PanClient(host);
}
var index_default = PanClient;
export {
  PanBus,
  PanClient,
  createClient,
  index_default as default,
  ensureBus
};
//# sourceMappingURL=index.js.map
