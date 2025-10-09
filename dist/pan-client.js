// Minimal PanClient ESM helper for PAN (Page Area Network)
// Usage:
//   import { PanClient } from './pan-client.js';
//   const pc = new PanClient(myElement);
//   pc.publish({ topic:'demo.click', data:{...} });
//   const off = pc.subscribe('demo.*', m => { ... });

export class PanClient {
  /**
   * @param {HTMLElement|Document} host
   * @param {string} busSelector css selector for the bus element (unused, for compatibility)
   */
  constructor(host = document, busSelector = 'pan-bus') {
    this.host = host;
    this.bus = /** @type {HTMLElement|null} */(document.querySelector(busSelector));
    if (!this.bus) {
      // Do not throw to allow late bus; ready() will resolve on pan:sys.ready
    }
    const tag = host instanceof HTMLElement ? host.tagName.toLowerCase() + (host.id ? ('#' + host.id) : '') : 'doc';
    this.clientId = `${tag}#${Math.random().toString(36).slice(2, 8)}`;
    this._ready = new Promise((res) => {
      const onReady = () => { document.removeEventListener('pan:sys.ready', onReady, true); res(); };
      if (globalThis.window && window.__panReady) return res();
      document.addEventListener('pan:sys.ready', onReady, true);
    }).then(() => {
      this._dispatch('pan:hello', { id: this.clientId, caps: ['client'] });
    });
  }

  ready() { return this._ready; }

  /** @param {string} type @param {any} detail */
  _dispatch(type, detail) {
    this.host.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /**
   * Publish a message
   * @param {{topic:string,data:any,id?:string,ts?:number,replyTo?:string,correlationId?:string,retain?:boolean,headers?:Record<string,string>}} msg
   */
  publish(msg) { this._dispatch('pan:publish', msg); }

  /**
   * Subscribe to one or more topics. Returns an unsubscribe function.
   * @param {string|string[]} topics
   * @param {(m:any)=>void} handler
   * @param {{ retained?: boolean, signal?: AbortSignal }=} opts
   */
  subscribe(topics, handler, opts = {}) {
    topics = Array.isArray(topics) ? topics : [topics];
    const onDeliver = (ev) => {
      const m = ev.detail; if (!m || !m.topic) return;
      if (topics.some((t) => PanClient.matches(m.topic, t))) handler(m);
    };
    this.host.addEventListener('pan:deliver', onDeliver);
    this._dispatch('pan:subscribe', { clientId: this.clientId, topics, options: { retained: !!opts.retained } });
    const off = () => {
      this.host.removeEventListener('pan:deliver', onDeliver);
      this._dispatch('pan:unsubscribe', { clientId: this.clientId, topics });
    };
    if (opts.signal) {
      const onAbort = () => { off(); opts.signal?.removeEventListener('abort', onAbort); };
      opts.signal.addEventListener('abort', onAbort, { once: true });
    }
    return off;
  }

  /**
   * Request/Reply convenience helper. Resolves with the reply message.
   * @param {string} topic
   * @param {any} data
   * @param {{ timeoutMs?: number }=} options
   */
  request(topic, data, { timeoutMs = 5000 } = {}) {
    const correlationId = crypto.randomUUID();
    const replyTo = `pan:$reply:${this.clientId}:${correlationId}`;
    return new Promise((resolve, reject) => {
      const off = this.subscribe(replyTo, (m) => {
        clearTimeout(timer);
        off();
        resolve(m);
      });
      const timer = setTimeout(() => { off(); reject(new Error('PAN request timeout')); }, timeoutMs);
      this.publish({ topic, data, replyTo, correlationId });
    });
  }

  /** topic pattern matcher: supports '*', segment wildcards (foo.*, *.bar, foo.*.baz) */
  static matches(topic, pattern) {
    if (pattern === '*' || topic === pattern) return true;
    if (pattern && pattern.includes('*')) {
      const esc = (s) => s.replace(/[|\\{}()\[\]^$+?.]/g, '\\$&').replace(/\*/g, '[^.]+');
      const rx = new RegExp(`^${esc(pattern)}$`);
      return rx.test(topic);
    }
    return false;
  }
}

export default PanClient;

