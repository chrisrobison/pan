/**
 * @fileoverview PanBus - Central message bus for Pan framework
 * Provides publish/subscribe messaging between components
 * @module pan-bus
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
 * @typedef {Object} Subscription
 * @property {string} pattern - Topic pattern to match (supports wildcards)
 * @property {Element} el - The subscribing element
 * @property {string} [clientId] - Optional client identifier
 * @property {boolean} retained - Whether subscriber wants retained messages
 */

/**
 * PanBus custom element - Central message bus for component communication
 * Handles publish/subscribe messaging with support for wildcards, retained messages, and request/reply
 * @class
 * @extends HTMLElement
 * @example
 * // PanBus is automatically created by pan-autoload
 * const bus = document.querySelector('pan-bus');
 */
class PanBus extends HTMLElement {
  /**
   * Creates a new PanBus instance
   */
  constructor() {
    super();
    /**
     * Active subscriptions
     * @type {Subscription[]}
     */
    this.subs = [];
    /**
     * Retained messages by topic
     * @type {Map<string, PanMessage>}
     */
    this.retained = /* @__PURE__ */ new Map();
    /**
     * Registered clients by ID
     * @type {Map<string, {el: Element, caps: string[]}>}
     */
    this.clients = /* @__PURE__ */ new Map();
  }
  /**
   * Called when element is connected to the DOM
   * Sets up event listeners and signals system ready
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
   * Called when element is disconnected from the DOM
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
   * Handles client registration
   * @param {CustomEvent} e - The pan:hello event
   */
  onHello = (e) => {
    const d = e.detail || {};
    if (d.id) this.clients.set(d.id, { el: this._et(e), caps: d.caps || [] });
  };
  /**
   * Handles subscription requests
   * @param {CustomEvent} e - The pan:subscribe event with topics and options
   */
  onSubscribe = (e) => {
    const { topics = [], options = {}, clientId } = e.detail || {};
    const el = this._et(e);
    for (const pattern of topics) this.subs.push({ pattern, el, clientId, retained: !!options.retained });
    if (options.retained) {
      for (const [topic, msg] of this.retained) {
        if (topics.some((p) => PanBus.matches(topic, p))) this._deliver(el, msg);
      }
    }
  };
  /**
   * Handles unsubscription requests
   * @param {CustomEvent} e - The pan:unsubscribe event with topics to unsubscribe from
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
   * Handles message publication
   * @param {CustomEvent} e - The pan:publish or pan:request event with message data
   */
  onPublish = (e) => {
    const base = e.detail || {};
    const msg = Object.assign({ ts: Date.now(), id: crypto.randomUUID() }, base);
    if (msg.retain) this.retained.set(msg.topic, msg);
    for (const s of this.subs) if (PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Handles reply messages (for request/reply pattern)
   * @param {CustomEvent} e - The pan:reply event with reply data
   */
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) if (PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Delivers a message to a target element
   * @param {Element} target - The element to deliver the message to
   * @param {PanMessage} msg - The message to deliver
   * @private
   */
  _deliver(target, msg) {
    try {
      target.dispatchEvent(new CustomEvent("pan:deliver", { detail: msg }));
    } catch (_) {
    }
  }
  /**
   * Gets the event target from a composed event
   * @param {Event} e - The event object
   * @returns {Element|Document} The original event target
   * @private
   */
  _et(e) {
    return typeof e.composedPath === "function" ? e.composedPath()[0] : e.target || document;
  }
  /**
   * Checks if a topic matches a subscription pattern
   * Supports wildcards: "*" matches all, "foo.*" matches foo.bar, "*.bar" matches foo.bar
   * @param {string} topic - The message topic
   * @param {string} pattern - The subscription pattern
   * @returns {boolean} True if the topic matches the pattern
   * @static
   * @example
   * PanBus.matches("user.login", "user.*") // true
   * PanBus.matches("user.login", "user.logout") // false
   * PanBus.matches("user.login", "*") // true
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
var pan_bus_default = PanBus;
export {
  PanBus,
  pan_bus_default as default
};
//# sourceMappingURL=pan-bus.js.map
