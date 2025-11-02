import { PanClient } from "./pan-client.mjs";

/**
 * PanGraphQLConnector - GraphQL API connector for Pan message bus.
 *
 * Connects Pan's standard CRUD message patterns (list.get, item.get, item.save, item.delete)
 * to a GraphQL backend. GraphQL queries and mutations are defined inline as script elements,
 * and response paths are configured via JSON.
 *
 * @class PanGraphQLConnector
 * @extends HTMLElement
 *
 * @fires {resource}.list.state - When list data is fetched
 * @fires {resource}.item.state.{id} - When individual item data is fetched
 *
 * @example
 * <!-- GraphQL connector for products -->
 * <pan-graphql-connector resource="products" endpoint="/graphql" key="id">
 *   <script type="application/graphql" data-op="list">
 *     query GetProducts($q: String, $page: Int) {
 *       products(search: $q, page: $page) {
 *         id name price
 *       }
 *     }
 *   </script>
 *
 *   <script type="application/graphql" data-op="item">
 *     query GetProduct($id: ID!) {
 *       product(id: $id) { id name price description }
 *     }
 *   </script>
 *
 *   <script type="application/graphql" data-op="save">
 *     mutation SaveProduct($item: ProductInput!) {
 *       saveProduct(input: $item) { id name price }
 *     }
 *   </script>
 *
 *   <script type="application/graphql" data-op="delete">
 *     mutation DeleteProduct($id: ID!) {
 *       deleteProduct(id: $id)
 *     }
 *   </script>
 *
 *   <script type="application/json" data-paths>
 *   {
 *     "list": "data.products",
 *     "item": "data.product",
 *     "save": "data.saveProduct",
 *     "delete": "data.deleteProduct"
 *   }
 *   </script>
 * </pan-graphql-connector>
 */
