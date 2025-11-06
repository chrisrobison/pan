// src/index.js
var PanBus = class _PanBus extends HTMLElement {
  constructor() {
    super();
    this.subs = [];
    this.retained = /* @__PURE__ */ new Map();
    this.clients = /* @__PURE__ */ new Map();
  }
  /**
   * Lifecycle method called when element is added to the DOM
   * Sets up event listeners and announces bus readiness
   */
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
  /**
   * Lifecycle method called when element is removed from the DOM
   * Cleans up event listeners
   */
  disconnectedCallback() {
    document.removeEventListener("pan:publish", this.onPublish, true);
    document.removeEventListener("pan:request", this.onPublish, true);
    document.removeEventListener("pan:reply", this.onReply, true);
    document.removeEventListener("pan:subscribe", this.onSubscribe, true);
    document.removeEventListener("pan:unsubscribe", this.onUnsubscribe, true);
    document.removeEventListener("pan:hello", this.onHello, true);
  }
  /**
   * Handle client registration
   * @param {CustomEvent} e - Event containing client ID and capabilities
   */
  onHello = (e) => {
    const d = e.detail || {};
    if (d.id) this.clients.set(d.id, { el: this._et(e), caps: d.caps || [] });
  };
  /**
   * Handle subscription requests
   * @param {CustomEvent} e - Event containing topics to subscribe to and options
   */
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
  /**
   * Handle unsubscription requests
   * @param {CustomEvent} e - Event containing topics to unsubscribe from
   */
  onUnsubscribe = (e) => {
    const { topics = [], clientId } = e.detail || {};
    const el = this._et(e);
    this.subs = this.subs.filter((s) => {
      const sameClient = clientId ? s.clientId === clientId : s.el === el;
      return !(sameClient && topics.includes(s.pattern));
    });
  };
  /**
   * Handle message publication
   * @param {CustomEvent} e - Event containing message to publish
   */
  onPublish = (e) => {
    const base = e.detail || {};
    const msg = Object.assign({ ts: Date.now(), id: crypto.randomUUID() }, base);
    if (msg.retain) this.retained.set(msg.topic, msg);
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Handle reply messages
   * @param {CustomEvent} e - Event containing reply message
   */
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Deliver a message to a target element
   * @param {HTMLElement|Document} target - Target to deliver to
   * @param {PanMessage} msg - Message to deliver
   * @private
   */
  _deliver(target, msg) {
    try {
      target.dispatchEvent(new CustomEvent("pan:deliver", { detail: msg }));
    } catch (_) {
    }
  }
  /**
   * Get event target accounting for composed path
   * @param {Event} e - Event to extract target from
   * @returns {HTMLElement|Document} Event target
   * @private
   */
  _et(e) {
    return typeof e.composedPath === "function" ? e.composedPath()[0] : e.target || document;
  }
  /**
   * Check if a topic matches a subscription pattern
   * Supports wildcards: 'user.*', '*.update', 'user.*.state'
   *
   * @param {string} topic - Topic to test (e.g., 'user.login')
   * @param {string} pattern - Pattern to match against (e.g., 'user.*')
   * @returns {boolean} True if topic matches pattern
   *
   * @example
   * PanBus.matches('user.login', 'user.*')  // true
   * PanBus.matches('user.login', '*.login') // true
   * PanBus.matches('user.login', 'admin.*') // false
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
};
if (typeof customElements !== "undefined" && !customElements.get("pan-bus")) {
  customElements.define("pan-bus", PanBus);
}
var PanClient = class _PanClient {
  /**
   * Creates a new PAN client
   *
   * @param {HTMLElement|Document} [host=document] - Element to dispatch/receive events from
   * @param {string} [busSelector='pan-bus'] - CSS selector for bus element
   *
   * @example
   * // Use document as host (default)
   * const client = new PanClient();
   *
   * // Use custom element as host
   * const client = new PanClient(this);
   *
   * // Specify custom bus selector
   * const client = new PanClient(document, 'my-custom-bus');
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
  /**
   * Returns a promise that resolves when the PAN bus is ready
   *
   * Always await this before publishing or subscribing to ensure
   * the bus is initialized and ready to handle messages.
   *
   * @returns {Promise<void>} Promise that resolves when bus is ready
   *
   * @example
   * const client = new PanClient();
   * await client.ready();
   * client.pub('app.initialized', {});
   */
  ready() {
    return this._ready;
  }
  /**
   * Dispatch a custom event on the host element
   * @param {string} type - Event type
   * @param {*} detail - Event detail
   * @private
   */
  _dispatch(type, detail) {
    this.host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  /**
   * Publishes a message to the PAN bus
   *
   * The message will be routed to all matching subscribers. If `retain: true`,
   * the message will be stored for late subscribers.
   *
   * @param {PanMessage} msg - Message to publish
   *
   * @example
   * client.publish({
   *   topic: 'user.login',
   *   data: { userId: 123, username: 'alice' },
   *   retain: true,
   *   headers: { 'x-request-id': '123' }
   * });
   */
  publish(msg) {
    this._dispatch("pan:publish", msg);
  }
  /**
   * Convenience method to publish a message
   *
   * Simpler API for common use cases when you just need to publish
   * a topic and data without additional message fields.
   *
   * @param {string} topic - Topic identifier
   * @param {*} [data] - Message payload
   * @param {{retain?: boolean}} [options] - Additional options
   *
   * @example
   * client.pub('user.login', { userId: 123 });
   * client.pub('app.ready', { version: '1.0' }, { retain: true });
   */
  pub(topic, data, options = {}) {
    this.publish({ topic, data, ...options });
  }
  /**
   * Subscribes to one or more topic patterns
   *
   * Supports wildcard patterns:
   * - `user.*` matches `user.login`, `user.logout`, etc.
   * - `*.update` matches `user.update`, `post.update`, etc.
   * - `user.*.state` matches `user.123.state`, `user.456.state`, etc.
   * - `*` matches all topics (use with caution)
   *
   * @param {string|string[]} topics - Topic pattern(s) to subscribe to
   * @param {MessageHandler} handler - Function to handle received messages
   * @param {SubscribeOptions} [opts] - Subscription options
   * @returns {UnsubscribeFunction} Function to unsubscribe
   *
   * @example
   * // Subscribe to single topic
   * const unsub = client.subscribe('user.login', (msg) => {
   *   console.log('User logged in:', msg.data);
   * });
   *
   * // Subscribe to multiple topics
   * client.subscribe(['user.*', 'admin.*'], (msg) => {
   *   console.log('Event:', msg.topic, msg.data);
   * });
   *
   * // Get retained messages immediately
   * client.subscribe('app.state', (msg) => {
   *   console.log('State:', msg.data);
   * }, { retained: true });
   *
   * // Auto-cleanup with AbortSignal
   * const controller = new AbortController();
   * client.subscribe('temp.*', handleTemp, { signal: controller.signal });
   * // Later: controller.abort(); // automatically unsubscribes
   *
   * // Manual cleanup
   * const unsub = client.subscribe('user.*', handler);
   * unsub(); // unsubscribe
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
   *
   * @param {string|string[]} topics - Topic pattern(s) to subscribe to
   * @param {MessageHandler} handler - Function to handle received messages
   * @param {SubscribeOptions} [opts] - Subscription options
   * @returns {UnsubscribeFunction} Function to unsubscribe
   *
   * @example
   * client.sub('user.*', (msg) => console.log(msg.data));
   */
  sub(topics, handler, opts) {
    return this.subscribe(topics, handler, opts);
  }
  /**
   * Sends a request and waits for a reply
   *
   * Implements request/reply pattern using correlation IDs.
   * Returns a promise that resolves with the reply message.
   *
   * @param {string} topic - Request topic
   * @param {*} [data] - Request payload
   * @param {RequestOptions} [options] - Request options
   * @returns {Promise<PanMessage>} Promise that resolves with reply message
   * @throws {Error} If request times out
   *
   * @example
   * try {
   *   const response = await client.request('api.user.get', { id: 123 });
   *   console.log('User:', response.data);
   * } catch (error) {
   *   console.error('Request failed:', error);
   * }
   *
   * @example
   * // Custom timeout
   * const response = await client.request(
   *   'api.slow.operation',
   *   { params: {} },
   *   { timeoutMs: 10000 }
   * );
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
   * Check if a topic matches a pattern
   *
   * Static utility method for pattern matching. Supports wildcards:
   * - `*` matches anything
   * - `foo.*` matches `foo.bar`, `foo.baz`, etc.
   * - `*.bar` matches `foo.bar`, `baz.bar`, etc.
   * - `foo.*.baz` matches `foo.bar.baz`, `foo.qux.baz`, etc.
   *
   * @param {string} topic - Topic to test (e.g., 'user.login')
   * @param {string} pattern - Pattern to match against (e.g., 'user.*')
   * @returns {boolean} True if topic matches pattern
   *
   * @example
   * PanClient.matches('user.login', 'user.*')      // true
   * PanClient.matches('user.login', '*.login')     // true
   * PanClient.matches('user.login', 'admin.*')     // false
   * PanClient.matches('user.123.state', 'user.*.state') // true
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
