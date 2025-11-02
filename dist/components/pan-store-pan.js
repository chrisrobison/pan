import { PanClient } from "./pan-client.mjs";

/**
 * @typedef {Object} SyncItemOptions
 * @property {string} [resource="items"] - The resource name for pub/sub topics
 * @property {string|number|null} [id=null] - Initial item ID to sync
 * @property {string} [key="id"] - Property name to use as the unique identifier
 * @property {boolean} [live=true] - Enable real-time synchronization
 * @property {boolean} [autoSave=true] - Automatically save changes to the store
 * @property {number} [debounceMs=300] - Debounce delay for auto-save in milliseconds
 * @property {boolean} [followSelect=true] - Follow item selection events
 */

/**
 * @typedef {Object} Store
 * @property {Function} _setAll - Internal method to set all store properties
 * @property {Function} patch - Method to partially update store properties
 * @property {Function} snapshot - Method to get current store state
 * @property {Function} subscribe - Method to subscribe to store changes
 */

/**
 * Synchronizes a single item between a store and the Pan message bus.
 * Handles real-time updates, auto-save with debouncing, and item selection.
 *
 * @param {Store} store - The store instance to synchronize
 * @param {SyncItemOptions} [options] - Configuration options
 * @returns {Function} Cleanup function to unsubscribe and clear timers
 *
 * @example
 * // Basic usage with a store
 * const store = createStore({ name: '', status: '' });
 * const cleanup = syncItem(store, {
 *   resource: 'tasks',
 *   id: '123',
 *   live: true,
 *   autoSave: true
 * });
 *
 * @example
 * // Following selection events
 * const cleanup = syncItem(store, {
 *   resource: 'notes',
 *   followSelect: true,
 *   debounceMs: 500
 * });
 *
 * @example
 * // Cleanup when done
 * cleanup();
 */
function syncItem(store, { resource = "items", id = null, key = "id", live = true, autoSave = true, debounceMs = 300, followSelect = true } = {}) {
  const pc = new PanClient();
  let currentId = id;
  let offLive = null;
  let offSel = null;
  let saving = false;
  let t = null;
  let applying = 0;

  /**
   * Applies an item to the store without triggering auto-save.
   * @param {Object} item - The item data to apply
   * @private
   */
  function applyItem(item) {
    applying++;
    try {
      if (item && typeof item === "object") store._setAll(item);
    } finally {
      applying--;
    }
  }

  /**
   * Subscribes to live updates for the current item.
   * Unsubscribes from previous item if necessary.
   * @private
   */
  function subscribeLive() {
    try {
      offLive && offLive();
    } catch {
    }
    offLive = null;
    if (!live || !currentId) return;
    offLive = pc.subscribe(`${resource}.item.state.${currentId}`, (m) => {
      const d = m?.data || {};
      if (d.deleted) {
        if (String(currentId) === String(d.id)) applyItem({});
        return;
      }
      if (d.item) applyItem(d.item);
      else if (d.patch) store.patch(d.patch);
      else if (d && typeof d === "object") store.patch(d);
    }, { retained: true });
  }

  /**
   * Handles store changes and triggers debounced auto-save.
   * @private
   */
  function onStoreChange() {
    if (!autoSave || !currentId) return;
    if (applying > 0) return;
    clearTimeout(t);
    t = setTimeout(async () => {
      try {
        saving = true;
        const item = store.snapshot();
        await pc.request(`${resource}.item.save`, { item });
      } catch {
      } finally {
        saving = false;
      }
    }, Math.max(0, debounceMs | 0));
  }
  const unsubStore = store.subscribe(onStoreChange);
  if (followSelect) offSel = pc.subscribe(`${resource}.item.select`, async (m) => {
    const sel = m?.data?.id;
    if (!sel) return;
    currentId = sel;
    subscribeLive();
    try {
      const { data } = await pc.request(`${resource}.item.get`, { id: sel });
      if (data?.item) applyItem(data.item);
    } catch {
    }
  });
  if (currentId) {
    subscribeLive();
    (async () => {
      try {
        const { data } = await pc.request(`${resource}.item.get`, { id: currentId });
        if (data?.item) applyItem(data.item);
      } catch {
      }
    })();
  }
  return () => {
    try {
      offLive && offLive();
    } catch {
    }
    try {
      offSel && offSel();
    } catch {
    }
    try {
      unsubStore && unsubStore();
    } catch {
    }
    clearTimeout(t);
  };
}

/**
 * @typedef {Object} SyncListOptions
 * @property {string} [resource="items"] - The resource name for pub/sub topics
 * @property {string} [key="id"] - Property name to use as the unique identifier
 * @property {boolean} [live=true] - Enable real-time synchronization for individual items
 */

/**
 * Synchronizes a list of items between a store and the Pan message bus.
 * Handles list state updates and live item modifications.
 *
 * @param {Store} store - The store instance to synchronize
 * @param {SyncListOptions} [options] - Configuration options
 * @returns {Function} Cleanup function to unsubscribe from topics
 *
 * @example
 * // Basic usage
 * const store = createStore({ items: [] });
 * const cleanup = syncList(store, {
 *   resource: 'todos',
 *   key: 'id',
 *   live: true
 * });
 *
 * @example
 * // Without live updates
 * const cleanup = syncList(store, {
 *   resource: 'tasks',
 *   live: false
 * });
 *
 * @example
 * // Cleanup when done
 * cleanup();
 */
function syncList(store, { resource = "items", key = "id", live = true } = {}) {
  const pc = new PanClient();
  let items = [];

  /**
   * Renders the current items array to the store.
   * @private
   */
  function render() {
    store._setAll({ items });
  }

  /**
   * Applies an individual item update to the items array.
   * Handles item creation, updates, and deletion.
   * @param {Object} d - The data containing item changes
   * @param {string} [topic] - The topic string (used to extract ID if needed)
   * @private
   */
  function applyItem(d, topic) {
    let id = d?.id ?? d?.item?.[key] ?? d?.item?.id;
    if (id == null && topic) {
      const parts = String(topic).split(".");
      id = parts[parts.length - 1];
    }
    if (id == null) return;
    const idx = items.findIndex((x) => String(x?.[key] ?? x?.id) === String(id));
    if (d.deleted) {
      if (idx >= 0) items.splice(idx, 1);
      return;
    }
    if (d.item && typeof d.item === "object") {
      if (idx >= 0) items[idx] = d.item;
      else items.push(d.item);
      return;
    }
    const patch = d.patch || d;
    if (patch && typeof patch === "object") {
      const base = idx >= 0 ? items[idx] : {};
      const next = Object.assign({}, base, patch);
      if (idx >= 0) items[idx] = next;
      else items.push(next);
    }
  }
  const offA = pc.subscribe(`${resource}.list.state`, (m) => {
    items = m?.data?.items || [];
    render();
  }, { retained: true });
  const offB = live ? pc.subscribe(`${resource}.item.state.*`, (m) => {
    applyItem(m?.data || {}, m?.topic);
    render();
  }) : null;
  pc.publish({ topic: `${resource}.list.get`, data: {} });
  return () => {
    try {
      offA && offA();
    } catch {
    }
    try {
      offB && offB();
    } catch {
    }
  };
}
var pan_store_pan_default = { syncItem, syncList };
export {
  pan_store_pan_default as default,
  syncItem,
  syncList
};
//# sourceMappingURL=pan-store-pan.js.map
