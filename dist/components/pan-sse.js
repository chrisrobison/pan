import { PanClient } from "./pan-client.mjs";
class PanSSE extends HTMLElement {
  static get observedAttributes() {
    return ["src", "topics", "with-credentials", "persist-last-event", "backoff"];
  }
  constructor() {
    super();
    this.pc = new PanClient(this);
    this.es = null;
    this._stopped = false;
    this._timer = null;
  }
  connectedCallback() {
    this.#start();
  }
  disconnectedCallback() {
    this._stopped = true;
    this.#stop();
  }
  attributeChangedCallback() {
    this.#restart();
  }
  get src() {
    return (this.getAttribute("src") || "").trim();
  }
  get topics() {
    const t = (this.getAttribute("topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }
  get withCredentials() {
    return (this.getAttribute("with-credentials") || "").toLowerCase() !== "false";
  }
  get persistKey() {
    return (this.getAttribute("persist-last-event") || "").trim();
  }
  get backoff() {
    const s = (this.getAttribute("backoff") || "1000,15000").split(",").map((x) => Number(x) || 0);
    const [min, max] = [Math.max(100, s[0] || 1e3), Math.max(s[1] || s[0] || 5e3, s[0] || 1e3)];
    return { min, max };
  }
  #restart() {
    this.#stop();
    this.#start();
  }
  #stop() {
    try {
      this.es && this.es.close();
    } catch {
    }
    this.es = null;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }
  #url() {
    let url = this.src;
    if (!url) return "";
    const u = new URL(url, location.origin);
    if (this.topics.length) u.searchParams.set("topics", this.topics.join(","));
    if (this.persistKey) {
      try {
        const last = localStorage.getItem(`pan:sse:last:${this.persistKey}`);
        if (last) u.searchParams.set("lastEventId", last);
      } catch {
      }
    }
    return u.toString();
  }
  #start() {
    if (!this.src || this._stopped) return;
    const url = this.#url();
    if (!url) return;
    const es = new EventSource(url, { withCredentials: this.withCredentials });
    this.es = es;
    const onMsg = (ev) => {
      const lastId = ev.lastEventId;
      if (lastId && this.persistKey) {
        try {
          localStorage.setItem(`pan:sse:last:${this.persistKey}`, lastId);
        } catch {
        }
      }
      let topic = ev.type && ev.type !== "message" ? ev.type : "";
      try {
        const data = ev.data ? JSON.parse(ev.data) : null;
        if (!topic) topic = data?.topic || "";
        if (!topic) return;
        const out = { topic, data: data?.data ?? data?.payload ?? (data?.item ? { item: data.item } : data) };
        if (data && typeof data.retain === "boolean") out.retain = data.retain;
        this.pc.publish(out);
      } catch {
        if (topic) this.pc.publish({ topic, data: { raw: ev.data } });
      }
    };
    const onErr = () => {
      this.#scheduleReconnect();
    };
    es.addEventListener("message", onMsg);
    es.addEventListener("error", onErr);
  }
  #scheduleReconnect() {
    if (this._stopped) return;
    this.#stop();
    const { min, max } = this.backoff;
    const ms = Math.min(max, Math.round(min + Math.random() * (max - min)));
    this._timer = setTimeout(() => this.#start(), ms);
  }
}
customElements.define("pan-sse", PanSSE);
var pan_sse_default = PanSSE;
export {
  PanSSE,
  pan_sse_default as default
};
//# sourceMappingURL=pan-sse.js.map
