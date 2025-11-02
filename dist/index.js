/**
 * @fileoverview Pan Framework - Main entry point
 * Combines PanBus and PanClient for convenient importing
 * @module pan
 */

// src/index.js

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
 * @class
 * @extends HTMLElement
 */
var PanBus = class _PanBus extends HTMLElement {
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
   * @param {CustomEvent} e - The pan:subscribe event
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
   * Handles unsubscription requests
   * @param {CustomEvent} e - The pan:unsubscribe event
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
   * @param {CustomEvent} e - The pan:publish or pan:request event
   */
  onPublish = (e) => {
    const base = e.detail || {};
    const msg = Object.assign({ ts: Date.now(), id: crypto.randomUUID() }, base);
    if (msg.retain) this.retained.set(msg.topic, msg);
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Handles reply messages
   * @param {CustomEvent} e - The pan:reply event
   */
  onReply = (e) => {
    const msg = e.detail || {};
    for (const s of this.subs) if (_PanBus.matches(msg.topic, s.pattern)) this._deliver(s.el, msg);
  };
  /**
   * Delivers a message to a target element
   * @param {Element} target - The target element
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
   * @param {string} topic - The message topic
   * @param {string} pattern - The subscription pattern
   * @returns {boolean} True if the topic matches the pattern
   * @static
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
   * @param {HTMLElement|Document} host
   * @param {string} busSelector css selector for the bus element (unused, for compatibility)
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
  ready() {
    return this._ready;
  }
  /** @param {string} type @param {any} detail */
  _dispatch(type, detail) {
    this.host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }
  /**
   * Publish a message
   * @param {{topic:string,data:any,id?:string,ts?:number,replyTo?:string,correlationId?:string,retain?:boolean,headers?:Record<string,string>}} msg
   */
  publish(msg) {
    this._dispatch("pan:publish", msg);
  }
  /**
   * Convenience alias for publish
   * @param {string} topic
   * @param {any} data
   * @param {{retain?:boolean}=} options
   */
  pub(topic, data, options = {}) {
    this.publish({ topic, data, ...options });
  }
  /**
   * Subscribe to one or more topics. Returns an unsubscribe function.
   * @param {string|string[]} topics
   * @param {(m:any)=>void} handler
   * @param {{ retained?: boolean, signal?: AbortSignal }=} opts
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
   */
  sub(topics, handler, opts) {
    return this.subscribe(topics, handler, opts);
  }
  /**
   * Request/Reply convenience helper. Resolves with the reply message.
   * @param {string} topic
   * @param {any} data
   * @param {{ timeoutMs?: number }=} options
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
  /** topic pattern matcher: supports '*', segment wildcards (foo.*, *.bar, foo.*.baz) */
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
