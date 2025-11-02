import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that connects pan-bus topics to a REST API.
 * Automatically handles CRUD operations for a resource via HTTP requests.
 *
 * @fires {resource}.list.state - Published with list of items from API
 * @fires {resource}.item.state.{id} - Published with individual item state
 *
 * @attr {string} resource - Resource name for pub/sub topics (default: "items")
 * @attr {string} key - Property name used as unique identifier (default: "id")
 * @attr {string} base-url - Base URL for API requests
 * @attr {string} list-path - Path for list endpoint (default: "/{resource}")
 * @attr {string} item-path - Path for item endpoint with :id placeholder (default: "/{resource}/:id")
 * @attr {string} update-method - HTTP method for updates: PUT or PATCH (default: "PUT")
 * @attr {string} credentials - Fetch credentials mode: "omit", "same-origin", or "include"
 *
 * @example
 * <pan-data-connector
 *   resource="users"
 *   base-url="https://api.example.com"
 *   list-path="/users"
 *   item-path="/users/:id"
 *   update-method="PUT">
 *   <script type="application/json">
 *     {
 *       "credentials": "include",
 *       "headers": {
 *         "Authorization": "Bearer token123"
 *       }
 *     }
 *   </script>
 * </pan-data-connector>
 */
class PanDataConnector extends HTMLElement {
  /**
   * Creates a new PanDataConnector instance
   */
  constructor() {
    super();
    this.pc = new PanClient(this);
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   * Initializes configuration and subscribes to CRUD topics
   */
  connectedCallback() {
    this.resource = (this.getAttribute("resource") || "items").trim();
    this.key = (this.getAttribute("key") || "id").trim();
    this.baseUrl = (this.getAttribute("base-url") || "").trim().replace(/\/?$/, "");
    this.listPath = (this.getAttribute("list-path") || `/${this.resource}`).trim();
    this.itemPath = (this.getAttribute("item-path") || `/${this.resource}/:id`).trim();
    this.updateMethod = (this.getAttribute("update-method") || "PUT").toUpperCase();
    this.credentials = (this.getAttribute("credentials") || "").trim();
    this.opts = this.#loadOpts();
    const listGet = `${this.resource}.list.get`;
    const itemGet = `${this.resource}.item.get`;
    const itemSave = `${this.resource}.item.save`;
    const itemDelete = `${this.resource}.item.delete`;
    this.off = [
      this.pc.subscribe(listGet, (m) => this.#onListGet(m)),
      this.pc.subscribe(itemGet, (m) => this.#onItemGet(m)),
      this.pc.subscribe(itemSave, (m) => this.#onItemSave(m)),
      this.pc.subscribe(itemDelete, (m) => this.#onItemDelete(m))
    ];
    this.#refreshList();
  }

  /**
   * Lifecycle: Called when element is removed from the DOM
   */
  disconnectedCallback() {
    this.off?.forEach((f) => f && f());
  }
  /**
   * Load fetch options from inline JSON script
   * @private
   * @returns {Object} Fetch options
   */
  #loadOpts() {
    let o = {};
    const script = this.querySelector('script[type="application/json"]');
    if (script && script.textContent?.trim()) {
      try {
        o = JSON.parse(script.textContent.trim());
      } catch {
      }
    }
    if (this.credentials) o.credentials = this.credentials;
    return o;
  }

  /**
   * Build full URL from path
   * @private
   * @param {string} path - Path to append to base URL
   * @returns {string} Full URL
   */
  #url(path) {
    if (!path.startsWith("/")) path = "/" + path;
    return `${this.baseUrl}${path}`;
  }

  /**
   * Build query string from parameters
   * @private
   * @param {Object} params - Query parameters
   * @returns {string} Query string with leading ?
   */
  #qs(params) {
    const p = params && typeof params === "object" ? Object.entries(params).filter(([_, v]) => v !== void 0 && v !== null) : [];
    if (!p.length) return "";
    const s = new URLSearchParams();
    for (const [k, v] of p) {
      if (Array.isArray(v)) v.forEach((x) => s.append(k, String(x)));
      else s.append(k, String(v));
    }
    return `?${s.toString()}`;
  }

  /**
   * Fetch JSON from URL with error handling
   * @private
   * @param {string} url - URL to fetch
   * @param {Object} [options] - Fetch options
   * @param {string} [options.method='GET'] - HTTP method
   * @param {*} [options.body] - Request body
   * @returns {Promise<*>} Parsed JSON response
   * @throws {Object} Error object with status, statusText, and body
   */
  async #fetchJson(url, { method = "GET", body } = {}) {
    const init = Object.assign({ method }, this.opts);
    init.headers = Object.assign({ "Content-Type": "application/json" }, this.opts?.headers || {});
    if (body !== void 0) init.body = typeof body === "string" ? body : JSON.stringify(body);
    const res = await fetch(url, init);
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
    }
    if (!res.ok) {
      const err = { status: res.status, statusText: res.statusText, body: json ?? text };
      throw err;
    }
    return json;
  }
  /**
   * Publish list state to pan-bus
   * @private
   * @param {Array} items - Array of items
   */
  #publishListState(items) {
    this.pc.publish({ topic: `${this.resource}.list.state`, data: { items: Array.isArray(items) ? items : [] }, retain: true });
  }

  /**
   * Publish item state to pan-bus
   * @private
   * @param {Object|*} item - Item object or ID
   * @param {Object} [opts={}] - Options
   * @param {boolean} [opts.deleted] - Whether item was deleted
   */
  #publishItemState(item, opts = {}) {
    try {
      const id = item && typeof item === "object" ? item[this.key] ?? item.id : item;
      if (id == null) return;
      if (opts && opts.deleted) {
        this.pc.publish({ topic: `${this.resource}.item.state.${id}`, data: { id, deleted: true } });
      } else {
        this.pc.publish({ topic: `${this.resource}.item.state.${id}`, data: { item }, retain: true });
      }
    } catch {
    }
  }

  /**
   * Fetch list from API and publish state
   * @private
   * @param {Object} [params] - Query parameters
   * @returns {Promise<Array>} Array of items
   */
  async #refreshList(params) {
    try {
      const url = this.#url(this.listPath) + this.#qs(params);
      const data = await this.#fetchJson(url, { method: "GET" });
      const items = Array.isArray(data) ? data : data?.items || data?.data || [];
      this.#publishListState(items);
      return items;
    } catch (e) {
      this.#publishListState([]);
      return [];
    }
  }

  /**
   * Handle list.get message
   * @private
   * @param {Object} m - Message with optional query parameters
   */
  async #onListGet(m) {
    const items = await this.#refreshList(m?.data);
    if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, items } });
  }

  /**
   * Handle item.get message
   * @private
   * @param {Object} m - Message with item ID
   */
  async #onItemGet(m) {
    const id = m?.data?.[this.key] ?? m?.data?.id ?? m?.data;
    const url = this.#url(this.itemPath.replace(":id", encodeURIComponent(String(id))));
    try {
      const item = await this.#fetchJson(url, { method: "GET" });
      this.#publishItemState(item);
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, item } });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: err } });
    }
  }

  /**
   * Handle item.save message - creates or updates item
   * @private
   * @param {Object} m - Message with item data
   */
  async #onItemSave(m) {
    let item = m?.data?.item ?? m?.data;
    if (!item || typeof item !== "object") item = {};
    const hasId = !!item[this.key];
    const method = hasId ? this.updateMethod || "PUT" : "POST";
    const url = hasId ? this.#url(this.itemPath.replace(":id", encodeURIComponent(String(item[this.key])))) : this.#url(this.listPath);
    try {
      const saved = await this.#fetchJson(url, { method, body: item });
      const out = Object.assign({}, item, saved || {});
      if (!out[this.key] && item[this.key]) out[this.key] = item[this.key];
      this.#publishItemState(out);
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, item: out } });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: err } });
    }
    await this.#refreshList();
  }

  /**
   * Handle item.delete message
   * @private
   * @param {Object} m - Message with item ID
   */
  async #onItemDelete(m) {
    const id = m?.data?.[this.key] ?? m?.data?.id ?? m?.data;
    const url = this.#url(this.itemPath.replace(":id", encodeURIComponent(String(id))));
    try {
      await this.#fetchJson(url, { method: "DELETE" });
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, id } });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: err, id } });
    }
    this.#publishItemState(id, { deleted: true });
    await this.#refreshList();
  }
}
customElements.define("pan-data-connector", PanDataConnector);
var pan_data_connector_default = PanDataConnector;
export {
  PanDataConnector,
  pan_data_connector_default as default
};
//# sourceMappingURL=pan-data-connector.js.map
