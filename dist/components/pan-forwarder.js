import { PanClient } from "./pan-client.mjs";

/**
 * PanForwarder - HTTP forwarding component for Pan message bus events.
 *
 * Forwards messages matching specified topics to an HTTP endpoint.
 * Supports custom headers, methods, and deduplication to prevent
 * sending the same message multiple times.
 *
 * @class PanForwarder
 * @extends HTMLElement
 *
 * @example
 * <!-- Basic HTTP forwarding -->
 * <pan-forwarder
 *   dest="/api/events"
 *   topics="user.* analytics.*"
 *   method="POST">
 * </pan-forwarder>
 *
 * @example
 * <!-- With custom headers and credentials -->
 * <pan-forwarder
 *   dest="https://api.example.com/webhooks"
 *   topics="*"
 *   method="POST"
 *   with-credentials="true"
 *   headers='{"Authorization":"Bearer token123","X-Client-ID":"app1"}'>
 * </pan-forwarder>
 *
 * @example
 * <!-- With semicolon-separated headers -->
 * <pan-forwarder
 *   dest="/log"
 *   topics="error.* warning.*"
 *   headers="Authorization: Bearer xyz; X-App-Version: 1.0">
 * </pan-forwarder>
 */
class PanForwarder extends HTMLElement {
  /**
   * Observes changes to forwarder configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["dest", "topics", "headers", "method", "with-credentials", "enabled"];
  }

  /**
   * Creates a new PanForwarder instance.
   * Initializes the PanClient and forwarding state.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Function|null} Unsubscribe function */
    this._off = null;
    /** @private {boolean} Internal enabled state */
    this._enabled = true;
    /** @private {Set<string>} Set of recently sent message IDs for deduplication */
    this._recent = /* @__PURE__ */ new Set();
    /** @private {number|null} Garbage collection timer ID */
    this._gcTimer = null;
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Starts forwarding messages to the destination.
   */
  connectedCallback() {
    this.#start();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Stops forwarding and cleans up resources.
   */
  disconnectedCallback() {
    this.#stop();
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Restarts the forwarder with new configuration.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#restart();
  }

  /**
   * Gets the destination HTTP endpoint URL.
   * @returns {string} The destination URL
   */
  get dest() {
    return (this.getAttribute("dest") || "").trim();
  }

  /**
   * Gets the list of topics to forward.
   * @returns {string[]} Array of topic patterns
   * @default ["*"] - Forwards all topics
   */
  get topics() {
    const t = (this.getAttribute("topics") || "*").trim();
    return t ? t.split(/\s+/) : ["*"];
  }

  /**
   * Gets the HTTP method for forwarding requests.
   * @returns {string} HTTP method (uppercase)
   * @default "POST"
   */
  get method() {
    return (this.getAttribute("method") || "POST").toUpperCase();
  }

  /**
   * Gets whether to include credentials in requests.
   * @returns {boolean} True if credentials should be included
   * @default true
   */
  get withCredentials() {
    return (this.getAttribute("with-credentials") || "").toLowerCase() !== "false";
  }

  /**
   * Gets whether forwarding is enabled.
   * @returns {boolean} True if forwarding is enabled
   * @default true
   */
  get enabled() {
    const v = (this.getAttribute("enabled") || "true").toLowerCase();
    return v !== "false" && v !== "0";
  }

  /**
   * Gets custom HTTP headers to include in forwarding requests.
   * Supports both JSON object format and semicolon-separated format.
   * @returns {Object} Headers as key-value pairs
   * @example
   * headers='{"Authorization":"Bearer token"}'
   * headers="Authorization: Bearer token; X-Custom: value"
   */
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

  /**
   * Restarts the forwarder by stopping and starting.
   * @private
   */
  #restart() {
    this.#stop();
    this.#start();
  }

  /**
   * Stops forwarding and cleans up subscriptions and timers.
   * @private
   */
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

  /**
   * Starts forwarding messages matching configured topics.
   * Sets up subscription and garbage collection timer.
   * @private
   */
  #start() {
    if (!this.dest || !this.enabled) return;
    this._off = this.pc.subscribe(this.topics, (m) => this.#send(m));
    this._gcTimer = setInterval(() => this.#gc(), 3e4);
  }

  /**
   * Sends a message to the HTTP endpoint.
   * Includes deduplication to prevent sending the same message twice.
   * @private
   * @async
   * @param {Object} m - Message to forward
   * @param {string} m.topic - Message topic
   * @param {*} m.data - Message data
   * @param {string} [m.id] - Message ID for deduplication
   * @param {number} [m.ts] - Message timestamp
   * @param {boolean} [m.retain] - Whether message is retained
   */
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

  /**
   * Garbage collection for deduplication set.
   * Clears the set of recently sent message IDs periodically.
   * @private
   */
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
