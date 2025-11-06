class PanClient {
  /**
   * Creates a new PAN client
   *
   * @param {HTMLElement|Document} [host=document] - Element to dispatch/receive events from
   * @param {string} [busSelector='pan-bus'] - CSS selector for bus element (for compatibility)
   *
   * @example
   * // Default: use document
   * const client = new PanClient();
   *
   * // Use custom element
   * const myComponent = document.querySelector('my-component');
   * const client = new PanClient(myComponent);
   */
  constructor(host = document, busSelector = "pan-bus") {
    this.host = host;
    this.bus = /** @type {HTMLElement|null} */
    document.querySelector(busSelector);
    const tag = host instanceof HTMLElement ? host.tagName.toLowerCase() + (host.id ? "#" + host.id : "") : "doc";
    this.clientId = `${tag}#${crypto.randomUUID()}`;
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
   * Returns a promise that resolves when the PAN bus is ready
   * Safe to use before bus exists - will wait for pan:sys.ready event
   *
   * @returns {Promise<void>} Resolves when bus is ready
   *
   * @example
   * const client = new PanClient();
   * await client.ready();
   * client.publish({ topic: 'app.started', data: {} });
   */
  ready() {
    return this._ready;
  }
  /**
   * Dispatches a CustomEvent on the host element
   * Events bubble and are composed to cross shadow DOM
   *
   * @param {string} type - Event type (e.g., 'pan:publish')
   * @param {*} detail - Event detail payload
   * @private
   */
  _dispatch(type, detail) {
    this.host.dispatchEvent(
      new CustomEvent(type, { detail, bubbles: true, composed: true })
    );
  }
  /**
   * Publishes a message to the PAN bus
   * Message will be delivered to all matching subscribers
   *
   * @param {PanMessage} msg - Message to publish
   * @param {string} msg.topic - Topic name (required)
   * @param {*} msg.data - Message payload (required)
   * @param {boolean} [msg.retain] - Retain message for late subscribers
   * @param {string} [msg.replyTo] - Topic for replies
   * @param {string} [msg.correlationId] - Correlation ID for request/reply
   *
   * @example
   * // Simple publish
   * client.publish({
   *   topic: 'user.updated',
   *   data: { id: 123, name: 'Alice' }
   * });
   *
   * // Retained message (last value cached)
   * client.publish({
   *   topic: 'users.list.state',
   *   data: { users: [...] },
   *   retain: true
   * });
   */
  publish(msg) {
    this._dispatch("pan:publish", msg);
  }
  /**
   * Subscribes to one or more topic patterns
   * Returns an unsubscribe function to stop receiving messages
   *
   * @param {string|string[]} topics - Topic pattern(s) to subscribe to
   * @param {MessageHandler} handler - Function to handle received messages
   * @param {SubscribeOptions} [opts] - Subscription options
   * @param {boolean} [opts.retained] - Receive retained messages immediately
   * @param {AbortSignal} [opts.signal] - AbortSignal for automatic cleanup
   * @returns {UnsubscribeFunction} Function to unsubscribe
   *
   * @example
   * // Subscribe to single topic
   * const unsub = client.subscribe('users.updated', (msg) => {
   *   console.log('User updated:', msg.data);
   * });
   *
   * // Subscribe to multiple topics with wildcard
   * client.subscribe(['users.*', 'posts.*'], (msg) => {
   *   console.log('Received:', msg.topic, msg.data);
   * });
   *
   * // Get retained messages immediately
   * client.subscribe('app.state', (msg) => {
   *   console.log('Current state:', msg.data);
   * }, { retained: true });
   *
   * // Automatic cleanup with AbortController
   * const controller = new AbortController();
   * client.subscribe('events.*', handler, { signal: controller.signal });
   * // Later: controller.abort(); // Unsubscribes automatically
   */
  subscribe(topics, handler, opts = {}) {
    topics = Array.isArray(topics) ? topics : [topics];
    const onDeliver = (ev) => {
      const m = ev.detail;
      if (!m || !m.topic) return;
      if (topics.some((t) => PanClient.matches(m.topic, t))) {
        handler(m);
      }
    };
    this.host.addEventListener("pan:deliver", onDeliver);
    this._dispatch("pan:subscribe", {
      clientId: this.clientId,
      topics,
      options: { retained: !!opts.retained }
    });
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
   * Sends a request and waits for a reply
   * Implements request/reply pattern with automatic correlation and timeout
   *
   * @param {string} topic - Request topic
   * @param {*} data - Request payload
   * @param {RequestOptions} [options] - Request options
   * @param {number} [options.timeoutMs=5000] - Timeout in milliseconds
   * @returns {Promise<PanMessage>} Promise that resolves with reply message
   * @throws {Error} If request times out
   *
   * @example
   * // Simple request
   * try {
   *   const response = await client.request('users.get', { id: 123 });
   *   console.log('User:', response.data);
   * } catch (err) {
   *   console.error('Request failed:', err);
   * }
   *
   * // Custom timeout
   * const response = await client.request('slow.operation', { ... }, {
   *   timeoutMs: 10000  // 10 second timeout
   * });
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
   * Checks if a topic matches a pattern
   * Supports exact match, global wildcard (*), and segment wildcards (users.*)
   *
   * @param {string} topic - Topic to test (e.g., "users.list.state")
   * @param {string} pattern - Pattern to match (e.g., "users.*" or "*")
   * @returns {boolean} True if topic matches pattern
   * @static
   *
   * @example
   * PanClient.matches('users.list.state', 'users.*')  // true
   * PanClient.matches('users.list.state', 'users.list.state')  // true
   * PanClient.matches('users.list.state', '*')  // true
   * PanClient.matches('users.list.state', 'posts.*')  // false
   * PanClient.matches('users.item.123', 'users.item.*')  // true
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
