import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that provides IndexedDB access via pan-bus topics.
 * Automatically manages database initialization, schema, and CRUD operations.
 *
 * @fires {store}.idb.ready - Published when database is initialized
 * @fires {store}.idb.result - Published with operation results
 * @fires {store}.idb.error - Published when operations fail
 *
 * @attr {string} database - IndexedDB database name
 * @attr {number} version - Database version number (default: 1)
 * @attr {string} store - Object store name
 * @attr {string} key-path - Key path for object store (default: "id")
 * @attr {boolean} auto-increment - Enable auto-incrementing keys
 * @attr {string} indexes - JSON array of index definitions
 *
 * @typedef {Object} IndexDefinition
 * @property {string} name - Index name
 * @property {string} keyPath - Property path to index
 * @property {boolean} [unique=false] - Whether index values must be unique
 * @property {boolean} [multiEntry=false] - Whether to create entries for array values
 *
 * @example
 * <pan-idb
 *   database="myapp"
 *   version="1"
 *   store="users"
 *   key-path="id"
 *   indexes='[{"name":"email","keyPath":"email","unique":true}]'>
 * </pan-idb>
 */
class PanIDB extends HTMLElement {
  static get observedAttributes() {
    return ["database", "version", "store", "key-path", "auto-increment", "indexes"];
  }

