import { PanClient } from "./pan-client.mjs";

/**
 * PanQuery - Query state management component for list/table operations.
 *
 * Manages query parameters (search, sorting, pagination) and synchronizes them
 * with URL state (hash or search params). Automatically triggers data fetching
 * when parameters change with configurable debouncing.
 *
 * @class PanQuery
 * @extends HTMLElement
 *
 * @fires {resource}.query.state - When query state changes
 * @fires {resource}.list.get - When requesting list data with current query
 *
 * @example
 * <!-- Basic query management -->
 * <pan-query
 *   resource="products"
 *   defaults='{"page":1,"size":20}'
 *   sync-url="search"
 *   debounce-ms="300">
 * </pan-query>
 *
 * @example
 * <!-- With inline defaults -->
 * <pan-query resource="users" sync-url="hash">
 *   <script type="application/json">
 *   {
 *     "page": 1,
 *     "size": 50,
 *     "sort": "name",
 *     "q": ""
 *   }
 *   </script>
 * </pan-query>
 *
 * @example
 * // Subscribe to query state changes
 * pc.subscribe('products.query.state', (msg) => {
 *   console.log('Query:', msg.data); // {page: 1, size: 20, q: "search"}
 * });
 *
 * // Update query parameters
 * pc.publish({
 *   topic: 'products.query.set',
 *   data: {page: 2, q: "widgets"}
 * });
 */
class PanQuery extends HTMLElement {
  /**
   * Observes changes to query configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["resource", "defaults", "sync-url", "debounce-ms", "auto-request"];
  }

  /**
   * Creates a new PanQuery instance.
   * Initializes the PanClient and query state.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Object} Current query state */
    this.state = {};
    /** @private {Object} Default query parameters */
    this.defaults = {};
    /** @private {number|null} Debounce timer ID */
    this._timer = null;
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Initializes query state and subscriptions.
   */
  connectedCallback() {
    this.#init();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Cleans up subscriptions and timers.
   */
  disconnectedCallback() {
    this.off?.forEach((f) => f && f());
    this.off = null;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Reinitializes the query component.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#init();
  }

  /**
   * Gets the resource name for query operations.
   * Used as a prefix for all published topics.
   * @returns {string} Resource name
   * @default "items"
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Gets the debounce delay in milliseconds.
   * Delays automatic requests after query changes.
   * @returns {number} Debounce delay in milliseconds
   * @default 150
   */
  get debounceMs() {
    const n = Number(this.getAttribute("debounce-ms"));
    return Number.isFinite(n) && n >= 0 ? n : 150;
  }

  /**
   * Gets whether to automatically request data on query changes.
   * @returns {boolean} True if auto-request is enabled
   * @default true
   */
  get autoRequest() {
    const v = (this.getAttribute("auto-request") || "true").toLowerCase();
    return v !== "false" && v !== "0";
  }

  /**
   * Gets the URL synchronization mode.
   * @returns {"search"|"hash"|""} URL sync mode or empty string if disabled
   */
  get syncUrl() {
    const v = (this.getAttribute("sync-url") || "").toLowerCase();
    return v === "search" || v === "hash" ? v : "";
  }

  /**
   * Initializes query state from defaults and URL.
   * Sets up subscriptions for query control messages.
   * @private
   */
  #init() {
    this.defaults = this.#readDefaults();
    const urlParams = this.#readUrl();
    this.state = Object.assign({}, this.defaults, urlParams);
    this.#publishState();
    if (this.autoRequest) this.#requestList();
    this.off?.forEach((f) => f && f());
    this.off = [
      this.pc.subscribe(`${this.resource}.query.set`, (m) => this.#merge(m?.data || {})),
      this.pc.subscribe(`${this.resource}.query.reset`, () => this.#reset())
    ];
  }

  /**
   * Reads default query parameters from attribute or inline script.
   * @private
   * @returns {Object} Default query parameters
   */
  #readDefaults() {
    let d = {};
    const attr = this.getAttribute("defaults");
    if (attr) {
      try {
        d = JSON.parse(attr);
      } catch {
      }
    }
    const script = this.querySelector('script[type="application/json"]');
    if (script && script.textContent?.trim()) {
      try {
        d = Object.assign({}, d, JSON.parse(script.textContent.trim()));
      } catch {
      }
    }
    return d;
  }

  /**
   * Reads query parameters from URL (search params or hash).
   * Extracts standard query fields: q, sort, page, size.
   * @private
   * @returns {Object} Query parameters from URL
   */
  #readUrl() {
    if (!this.syncUrl) return {};
    try {
      const src = this.syncUrl === "search" ? new URL(location.href).searchParams : new URLSearchParams((location.hash || "").replace(/^#\??/, ""));
      const pick = (k) => src.has(k) ? src.get(k) : void 0;
      const out = {};
      const q = pick("q");
      if (q != null) out.q = q;
      const sort = pick("sort");
      if (sort != null) out.sort = sort;
      const page = pick("page");
      if (page != null) out.page = Number(page) || 1;
      const size = pick("size");
      if (size != null) out.size = Number(size) || 50;
      return out;
    } catch {
      return {};
    }
  }

  /**
   * Writes current query parameters to URL.
   * Updates either search params or hash based on syncUrl setting.
   * @private
   */
  #writeUrl() {
    if (!this.syncUrl) return;
    try {
      const params = new URLSearchParams();
      const { q, sort, page, size } = this.state;
      if (q) params.set("q", String(q));
      if (sort) params.set("sort", String(sort));
      if (page != null) params.set("page", String(page));
      if (size != null) params.set("size", String(size));
      if (this.syncUrl === "search") {
        const url = new URL(location.href);
        url.search = params.toString();
        history.replaceState(null, "", url.toString());
      } else {
        const s = params.toString();
        location.hash = s ? "#" + s : "";
      }
    } catch {
    }
  }

  /**
   * Publishes current query state as a retained message.
   * @private
   * @fires {resource}.query.state
   */
  #publishState() {
    this.pc.publish({ topic: `${this.resource}.query.state`, data: Object.assign({}, this.state), retain: true });
  }

  /**
   * Publishes a list.get request with current query parameters.
   * @private
   * @fires {resource}.list.get
   */
  #requestList() {
    const data = Object.assign({}, this.state);
    this.pc.publish({ topic: `${this.resource}.list.get`, data });
  }

  /**
   * Merges new parameters into query state.
   * Updates URL, publishes state, and triggers debounced request.
   * @private
   * @param {Object} patch - Parameters to merge into current state
   */
  #merge(patch) {
    this.state = Object.assign({}, this.state, patch || {});
    this.#publishState();
    this.#writeUrl();
    if (this.autoRequest) this.#debounced();
  }

  /**
   * Resets query state to defaults.
   * Updates URL, publishes state, and triggers debounced request.
   * @private
   */
  #reset() {
    this.state = Object.assign({}, this.defaults);
    this.#publishState();
    this.#writeUrl();
    if (this.autoRequest) this.#debounced();
  }

  /**
   * Triggers a debounced list request.
   * If debouncing is disabled, requests immediately.
   * @private
   */
  #debounced() {
    if (!this.debounceMs) return this.#requestList();
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.#requestList(), this.debounceMs);
  }
}
customElements.define("pan-query", PanQuery);
var pan_query_default = PanQuery;
export {
  PanQuery,
  pan_query_default as default
};
//# sourceMappingURL=pan-query.js.map