class PanGraphQLConnector extends HTMLElement {
  /**
   * Creates a new PanGraphQLConnector instance.
   * Initializes the PanClient and operation storage.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Function[]} Array of unsubscribe functions */
    this._offs = [];
    /** @private {Object} JSON path mappings for extracting data from GraphQL responses */
    this.paths = {};
    /** @private {Object} GraphQL operation strings keyed by operation name */
    this.ops = {};
  }

  /**
   * Observes changes to connector configuration attributes.
   * @returns {string[]} Array of attribute names to observe
   */
  static get observedAttributes() {
    return ["resource", "endpoint", "key"];
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Initializes GraphQL operations and subscriptions.
   */
  connectedCallback() {
    this.#init();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Cleans up all subscriptions.
   */
  disconnectedCallback() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
  }

  /**
   * Lifecycle callback when observed attributes change.
   * Reinitializes the connector.
   * @param {string} name - The name of the changed attribute
   * @param {string|null} oldValue - The previous attribute value
   * @param {string|null} newValue - The new attribute value
   */
  attributeChangedCallback() {
    this.#init();
  }

  /**
   * Gets the resource name for CRUD operations.
   * @returns {string} Resource name
   * @default "items"
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Gets the GraphQL endpoint URL.
   * @returns {string} GraphQL endpoint URL
   */
  get endpoint() {
    return (this.getAttribute("endpoint") || "").trim();
  }

  /**
   * Gets the key field name for identifying items.
   * @returns {string} Key field name
   * @default "id"
   */
  get key() {
    return (this.getAttribute("key") || "id").trim();
  }

  /**
   * Initializes GraphQL operations and message subscriptions.
   * @private
   */
  #init() {
    this._offs.forEach((f) => f && f());
    this._offs = [];
    this.#loadScripts();
    const r = this.resource;
    this._offs.push(this.pc.subscribe(`${r}.list.get`, (m) => this.#onListGet(m)));
    this._offs.push(this.pc.subscribe(`${r}.item.get`, (m) => this.#onItemGet(m)));
    this._offs.push(this.pc.subscribe(`${r}.item.save`, (m) => this.#onItemSave(m)));
    this._offs.push(this.pc.subscribe(`${r}.item.delete`, (m) => this.#onItemDelete(m)));
  }

  /**
   * Loads GraphQL operations and path mappings from inline script elements.
   * @private
   */
  #loadScripts() {
    this.ops = {};
    this.paths = {};
    this.querySelectorAll('script[type="application/graphql"]').forEach((s) => {
      const op = (s.getAttribute("data-op") || "").trim();
      if (!op) return;
      this.ops[op] = s.textContent || "";
    });
    const pathsNode = this.querySelector('script[type="application/json"][data-paths]');
    if (pathsNode && pathsNode.textContent?.trim()) {
      try {
        this.paths = JSON.parse(pathsNode.textContent.trim());
      } catch {
      }
    }
  }

  /**
   * Executes a GraphQL query or mutation.
   * @private
   * @async
   * @param {string} query - GraphQL query or mutation string
   * @param {Object} [variables] - Variables for the GraphQL operation
   * @returns {Promise<Object>} GraphQL response data
   * @throws {Error} If endpoint is missing or GraphQL errors occur
   */
  async #fetchGQL(query, variables) {
    if (!this.endpoint) throw new Error("Missing endpoint");
    const res = await fetch(this.endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors && json.errors.length) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json;
  }

  /**
   * Extracts data from an object using a dot-notation path.
   * @private
   * @param {Object} obj - Object to extract from
   * @param {string} path - Dot-notation path (e.g., "data.products")
   * @returns {*} Extracted value or undefined
   */
  #path(obj, path) {
    if (!path) return obj;
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return void 0;
      cur = cur[p];
    }
    return cur;
  }

  /**
   * Publishes list state to the message bus.
   * @private
   * @param {Array} items - Array of items
   * @fires {resource}.list.state
   */
  #pubList(items) {
    this.pc.publish({ topic: `${this.resource}.list.state`, data: { items: Array.isArray(items) ? items : [] }, retain: true });
  }

  /**
   * Publishes individual item state to the message bus.
   * @private
   * @param {Object|string|number} item - Item object or ID
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.deleted] - Whether item was deleted
   * @fires {resource}.item.state.{id}
   */
  #pubItem(item, opts = {}) {
    try {
      const id = item && typeof item === "object" ? item[this.key] ?? item.id : item;
      if (id == null) return;
      if (opts.deleted) this.pc.publish({ topic: `${this.resource}.item.state.${id}`, data: { id, deleted: true } });
      else this.pc.publish({ topic: `${this.resource}.item.state.${id}`, data: { item }, retain: true });
    } catch {
    }
  }

  /**
   * Handles list.get requests by executing the list GraphQL query.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object} [m.data] - Query parameters (variables for GraphQL)
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onListGet(m) {
    try {
      const q = this.ops.list;
      if (!q) throw new Error("Missing list GraphQL");
      const json = await this.#fetchGQL(q, m?.data || {});
      const items = this.#path(json, this.paths.list) || [];
      this.#pubList(items);
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, items } });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: String(err && err.message || err) } });
      this.#pubList([]);
    }
  }

  /**
   * Handles item.get requests by executing the item GraphQL query.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object|string|number} [m.data] - Item ID or object containing ID
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onItemGet(m) {
    try {
      const q = this.ops.item;
      if (!q) throw new Error("Missing item GraphQL");
      const vars = { id: m?.data?.[this.key] ?? m?.data?.id ?? m?.data };
      const json = await this.#fetchGQL(q, vars);
      const item = this.#path(json, this.paths.item) || null;
      if (item) this.#pubItem(item);
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: !!item, item } });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: String(err && err.message || err) } });
    }
  }

  /**
   * Handles item.save requests by executing the save GraphQL mutation.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object} [m.data] - Item data to save
   * @param {Object} [m.data.item] - Item object (alternative location)
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onItemSave(m) {
    try {
      const q = this.ops.save;
      if (!q) throw new Error("Missing save GraphQL");
      const item = m?.data?.item ?? m?.data ?? {};
      const id = item?.[this.key] ?? item?.id;
      const vars = Object.assign({ item }, id != null ? { id } : {});
      const json = await this.#fetchGQL(q, vars);
      const saved = this.#path(json, this.paths.save) || item;
      this.#pubItem(saved);
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, item: saved } });
      this.pc.publish({ topic: `${this.resource}.list.get`, data: {} });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: String(err && err.message || err) } });
    }
  }

  /**
   * Handles item.delete requests by executing the delete GraphQL mutation.
   * @private
   * @async
   * @param {Object} m - Message object
   * @param {Object|string|number} [m.data] - Item ID or object containing ID
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  async #onItemDelete(m) {
    try {
      const q = this.ops.delete;
      if (!q) throw new Error("Missing delete GraphQL");
      const id = m?.data?.[this.key] ?? m?.data?.id ?? m?.data;
      const json = await this.#fetchGQL(q, { id });
      const ok = !!this.#path(json, this.paths.delete);
      if (ok) this.#pubItem(id, { deleted: true });
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok, id } });
      this.pc.publish({ topic: `${this.resource}.list.get`, data: {} });
    } catch (err) {
      if (m?.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: false, error: String(err && err.message || err) } });
    }
  }
}
customElements.define("pan-graphql-connector", PanGraphQLConnector);
var pan_graphql_connector_default = PanGraphQLConnector;
export {
  PanGraphQLConnector,
  pan_graphql_connector_default as default
};
//# sourceMappingURL=pan-graphql-connector.js.map
