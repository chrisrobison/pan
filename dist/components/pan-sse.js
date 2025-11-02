import { PanClient } from "./pan-client.mjs";

/**
 * PanSSE - Server-Sent Events (SSE) integration component for the Pan message bus.
 *
 * Establishes a persistent connection to an SSE endpoint and publishes incoming events
 * to the Pan message bus. Supports automatic reconnection with exponential backoff,
 * topic filtering, and last event ID persistence.
 *
 * @class PanSSE
 * @extends HTMLElement
 *
 * @fires pan:sse:connected - When SSE connection is established
 * @fires pan:sse:error - When an SSE error occurs
 * @fires {string} topic - Publishes messages to topics based on incoming event types or data
 *
 * @example
 * <!-- Basic SSE connection -->
 * <pan-sse src="/events" topics="notifications updates"></pan-sse>
 *
 * @example
 * <!-- With credentials and persistence -->
 * <pan-sse
 *   src="/api/events"
 *   topics="user.* system.alerts"
 *   with-credentials="true"
 *   persist-last-event="my-app-events"
 *   backoff="2000,30000">
 * </pan-sse>
 *
 * @example
 * <!-- Server event format -->
 * // Server should send events like:
 * // event: user.login
 * // data: {"topic": "user.login", "data": {"userId": 123}}
 * // id: event-1234
 */
class PanSSE extends HTMLElement {
  /**
   * Observes changes to SSE configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["src", "topics", "with-credentials", "persist-last-event", "backoff"];
  }

  /**
   * Creates a new PanSSE instance.
   * Initializes the PanClient, EventSource, and internal state.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {EventSource|null} Active EventSource connection */
    this.es = null;
    /** @private {boolean} Indicates if component has been disconnected */
    this._stopped = false;
    /** @private {number|null} Reconnection timer ID */
    this._timer = null;
  }
  /**
   * Lifecycle callback when element is added to the DOM.
   * Initiates the SSE connection.
   */
  connectedCallback() {
    this.#start();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Stops the connection and prevents reconnection attempts.
   */
  disconnectedCallback() {
    this._stopped = true;
    this.#stop();
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Restarts the SSE connection with new configuration.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#restart();
  }

  /**
   * Gets the SSE endpoint URL.
   * @returns {string} The endpoint URL or empty string
   */
  get src() {
    return (this.getAttribute("src") || "").trim();
  }

  /**
   * Gets the list of topics to subscribe to via query parameter.
   * Topics are space-separated in the attribute.
   * @returns {string[]} Array of topic patterns
   */
  get topics() {
    const t = (this.getAttribute("topics") || "").trim();
    return t ? t.split(/\s+/) : [];
  }

  /**
   * Gets whether to include credentials in the SSE request.
   * Defaults to true unless explicitly set to "false".
   * @returns {boolean} True if credentials should be included
   */
  get withCredentials() {
    return (this.getAttribute("with-credentials") || "").toLowerCase() !== "false";
  }

  /**
   * Gets the localStorage key for persisting the last event ID.
   * Enables resuming from the last received event after page reload.
   * @returns {string} The persistence key or empty string if disabled
   */
  get persistKey() {
    return (this.getAttribute("persist-last-event") || "").trim();
  }

  /**
   * Gets the reconnection backoff configuration.
   * Format: "min,max" in milliseconds.
   * @returns {{min: number, max: number}} Backoff timing configuration
   * @default {min: 1000, max: 15000}
   */
  get backoff() {
    const s = (this.getAttribute("backoff") || "1000,15000").split(",").map((x) => Number(x) || 0);
    const [min, max] = [Math.max(100, s[0] || 1e3), Math.max(s[1] || s[0] || 5e3, s[0] || 1e3)];
    return { min, max };
  }
  /**
   * Restarts the SSE connection by stopping and starting.
   * @private
   */
  #restart() {
    this.#stop();
    this.#start();
  }

  /**
   * Stops the current SSE connection and clears reconnection timer.
   * @private
   */
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

  /**
   * Builds the SSE connection URL with topics and last event ID parameters.
   * @private
   * @returns {string} The complete URL with query parameters
   */
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

  /**
   * Starts the SSE connection and sets up event handlers.
   * Handles incoming messages and publishes them to the Pan bus.
   * @private
   */
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

  /**
   * Schedules a reconnection attempt with exponential backoff.
   * Uses randomized delay within the configured min/max range.
   * @private
   */
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
