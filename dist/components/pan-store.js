/**
 * Creates a reactive state store with subscription capabilities.
 * Changes to the state proxy trigger events that subscribers can listen to.
 *
 * @param {Object} [initial={}] - Initial state object
 * @returns {Store} Store object with reactive state and methods
 *
 * @typedef {Object} Store
 * @property {Proxy} state - Reactive state proxy that triggers events on changes
 * @property {Function} subscribe - Subscribe to state changes
 * @property {Function} snapshot - Get immutable snapshot of current state
 * @property {Function} set - Set a single state property
 * @property {Function} patch - Merge an object into the state
 * @property {Function} update - Update state using a reducer function
 * @property {Function} _setAll - Internal method to batch set multiple properties
 *
 * @example
 * const store = createStore({ count: 0, name: 'John' });
 * const unsub = store.subscribe((event) => {
 *   console.log('Changed:', event.detail.key, event.detail.value);
 * });
 * store.state.count = 1; // Triggers subscriber
 * store.patch({ count: 2, age: 30 }); // Batch update
 * unsub(); // Unsubscribe
 */
function createStore(initial = {}) {
  const bus = new EventTarget();
  let updating = false;
  let state = structuredClone(initial);
  const proxy = new Proxy(state, {
    set(obj, key, value) {
      if (Object.is(obj[key], value)) return true;
      obj[key] = value;
      if (!updating) bus.dispatchEvent(new CustomEvent("state", { detail: { key, value, state: proxy } }));
      return true;
    }
  });
  /**
   * Internal helper to batch set multiple properties without triggering events per property
   * @private
   * @param {Object} [obj={}] - Object with properties to set
   */
  const setAll = (obj = {}) => {
    updating = true;
    try {
      for (const [k, v] of Object.entries(obj)) proxy[k] = v;
    } finally {
      updating = false;
    }
  };
  return {
    state: proxy,
    /**
     * Subscribe to state changes
     * @param {Function} fn - Callback function receiving CustomEvent with {key, value, state}
     * @returns {Function} Unsubscribe function
     */
    subscribe(fn) {
      bus.addEventListener("state", fn);
      return () => bus.removeEventListener("state", fn);
    },
    /**
     * Get an immutable snapshot of the current state
     * @returns {Object} Deep clone of current state
     */
    snapshot() {
      return JSON.parse(JSON.stringify(proxy));
    },
    /**
     * Set a single state property
     * @param {string} k - Property key
     * @param {*} v - Property value
     */
    set(k, v) {
      proxy[k] = v;
    },
    /**
     * Merge an object into the state
     * @param {Object} obj - Object to merge into state
     */
    patch(obj) {
      if (obj && typeof obj === "object") setAll(obj);
    },
    /**
     * Update state using a reducer function
     * @param {Function} fn - Reducer function that receives current state and returns new state
     */
    update(fn) {
      const cur = JSON.parse(JSON.stringify(proxy));
      const next = fn(cur) || cur;
      setAll(next);
    },
    _setAll: setAll
  };
}
/**
 * Binds form elements to a store, creating two-way data binding between DOM and state.
 * Automatically handles input, checkbox, and radio inputs.
 *
 * @param {HTMLElement} el - Root element containing the form elements to bind
 * @param {Store} store - Store instance created by createStore()
 * @param {Object.<string, string>} map - Map of CSS selectors to state keys
 * @param {Object} [opts={}] - Options object
 * @param {string[]} [opts.events=['input', 'change']] - DOM events to listen for
 * @returns {Function} Cleanup function to remove all bindings
 *
 * @example
 * const store = createStore({ username: '', agreed: false });
 * const cleanup = bind(document.body, store, {
 *   'input[name="username"]': 'username',
 *   'input[name="agreed"]': 'agreed'
 * });
 * // Changes to inputs update store, changes to store update inputs
 * // Call cleanup() to unbind
 */
function bind(el, store, map, opts = {}) {
  const events = opts.events || ["input", "change"];
  const isCheck = (n) => n.type === "checkbox";
  const isRadio = (n) => n.type === "radio";
  const get = (n) => isCheck(n) ? !!n.checked : isRadio(n) ? n.value : n.value;
  const set = (n, v) => {
    if (isCheck(n)) n.checked = !!v;
    else if (isRadio(n)) n.checked = n.value === String(v);
    else n.value = v ?? "";
  };
  const unsubs = [];
  for (const [selector, key] of Object.entries(map || {})) {
    el.querySelectorAll(selector).forEach((n) => {
      const updateStore = () => {
        store.state[key] = get(n);
      };
      for (const ev of events) n.addEventListener(ev, updateStore);
      unsubs.push(() => {
        for (const ev of events) n.removeEventListener(ev, updateStore);
      });
      set(n, store.state[key]);
    });
  }
  const unsub = store.subscribe(({ detail: { key, value } }) => {
    for (const [selector, k] of Object.entries(map || {})) {
      if (k !== key) continue;
      el.querySelectorAll(selector).forEach((n) => set(n, value));
    }
  });
  return () => {
    try {
      unsub();
    } catch {
    }
    ;
    unsubs.forEach((f) => {
      try {
        f();
      } catch {
      }
    });
  };
}
var pan_store_default = { createStore, bind };
export {
  bind,
  createStore,
  pan_store_default as default
};
//# sourceMappingURL=pan-store.js.map
