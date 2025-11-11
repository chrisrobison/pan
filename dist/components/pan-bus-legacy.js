class PanBus extends HTMLElement {
  /**
   * Creates a PAN Bus instance
   * Initializes internal subscription list, retained message store, and client registry
   */
  constructor() {
    super();
    this.subs = [];
    this.retained = /* @__PURE__ */ new Map();
    this.clients = /* @__PURE__ */ new Map();
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   * Sets up event listeners in capture phase and announces readiness
   * @private
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
   * Lifecycle: Called when element is removed from the DOM
   * Cleans up all event listeners
   * @private
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
   * Handles client registration (pan:hello events)
   * Clients can announce themselves with capabilities
   *
   * @param {CustomEvent} e - Hello event with {id, caps} in detail
   * @private
   */
  onHello = (e) => {
    const d = e.detail || {};
    if (d.id) this.clients.set(d.id, { el: this._et(e), caps: d.caps || [] });
  };
  /**
   * Handles subscription requests (pan:subscribe events)
   * Adds subscriptions and optionally delivers retained messages
   *
   * @param {CustomEvent} e - Subscribe event with {topics, options, clientId} in detail
   * @param {string[]} e.detail.topics - Array of topic patterns to subscribe to
   * @param {Object} [e.detail.options] - Subscription options
   * @param {boolean} [e.detail.options.retained] - Whether to receive retained messages
   * @param {string} [e.detail.clientId] - Optional client identifier
   * @private
   */
  onSubscribe = (e) => {
    const { topics = [], options = {}, clientId } = e.detail || {};
    const el = this._et(e);
    for (const pattern of topics) {
      this.subs.push({ pattern, el, clientId, retained: !!options.retained });
    }
    if (options.retained) {
      for (const [topic, msg] of this.retained) {
        if (topics.some((p) => PanBus.matches(topic, p))) {
          this._deliver(el, msg);
        }
      }
    }
  };
  /**
   * Handles unsubscribe requests (pan:unsubscribe events)
   * Removes matching subscriptions for the client
   *
   * @param {CustomEvent} e - Unsubscribe event with {topics, clientId} in detail
   * @param {string[]} e.detail.topics - Array of topic patterns to unsubscribe from
   * @param {string} [e.detail.clientId] - Optional client identifier
   * @private
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
   * Handles publish and request events (pan:publish, pan:request)
   * Routes message to all matching subscribers and optionally retains it
   *
   * @param {CustomEvent} e - Publish/request event with PanMessage in detail
   * @param {string} e.detail.topic - Topic to publish on
   * @param {*} e.detail.data - Message payload
   * @param {boolean} [e.detail.retain] - Whether to retain this message
   * @private
   */
  onPublish = (e) => {
    const base = e.detail || {};
    const msg = Object.assign({
      ts: Date.now(),
      id: crypto.randomUUID()
    }, base);
    if (msg.retain) {
      this.retained.set(msg.topic, msg);
    }
    for (const s of this.subs) {
      if (PanBus.matches(msg.topic, s.pattern)) {
        this._deliver(s.el, msg);
      }
    }
  };
  /**
   * Handles reply events (pan:reply)
   * Routes reply to subscribers waiting on the reply topic
   *
   * @param {CustomEvent} e - Reply event with PanMessage in detail
   * @param {string} e.detail.topic - Reply topic (from replyTo)
   * @param {*} e.detail.data - Reply payload
   * @param {string} [e.detail.correlationId] - Correlation ID matching the request
   * @private
   */
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) {
      if (PanBus.matches(msg.topic, s.pattern)) {
        this._deliver(s.el, msg);
      }
    }
  };
  /**
   * Delivers a message to a target element
   * Dispatches a pan:deliver CustomEvent on the target
   *
   * @param {Element} target - Element to deliver message to
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
   * Gets the event target, traversing composed path if available
   * Handles shadow DOM traversal
   *
   * @param {Event} e - Event to get target from
   * @returns {Element} The actual event target
   * @private
   */
  _et(e) {
    return typeof e.composedPath === "function" ? e.composedPath()[0] : e.target || document;
  }
  /**
   * Checks if a topic matches a pattern
   * Supports exact match, single wildcard (*), or wildcard in pattern (users.*)
   *
   * @param {string} topic - Topic to test (e.g., "users.list.state")
   * @param {string} pattern - Pattern to match against (e.g., "users.*" or "users.list.state")
   * @returns {boolean} True if topic matches pattern
   * @static
   *
   * @example
   * PanBus.matches('users.list.state', 'users.*')  // true
   * PanBus.matches('users.list.state', 'users.list.state')  // true
   * PanBus.matches('users.list.state', '*')  // true
   * PanBus.matches('users.list.state', 'posts.*')  // false
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
customElements.define("pan-bus", PanBus);
var pan_bus_legacy_default = PanBus;
export {
  PanBus,
  pan_bus_legacy_default as default
};
//# sourceMappingURL=pan-bus-legacy.js.map
