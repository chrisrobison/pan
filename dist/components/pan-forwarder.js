import { PanClient } from "./pan-client.mjs";
class PanForwarder extends HTMLElement {
  static get observedAttributes() {
    return ["dest", "topics", "headers", "method", "with-credentials", "enabled"];
  }
  constructor() {
    super();
    this.pc = new PanClient(this);
    this._off = null;
    this._enabled = true;
    this._recent = /* @__PURE__ */ new Set();
    this._gcTimer = null;
  }
  connectedCallback() {
    this.#start();
  }
  disconnectedCallback() {
    this.#stop();
  }
  attributeChangedCallback() {
    this.#restart();
  }
  get dest() {
    return (this.getAttribute("dest") || "").trim();
  }
  get topics() {
    const t = (this.getAttribute("topics") || "*").trim();
    return t ? t.split(/\s+/) : ["*"];
  }
  get method() {
    return (this.getAttribute("method") || "POST").toUpperCase();
  }
  get withCredentials() {
    return (this.getAttribute("with-credentials") || "").toLowerCase() !== "false";
  }
  get enabled() {
    const v = (this.getAttribute("enabled") || "true").toLowerCase();
    return v !== "false" && v !== "0";
  }
  get headers() {
    const raw = this.getAttribute("headers") || "";
    if (!raw) return {};
    try {
      const j = JSON.parse(raw);
      if (j && typeof j === "object") return j;
    } catch {
    }
    const out = {};
    raw.split(";").forEach((kv) => {
      const m = kv.split(":");
      if (m.length >= 2) {
        const k = m.shift().trim();
        const v = m.join(":").trim();
        if (k) out[k] = v;
      }
    });
    return out;
  }
  #restart() {
    this.#stop();
    this.#start();
  }
  #stop() {
    try {
      this._off && this._off();
    } catch {
    }
    this._off = null;
    if (this._gcTimer) {
      clearInterval(this._gcTimer);
      this._gcTimer = null;
    }
  }
  #start() {
    if (!this.dest || !this.enabled) return;
    this._off = this.pc.subscribe(this.topics, (m) => this.#send(m));
    this._gcTimer = setInterval(() => this.#gc(), 3e4);
  }
  async #send(m) {
    if (m?.id && this._recent.has(m.id)) return;
    const body = { topic: m.topic, data: m.data, retain: !!m.retain, id: m.id, ts: m.ts };
    const headers = Object.assign({ "Content-Type": "application/json" }, this.headers);
    try {
      const res = await fetch(this.dest, { method: this.method, credentials: this.withCredentials ? "include" : "omit", headers, body: JSON.stringify(body) });
      if (!res.ok) {
      }
      if (m?.id) this._recent.add(m.id);
    } catch {
    }
  }
  #gc() {
    this._recent = /* @__PURE__ */ new Set();
  }
}
customElements.define("pan-forwarder", PanForwarder);
var pan_forwarder_default = PanForwarder;
export {
  PanForwarder,
  pan_forwarder_default as default
};
//# sourceMappingURL=pan-forwarder.js.map
