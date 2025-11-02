import { PanClient } from "./pan-client.mjs";

/**
 * PanWorker - Web Worker integration component for the Pan message bus.
 *
 * Bridges a Web Worker with the Pan message bus, enabling bidirectional
 * message passing between the main thread and worker. Supports both classic
 * and module-type workers, with inline or external script sources.
 *
 * @class PanWorker
 * @extends HTMLElement
 *
 * @fires pan:sys.error - When worker initialization fails
 * @fires {string} topic - Publishes messages received from the worker
 *
 * @example
 * <!-- External worker script -->
 * <pan-worker
 *   src="/workers/processor.js"
 *   topics="data.process data.transform"
 *   worker-type="module">
 * </pan-worker>
 *
 * @example
 * <!-- Inline worker script -->
 * <pan-worker topics="calculation.*">
 *   <script type="application/worker">
 *     self.onmessage = (e) => {
 *       const { topic, data } = e.data;
 *       // Process message
 *       self.postMessage({
 *         topic: 'calculation.result',
 *         data: { result: data.value * 2 }
 *       });
 *     };
 *   </script>
 * </pan-worker>
 */
class PanWorker extends HTMLElement {
  /**
   * Observes changes to worker configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["topics", "src", "worker-type"];
  }

  /**
   * Creates a new PanWorker instance.
   * Initializes the PanClient and worker state.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Function[]} Array of unsubscribe functions */
    this._offs = [];
    /** @private {string|null} Blob URL for inline worker scripts */
    this._url = null;
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Initializes the worker and sets up subscriptions.
   */
  connectedCallback() {
    this.#start();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Terminates the worker and cleans up resources.
   */
  disconnectedCallback() {
    this.#stop();
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Restarts the worker with new configuration.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#restart();
  }

  /**
   * Gets the list of topics to forward to the worker.
   * Messages matching these patterns will be sent to the worker.
   * @returns {string[]} Array of topic patterns
   */
  get topics() {
    const t = (this.getAttribute("topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }

  /**
   * Gets the worker type (classic or module).
   * @returns {"classic"|"module"} Worker type
   * @default "classic"
   */
  get workerType() {
    return (this.getAttribute("worker-type") || "classic").toLowerCase() === "module" ? "module" : "classic";
  }

  /**
   * Starts the worker and sets up message forwarding.
   * @private
   * @async
   */
  async #start() {
    try {
      if (!this.worker) await this.#initWorker();
      this.#subscribe();
    } catch (err) {
      this.pc.publish({ topic: "pan:sys.error", data: { code: "PAN_WORKER_INIT", message: String(err && err.message || err) } });
    }
  }

  /**
   * Stops the worker and cleans up all resources.
   * Terminates the worker thread and revokes blob URLs.
   * @private
   */
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

  /**
   * Restarts the worker by stopping and starting it.
   * @private
   */
  #restart() {
    this.#stop();
    this.#start();
  }

  /**
   * Initializes the worker from external or inline script source.
   * Creates a Worker instance and sets up message handling.
   * @private
   * @async
   */
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

  /**
   * Sets up subscriptions to forward messages to the worker.
   * Subscribes to configured topics and sends matching messages to worker.
   * Includes retained messages for immediate synchronization.
   * @private
   */
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
