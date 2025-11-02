import { PanClient } from "./pan-client.mjs";

/**
 * Generates a unique identifier using crypto.randomUUID or fallback.
 * @private
 * @returns {string} Unique identifier
 */
const uuid = () => globalThis.crypto && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/**
 * PanDataProvider - In-memory mock data provider for prototyping and testing.
 *
 * Provides a complete CRUD (Create, Read, Update, Delete) data layer in memory,
 * with optional localStorage persistence. Useful for prototyping, testing, and
 * demos without a real backend.
 *
 * @class PanDataProvider
 * @extends HTMLElement
 *
 * @fires {resource}.list.state - When list data changes
 * @fires {resource}.item.state.{id} - When individual item state changes
 *
 * @example
 * <!-- Basic mock data provider -->
 * <pan-data-provider resource="tasks" key="id" persist="localstorage">
 *   <script type="application/json">
 *   [
 *     {"id": "1", "title": "First task", "done": false},
 *     {"id": "2", "title": "Second task", "done": true}
 *   ]
 *   </script>
 * </pan-data-provider>
 *
 * @example
 * // CRUD operations
 * const pc = new PanClient();
 *
 * // List all items
 * pc.publish({topic: 'tasks.list.get', data: {}});
 *
 * // Get specific item
 * pc.publish({topic: 'tasks.item.get', data: {id: '1'}});
 *
 * // Create/update item
 * pc.publish({
 *   topic: 'tasks.item.save',
 *   data: {item: {id: '3', title: 'New task', done: false}}
 * });
 *
 * // Delete item
 * pc.publish({topic: 'tasks.item.delete', data: {id: '1'}});
 */
class PanDataProvider extends HTMLElement {
  /**
   * Creates a new PanDataProvider instance.
   * Initializes the PanClient and items array.
   */
  constructor() {
    super();
    /** @private {PanClient} Pan message bus client */
    this.pc = new PanClient(this);
    /** @private {Array} Array of data items */
    this.items = [];
  }

  /**
   * Lifecycle callback when element is added to the DOM.
   * Loads initial data and sets up CRUD subscriptions.
   */
  connectedCallback() {
    /** @type {string} Resource name for this data provider */
    this.resource = (this.getAttribute("resource") || "items").trim();
    /** @type {string} Key field name for identifying items */
    this.key = (this.getAttribute("key") || "id").trim();
    /** @type {boolean} Whether to persist data to localStorage */
    this.persist = (this.getAttribute("persist") || "").toLowerCase() === "localstorage";
    /** @type {string} localStorage key for persistence */
    this.storageKey = `pan:mock:${this.resource}`;
    this.#load();
    const listGet = `${this.resource}.list.get`;
    const itemGet = `${this.resource}.item.get`;
    const itemSave = `${this.resource}.item.save`;
    const itemDelete = `${this.resource}.item.delete`;
    /** @private {Function[]} Array of unsubscribe functions */
    this.off = [
      this.pc.subscribe(listGet, (m) => this.#onListGet(m)),
      this.pc.subscribe(itemGet, (m) => this.#onItemGet(m)),
      this.pc.subscribe(itemSave, (m) => this.#onItemSave(m)),
      this.pc.subscribe(itemDelete, (m) => this.#onItemDelete(m))
    ];
    this.#publishListState();
  }

  /**
   * Lifecycle callback when element is removed from the DOM.
   * Cleans up all subscriptions.
   */
  disconnectedCallback() {
    this.off?.forEach((f) => f && f());
  }

  /**
   * Loads initial data from inline script or localStorage.
   * Priority: inline script > localStorage > empty array.
   * @private
   */
  #load() {
    const script = this.querySelector('script[type="application/json"]');
    if (script && script.textContent?.trim()) {
      try {
        this.items = JSON.parse(script.textContent.trim());
        this.#savePersist();
        return;
      } catch {
      }
    }
    if (this.persist) {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (raw) {
          this.items = JSON.parse(raw);
          return;
        }
      } catch {
      }
    }
    this.items = [];
  }

  /**
   * Saves items to localStorage if persistence is enabled.
   * @private
   */
  #savePersist() {
    if (!this.persist) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch {
    }
  }

  /**
   * Publishes current list state as a retained message.
   * @private
   * @fires {resource}.list.state
   */
  #publishListState() {
    this.pc.publish({ topic: `${this.resource}.list.state`, data: { items: this.items }, retain: true });
  }

  /**
   * Publishes individual item state.
   * @private
   * @param {Object|string|number} item - Item object or ID
   * @param {Object} [opts] - Options
   * @param {boolean} [opts.deleted] - Whether item was deleted
   * @fires {resource}.item.state.{id}
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
   * Handles list.get requests.
   * Returns all items in the collection.
   * @private
   * @param {Object} m - Message object
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  #onListGet(m) {
    const { replyTo } = m;
    if (replyTo) this.pc.publish({ topic: replyTo, correlationId: m.correlationId, data: { items: this.items } });
    this.#publishListState();
  }

  /**
   * Handles item.get requests.
   * Returns a specific item by ID.
   * @private
   * @param {Object} m - Message object
   * @param {Object|string|number} [m.data] - Item ID or object containing ID
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  #onItemGet(m) {
    const id = m?.data?.[this.key] ?? m?.data?.id ?? m?.data;
    const item = this.items.find((x) => String(x[this.key]) === String(id));
    const res = item ? { ok: true, item } : { ok: false, error: "NOT_FOUND", id };
    if (item) this.#publishItemState(item);
    if (m.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: res });
  }

  /**
   * Handles item.save requests.
   * Creates a new item or updates an existing one.
   * Generates a unique ID if not provided.
   * @private
   * @param {Object} m - Message object
   * @param {Object} [m.data] - Item data to save
   * @param {Object} [m.data.item] - Item object (alternative location)
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  #onItemSave(m) {
    let item = m?.data?.item ?? m?.data;
    if (!item || typeof item !== "object") {
      item = {};
    }
    if (!item[this.key]) item[this.key] = uuid();
    const id = item[this.key];
    const idx = this.items.findIndex((x) => String(x[this.key]) === String(id));
    if (idx >= 0) this.items[idx] = Object.assign({}, this.items[idx], item);
    else this.items.push(item);
    this.#savePersist();
    this.#publishListState();
    this.#publishItemState(item);
    if (m.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok: true, item } });
  }

  /**
   * Handles item.delete requests.
   * Removes an item from the collection by ID.
   * @private
   * @param {Object} m - Message object
   * @param {Object|string|number} [m.data] - Item ID or object containing ID
   * @param {string} [m.replyTo] - Topic to send reply to
   * @param {string} [m.correlationId] - Correlation ID for request/response
   */
  #onItemDelete(m) {
    const id = m?.data?.[this.key] ?? m?.data?.id ?? m?.data;
    const before = this.items.length;
    this.items = this.items.filter((x) => String(x[this.key]) !== String(id));
    const ok = this.items.length !== before;
    this.#savePersist();
    this.#publishListState();
    this.#publishItemState(id, { deleted: true });
    if (m.replyTo) this.pc.publish({ topic: m.replyTo, correlationId: m.correlationId, data: { ok, id } });
  }
}
customElements.define("pan-data-provider", PanDataProvider);
var pan_data_provider_mock_default = PanDataProvider;
export {
  PanDataProvider,
  pan_data_provider_mock_default as default
};
//# sourceMappingURL=pan-data-provider-mock.js.map
