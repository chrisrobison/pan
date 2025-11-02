/**
 * @fileoverview PanClient - Client library for interacting with PanBus
 * Provides convenient methods for publish/subscribe messaging
 * @module pan-client
 */

/**
 * @typedef {Object} PanMessage
 * @property {string} topic - The message topic/channel
 * @property {*} data - The message payload
 * @property {number} ts - Timestamp when message was created
 * @property {string} id - Unique message identifier
 * @property {string} [replyTo] - Topic to send replies to
 * @property {string} [correlationId] - ID to correlate request/reply pairs
 * @property {boolean} [retain] - Whether to retain this message for future subscribers
 * @property {Record<string,string>} [headers] - Optional message headers
 */

/**
 * @typedef {Object} SubscribeOptions
 * @property {boolean} [retained] - Whether to receive retained messages
 * @property {AbortSignal} [signal] - AbortSignal to cancel the subscription
 */

/**
 * PanClient - Client for interacting with the PanBus message system
 * Provides methods for publishing, subscribing, and request/reply patterns
 * @class
 * @example
 * // Create a client for a component
 * const client = new PanClient(this);
 *
 * // Publish a message
 * client.publish({ topic: "user.login", data: { userId: 123 } });
 *
 * // Subscribe to messages
 * const unsub = client.subscribe("user.*", (msg) => {
 *   console.log("Received:", msg.data);
 * });
 *
 * // Request/reply pattern
 * const reply = await client.request("user.get", { id: 123 });
 */
class PanClient {
  /**
   * Creates a new PanClient instance
   * @param {HTMLElement|Document} host - The host element for this client
   * @param {string} busSelector - CSS selector for the bus element (unused, for compatibility)
   */
  constructor(host = document, busSelector = "pan-bus") {
    /**
     * The host element for this client
     * @type {HTMLElement|Document}
     */
    this.host = host;
    /**
     * Reference to the pan-bus element
     * @type {HTMLElement|null}
     */
    this.bus = /** @type {HTMLElement|null} */
    document.querySelector(busSelector);
    if (!this.bus) {
    }
    const tag = host instanceof HTMLElement ? host.tagName.toLowerCase() + (host.id ? "#" + host.id : "") : "doc";
    /**
     * Unique identifier for this client
     * @type {string}
     */
    this.clientId = `${tag}#${Math.random().toString(36).slice(2, 8)}`;
    /**
     * Promise that resolves when the bus is ready
     * @type {Promise<void>}
     * @private
     */
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
  /**
   * Returns a promise that resolves when the PanBus is ready
   * @returns {Promise<void>}
   */
  ready() {
    return this._ready;
  }
  /**
   * Dispatches a custom event from the host element
   * @param {string} type - The event type
   * @param {*} detail - The event detail/payload
   * @private
   */
  _dispatch(type, detail) {
    this.host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  /**
   * Publishes a message to the bus
   * @param {PanMessage} msg - The message object to publish
   * @example
   * client.publish({
   *   topic: "user.login",
   *   data: { userId: 123, username: "john" }
   * });
   */
  publish(msg) {
    this._dispatch("pan:publish", msg);
  }
  /**
   * Subscribes to one or more topics. Returns an unsubscribe function.
   * @param {string|string[]} topics - Topic(s) to subscribe to (supports wildcards)
   * @param {(msg: PanMessage) => void} handler - Callback function for received messages
   * @param {SubscribeOptions} [opts={}] - Subscription options
   * @returns {() => void} Unsubscribe function
   * @example
   * // Subscribe to a single topic
   * const unsub = client.subscribe("user.login", (msg) => {
   *   console.log("User logged in:", msg.data);
   * });
   *
   * // Subscribe to multiple topics with wildcards
   * client.subscribe(["user.*", "admin.*"], handleMessage);
   *
   * // Unsubscribe later
   * unsub();
   */
  subscribe(topics, handler, opts = {}) {
    topics = Array.isArray(topics) ? topics : [topics];
    const onDeliver = (ev) => {
      const m = ev.detail;
      if (!m || !m.topic) return;
      if (topics.some((t) => PanClient.matches(m.topic, t))) handler(m);
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
   * Request/reply convenience helper. Sends a request and waits for a reply.
   * @param {string} topic - The topic to send the request to
   * @param {*} data - The request payload
   * @param {{ timeoutMs?: number }} [options={}] - Request options
   * @param {number} [options.timeoutMs=5000] - Timeout in milliseconds
   * @returns {Promise<PanMessage>} Promise that resolves with the reply message
   * @throws {Error} Throws if request times out
   * @example
   * try {
   *   const reply = await client.request("user.get", { id: 123 });
   *   console.log("User data:", reply.data);
   * } catch (err) {
   *   console.error("Request timed out");
   * }
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
  /**
   * Checks if a topic matches a subscription pattern
   * Supports wildcards: "*" matches all, "foo.*" matches foo.bar, "*.bar" matches foo.bar
   * @param {string} topic - The message topic
   * @param {string} pattern - The subscription pattern
   * @returns {boolean} True if the topic matches the pattern
   * @static
   * @example
   * PanClient.matches("user.login", "user.*") // true
   * PanClient.matches("user.login", "user.logout") // false
   * PanClient.matches("user.login", "*") // true
   */
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
var pan_client_default = PanClient;
export {
  PanClient,
  pan_client_default as default
};
//# sourceMappingURL=pan-client.js.map
