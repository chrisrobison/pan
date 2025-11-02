import { PanClient } from "./pan-client.mjs";

/**
 * @typedef {Object} TodoItem
 * @property {string} id - Unique identifier for the todo item
 * @property {string} title - The todo item text
 * @property {boolean} done - Whether the todo is completed
 */

/**
 * A custom element that provides centralized state management for todo items.
 * Acts as a state provider using the PanClient pub/sub system.
 * Must be placed in the DOM before any TodoList components.
 *
 * @class TodoProvider
 * @extends HTMLElement
 * @fires {CustomEvent} todos.state - Fires when the todo state changes
 *
 * @example
 * // Basic usage - place at top of document
 * <todo-provider></todo-provider>
 * <todo-list></todo-list>
 *
 * @example
 * // Subscribing to state changes
 * const pc = new PanClient();
 * pc.subscribe('todos.state', (msg) => {
 *   console.log('Current state:', msg.data.items);
 * });
 *
 * @example
 * // The provider listens to these topics:
 * // - todos.change: Add a new todo item
 * // - todos.remove: Remove a todo by ID
 * // - todos.toggle: Toggle a todo's done state
 */
class TodoProvider extends HTMLElement {
  /**
   * PanClient instance for pub/sub communication
   * @type {PanClient}
   */
  pc = new PanClient(this);

  /**
   * Array of todo items managed by this provider
   * @type {TodoItem[]}
   */
  items = [];

  /**
   * Lifecycle callback invoked when element is added to the DOM.
   * Waits for Pan system to be ready, then sets up subscriptions.
   */
  connectedCallback() {
    const boot = () => {
      this.pc.subscribe("todos.change", (m) => {
        this.items.push(m.data.item);
        this.#broadcast();
      });
      this.pc.subscribe("todos.remove", (m) => {
        this.items = this.items.filter((t) => t.id !== m.data.id);
        this.#broadcast();
      });
      this.pc.subscribe("todos.toggle", (m) => {
        const t = this.items.find((x) => x.id === m.data.id);
        if (t) t.done = !!m.data.done;
        this.#broadcast();
      });
      this.#broadcast();
    };
    if (window.__panReady) {
      boot();
    } else {
      document.addEventListener("pan:sys.ready", boot, { once: true });
    }
  }

  /**
   * Broadcasts the current todo state to all subscribers.
   * Publishes a retained message with the current items array.
   * @private
   */
  #broadcast() {
    this.pc.publish({
      topic: "todos.state",
      data: { items: this.items },
      retain: true
    });
  }
}
customElements.define("todo-provider", TodoProvider);
var todo_provider_default = TodoProvider;
export {
  todo_provider_default as default
};
//# sourceMappingURL=todo-provider.js.map
