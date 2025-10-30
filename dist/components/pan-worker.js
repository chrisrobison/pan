import { PanClient } from "./pan-client.mjs";
class PanWorker extends HTMLElement {
  static get observedAttributes() {
    return ["topics", "src", "worker-type"];
  }
  constructor() {
    super();
    this.pc = new PanClient(this);
    this._offs = [];
    this._url = null;
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
  get topics() {
    const t = (this.getAttribute("topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }
  get workerType() {
    return (this.getAttribute("worker-type") || "classic").toLowerCase() === "module" ? "module" : "classic";
  }
  async #start() {
    try {
      if (!this.worker) await this.#initWorker();
      this.#subscribe();
    } catch (err) {
      this.pc.publish({ topic: "pan:sys.error", data: { code: "PAN_WORKER_INIT", message: String(err && err.message || err) } });
    }
  }
  #stop() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    if (this._url) {
      try {
        URL.revokeObjectURL(this._url);
      } catch {
      }
      this._url = null;
    }
  }
  #restart() {
    this.#stop();
    this.#start();
  }
  async #initWorker() {
    const src = (this.getAttribute("src") || "").trim();
    if (src) {
      this.worker = new Worker(src, { type: this.workerType });
    } else {
      const script = this.querySelector('script[type="application/worker"],script[type="text/worker"],script[type="text/plain"]');
      const code = script?.textContent || "";
      const blob = new Blob([code], { type: "text/javascript" });
      const url = URL.createObjectURL(blob);
      this._url = url;
      this.worker = new Worker(url, { type: this.workerType });
    }
    this.worker.onmessage = (ev) => {
      const msg = ev.data;
      if (!msg) return;
      const out = msg.topic ? msg : msg.msg;
      if (out && out.topic) this.pc.publish(out);
    };
  }
  #subscribe() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
    if (!this.worker) return;
    const forward = (m) => {
      try {
        this.worker.postMessage({ topic: m.topic, data: m.data, replyTo: m.replyTo, correlationId: m.correlationId, headers: m.headers });
      } catch {
      }
    };
    for (const pattern of this.topics) {
      this._offs.push(this.pc.subscribe(pattern, forward, { retained: true }));
    }
  }
}
customElements.define("pan-worker", PanWorker);
var pan_worker_default = PanWorker;
export {
  PanWorker,
  pan_worker_default as default
};
//# sourceMappingURL=pan-worker.js.map