  /**
   * Creates a new PanIDB instance
   */
  constructor() {
    super();
    this.pc = new PanClient(this);
    /** @type {IDBDatabase|null} */
    this.db = null;
    /** @type {Promise|null} */
    this.initPromise = null;
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   */
  connectedCallback() {
    this.#init();
    this.#subscribe();
  }

  /**
   * Lifecycle: Called when element is removed from the DOM
   */
  disconnectedCallback() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  /**
   * Lifecycle: Called when an observed attribute changes
   * @param {string} name - Attribute name
   */
  attributeChangedCallback(name) {
    if (["database", "version", "store"].includes(name) && this.isConnected) {
      if (this.db) {
        this.db.close();
        this.db = null;
      }
      this.#init();
    }
  }

  /**
   * Get the database name
   * @returns {string} Database name
   */
  get database() {
    return this.getAttribute("database") || "";
  }

  /**
   * Get the database version
   * @returns {number} Version number
   */
  get version() {
    return Number(this.getAttribute("version")) || 1;
  }

  /**
   * Get the object store name
   * @returns {string} Store name
   */
  get store() {
    return this.getAttribute("store") || "";
  }

  /**
   * Get the key path for the object store
   * @returns {string} Key path
   */
  get keyPath() {
    return this.getAttribute("key-path") || "id";
  }

  /**
   * Check if auto-increment is enabled
   * @returns {boolean} True if auto-increment enabled
   */
  get autoIncrement() {
    return this.hasAttribute("auto-increment");
  }

  /**
   * Get index definitions from attribute
   * @returns {IndexDefinition[]} Array of index definitions
   */
  get indexes() {
    const attr = this.getAttribute("indexes");
    if (!attr) return [];
    try {
      return JSON.parse(attr);
    } catch {
      return [];
    }
  }

  /**
   * Get an item by key from IndexedDB
   * @param {*} key - Item key
   * @returns {Promise<*>} Item value
   */
  async get(key) {
    await this.initPromise;
    return this.#transaction("readonly", (store) => store.get(key));
  }

  /**
   * Put an item into IndexedDB (add or update)
   * @param {Object} item - Item to store
   * @returns {Promise<*>} Item key
   */
  async put(item) {
    await this.initPromise;
    return this.#transaction("readwrite", (store) => store.put(item));
  }

  /**
   * Add a new item to IndexedDB (fails if key exists)
   * @param {Object} item - Item to store
   * @returns {Promise<*>} Item key
   */
  async add(item) {
    await this.initPromise;
    return this.#transaction("readwrite", (store) => store.add(item));
  }

  /**
   * Delete an item by key from IndexedDB
   * @param {*} key - Item key
   * @returns {Promise<void>}
   */
  async delete(key) {
    await this.initPromise;
    return this.#transaction("readwrite", (store) => store.delete(key));
  }

  /**
   * Clear all items from the object store
   * @returns {Promise<void>}
   */
  async clear() {
    await this.initPromise;
    return this.#transaction("readwrite", (store) => store.clear());
  }

  /**
   * List items from the object store with optional filtering
   * @param {Object} [options={}] - Query options
   * @param {string} [options.index] - Index name to query
   * @param {IDBKeyRange} [options.range] - Key range to filter
   * @param {string} [options.direction='next'] - Cursor direction
   * @param {number} [options.limit] - Maximum number of results
   * @returns {Promise<Array>} Array of items
   */
  async list(options = {}) {
    await this.initPromise;
    const { index, range, direction = "next", limit } = options;
    return this.#transaction("readonly", (store) => {
      const source = index ? store.index(index) : store;
      const request = range ? source.openCursor(range, direction) : source.openCursor(null, direction);
      return new Promise((resolve, reject) => {
        const results = [];
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor && (!limit || results.length < limit)) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  /**
   * Query items by index value
   * @param {string} index - Index name
   * @param {*} value - Value to match
   * @returns {Promise<Array>} Array of matching items
   */
  async query(index, value) {
    await this.initPromise;
    return this.#transaction("readonly", (store) => {
      return store.index(index).getAll(value);
    });
  }

  /**
   * Count items in store or index
   * @param {string} [index] - Optional index name
   * @returns {Promise<number>} Item count
   */
  async count(index) {
    await this.initPromise;
    return this.#transaction("readonly", (store) => {
      const source = index ? store.index(index) : store;
      return source.count();
    });
  }
  /**
   * Initialize IndexedDB connection and create object store if needed
   * @private
   */
  #init() {
    if (!this.database || !this.store) return;
    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this.database, this.version);
      request.onerror = () => {
        const error = request.error?.message || "Failed to open database";
        this.#publishError("init", error);
        reject(new Error(error));
      };
      request.onsuccess = () => {
        this.db = request.result;
        this.db.onerror = (e) => {
          this.#publishError("db", e.target.error?.message || "Database error");
        };
        this.pc.publish({
          topic: `${this.store}.idb.ready`,
          data: { database: this.database, store: this.store }
        });
        resolve();
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.store)) {
          const store = db.createObjectStore(this.store, {
            keyPath: this.keyPath,
            autoIncrement: this.autoIncrement
          });
          for (const idx of this.indexes) {
            if (idx.name && idx.keyPath) {
              store.createIndex(idx.name, idx.keyPath, {
                unique: idx.unique || false,
                multiEntry: idx.multiEntry || false
              });
            }
          }
        }
      };
    });
  }

  /**
   * Subscribe to IDB operation topics on pan-bus
   * @private
   */
  #subscribe() {
    const resource = this.store;
    if (!resource) return;
    this.pc.subscribe(`${resource}.idb.get`, async (msg) => {
      try {
        const data = await this.get(msg.data.key);
        this.#publishResult("get", { item: data }, msg.id);
      } catch (error) {
        this.#publishError("get", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.put`, async (msg) => {
      try {
        const key = await this.put(msg.data.item);
        this.#publishResult("put", { key }, msg.id);
      } catch (error) {
        this.#publishError("put", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.add`, async (msg) => {
      try {
        const key = await this.add(msg.data.item);
        this.#publishResult("add", { key }, msg.id);
      } catch (error) {
        this.#publishError("add", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.delete`, async (msg) => {
      try {
        await this.delete(msg.data.key);
        this.#publishResult("delete", { key: msg.data.key }, msg.id);
      } catch (error) {
        this.#publishError("delete", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.clear`, async (msg) => {
      try {
        await this.clear();
        this.#publishResult("clear", {}, msg.id);
      } catch (error) {
        this.#publishError("clear", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.list`, async (msg) => {
      try {
        const items = await this.list(msg.data);
        this.#publishResult("list", { items }, msg.id);
      } catch (error) {
        this.#publishError("list", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.query`, async (msg) => {
      try {
        const items = await this.query(msg.data.index, msg.data.value);
        this.#publishResult("query", { items }, msg.id);
      } catch (error) {
        this.#publishError("query", error.message, msg.id);
      }
    });
    this.pc.subscribe(`${resource}.idb.count`, async (msg) => {
      try {
        const count = await this.count(msg.data.index);
        this.#publishResult("count", { count }, msg.id);
      } catch (error) {
        this.#publishError("count", error.message, msg.id);
      }
    });
  }

  /**
   * Execute a transaction on the object store
   * @private
   * @param {string} mode - Transaction mode: "readonly" or "readwrite"
   * @param {Function} callback - Callback receiving the object store
   * @returns {Promise<*>} Transaction result
   */
  #transaction(mode, callback) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Database not initialized"));
        return;
      }
      try {
        const tx = this.db.transaction(this.store, mode);
        const store = tx.objectStore(this.store);
        const request = callback(store);
        if (request && request.onsuccess !== void 0) {
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } else if (request instanceof Promise) {
          request.then(resolve).catch(reject);
        } else {
          resolve(request);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Publish operation result to pan-bus
   * @private
   * @param {string} operation - Operation name
   * @param {Object} data - Result data
   * @param {*} requestId - Request ID for correlation
   */
  #publishResult(operation, data, requestId) {
    this.pc.publish({
      topic: `${this.store}.idb.result`,
      data: {
        operation,
        success: true,
        ...data,
        requestId
      }
    });
  }

  /**
   * Publish operation error to pan-bus
   * @private
   * @param {string} operation - Operation name
   * @param {string} error - Error message
   * @param {*} requestId - Request ID for correlation
   */
  #publishError(operation, error, requestId) {
    this.pc.publish({
      topic: `${this.store}.idb.error`,
      data: {
        operation,
        success: false,
        error,
        requestId
      }
    });
  }
}
customElements.define("pan-idb", PanIDB);
var pan_idb_default = PanIDB;
export {
  PanIDB,
  pan_idb_default as default
};
//# sourceMappingURL=pan-idb.js.map
