import { PanClient } from "./pan-client.mjs";

/**
 * PanPhpConnector - PHP API connector with pagination support.
 *
 * Connects Pan message bus to a PHP-based API backend with support for
 * infinite scrolling, pagination, and filtering. Maintains local state
 * of fetched items and supports incremental loading.
 *
 * @class PanPhpConnector
 * @extends HTMLElement
 *
 * @fires {resource}.list.state - When list data changes
 * @fires {resource}.list.meta - When metadata (pagination, total) updates
 *
 * @example
 * <!-- Basic PHP API connector -->
 * <pan-php-connector
 *   resource="products"
 *   api-url="/api.php"
 *   page-size="20"
 *   fields="id,name,price"
 *   start-param="start">
 * </pan-php-connector>
 *
 * @example
 * // Fetch initial data
 * pc.publish({topic: 'products.list.get', data: {}});
 *
 * // Load more items (pagination)
 * pc.publish({topic: 'products.list.more', data: {}});
 *
 * // Filter and search
 * pc.publish({
 *   topic: 'products.list.get',
 *   data: {
 *     reset: true,
 *     filters: [{field: 'category', value: 'electronics'}]
 *   }
 * });
 */
class PanPhpConnector extends HTMLElement {
  /**
   * Observes changes to connector configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["resource", "api-url", "fields", "page-size", "start-param"];
  }

  /**
   * Creates a new PanPhpConnector instance.
   * Initializes the PanClient and state management.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Array} Array of fetched items */
    this.items = [];
    /** @private {Object} Pagination and count metadata */
    this.meta = { total: null, start: 0, count: 0, page: null };
    /** @private {Function[]} Array of unsubscribe functions */
    this._offs = [];
    /** @private {boolean} Indicates if a fetch operation is in progress */
    this._busy = false;
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Initializes subscriptions to list control messages.
   */
  connectedCallback() {
    this.#rewire();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Cleans up all subscriptions.
   */
  disconnectedCallback() {
    this.#unsubAll();
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Reinitializes subscriptions.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#rewire();
  }

  /**
   * Gets the resource name for API requests.
   * @returns {string} Resource name
   * @default "items"
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Gets the PHP API endpoint URL.
   * @returns {string} API URL
   * @default "api.php"
   */
  get apiUrl() {
    return (this.getAttribute("api-url") || "api.php").trim();
  }

  /**
   * Gets the comma-separated list of fields to fetch.
   * @returns {string} Field list
   */
  get fields() {
    return (this.getAttribute("fields") || "").trim();
  }

  /**
   * Gets the page size for pagination.
   * @returns {number} Number of items per page
   * @default 20
   */
  get pageSize() {
    const n = Number(this.getAttribute("page-size"));
    return Number.isFinite(n) && n > 0 ? n : 20;
  }

  /**
   * Gets the query parameter name for pagination offset.
   * @returns {string} Parameter name
   * @default "start"
   */
  get startParam() {
    return (this.getAttribute("start-param") || "start").trim();
  }

  /**
   * Sets up message subscriptions for list operations.
   * @private
   */
  #rewire() {
    this.#unsubAll();
    const r = this.resource;
    this._offs.push(this.pc.subscribe(`${r}.list.get`, (m) => this.#onListGet(m)));
    this._offs.push(this.pc.subscribe(`${r}.list.more`, (m) => this.#onListMore(m)));
    this._offs.push(this.pc.subscribe(`${r}.list.reset`, () => this.#resetAndFetch()));
  }

  /**
   * Unsubscribes from all message topics.
   * @private
   */
  #unsubAll() {
    try {
      this._offs.forEach((f) => f && f());
    } catch {
    }
    this._offs = [];
  }

  /**
   * Handles list.get requests.
   * Resets state if start parameter is 0 or reset flag is set.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object} [m.data] - Request parameters
   * @param {number} [m.data.start] - Starting offset
   * @param {boolean} [m.data.reset] - Force reset
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onListGet(m) {
    const data = m && m.data || {};
    const hasStart = Object.prototype.hasOwnProperty.call(data, this.startParam);
    if (!hasStart || (Number(data[this.startParam]) || 0) === 0 || data.reset) this.#reset();
    await this.#fetchPage(data);
    if (m && m.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, items: this.items, meta: this.meta } });
  }

  /**
   * Handles list.more requests for pagination.
   * Appends results to existing items.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object} [m.data] - Request parameters
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onListMore(m) {
    const data = m && m.data || {};
    data[this.startParam] = this.meta.start || 0;
    await this.#fetchPage(data);
    if (m && m.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, items: this.items, meta: this.meta } });
  }

  /**
   * Resets items and metadata to initial state.
   * @private
   */
  #reset() {
    this.items = [];
    this.meta = { total: null, start: 0, count: 0, page: null };
    this.#publishState();
  }

  /**
   * Resets state and fetches fresh data.
   * @private
   * @async
   */
  async #resetAndFetch() {
    this.#reset();
    await this.#fetchPage({});
  }

  /**
   * Publishes current list state and metadata.
   * @private
   * @fires {resource}.list.state
   * @fires {resource}.list.meta
   */
  #publishState() {
    this.pc.publish({ topic: `${this.resource}.list.state`, data: { items: this.items.slice() }, retain: true });
    this.pc.publish({ topic: `${this.resource}.list.meta`, data: Object.assign({}, this.meta) });
  }

  /**
   * Builds the API URL with query parameters.
   * @private
   * @param {Object} params - Request parameters
   * @param {string} [params.fields] - Override fields list
   * @param {Array|string} [params.filters] - Filter criteria
   * @param {string|number} [params.id] - Specific item ID
   * @returns {string} Complete API URL with query string
   */
  #buildUrl(params) {
    const qp = new URLSearchParams();
    qp.set("x", "get");
    qp.set("rsc", this.resource);
    qp.set("page_size", String(this.pageSize));
    const fields = params && params.fields ? String(params.fields).trim() : this.fields;
    if (fields) qp.set("fields", fields);
    const startVal = Number(params && Object.prototype.hasOwnProperty.call(params, this.startParam) ? params[this.startParam] : this.meta.start || 0) || 0;
    qp.set(this.startParam, String(startVal));
    if (params && params.filters != null) {
      try {
        const f = Array.isArray(params.filters) ? params.filters : JSON.parse(String(params.filters));
        qp.set("filters", JSON.stringify(f));
      } catch {
        qp.set("filters", String(params.filters));
      }
    }
    if (params && params.id != null) qp.set("id", String(params.id));
    return `${this.apiUrl}?${qp.toString()}`;
  }

  /**
   * Fetches a page of data from the PHP API.
   * Appends results to items array and updates metadata.
   * @private
   * @async
   * @param {Object} params - Request parameters
   * @fires {resource}.list.meta - On error or after successful fetch
   */
  async #fetchPage(params) {
    if (this._busy) return;
    this._busy = true;
    try {
      const url = this.#buildUrl(params || {});
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = await res.json();
      let rows = [];
      if (Array.isArray(body)) rows = body;
      else if (body && Array.isArray(body.results)) rows = body.results;
      const before = this.items.length;
      if (rows && rows.length) {
        this.items.push(...rows);
        this.meta.start = (this.meta.start || 0) + rows.length;
        this.meta.count = rows.length;
      } else {
        this.meta.count = 0;
      }
      if (body && typeof body.total !== "undefined") {
        const total = typeof body.total === "number" ? body.total : Number(body.total);
        if (Number.isFinite(total)) this.meta.total = total;
      }
      if (body && typeof body.page !== "undefined") {
        const page = typeof body.page === "number" ? body.page : Number(body.page);
        if (Number.isFinite(page)) this.meta.page = page;
      }
      if (this.items.length !== before || this.meta.count === 0) this.#publishState();
    } catch (e) {
      this.pc.publish({ topic: `${this.resource}.list.meta`, data: Object.assign({}, this.meta, { error: String(e && e.message || e) }) });
    } finally {
      this._busy = false;
    }
  }
}
customElements.define("pan-php-connector", PanPhpConnector);
var pan_php_connector_default = PanPhpConnector;
export {
  PanPhpConnector,
  pan_php_connector_default as default
};
//# sourceMappingURL=pan-php-connector.js.map
