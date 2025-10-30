class PanBus extends HTMLElement {
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
        if (topics.some((p) => PanBus.matches(topic, p))) this._deliver(el, msg);
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
    for (const s of this.subs) if (PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) if (PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
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
}
customElements.define("pan-bus", PanBus);
var pan_bus_default = PanBus;
export {
  PanBus,
  pan_bus_default as default
};
//# sourceMappingURL=pan-bus.js.map
