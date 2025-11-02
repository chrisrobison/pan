import { PanClient } from "./pan-client.mjs";

/**
 * @typedef {Object} ListItem
 * @property {string|number} id - Unique identifier for the item
 * @property {string} [content] - Content to display for the item
 * @property {string} [label] - Alternative label to display
 * @property {string} [title] - Alternative title to display
 */

/**
 * A custom element that provides drag-and-drop reordering functionality for lists.
 * Supports custom drag handles, disabled states, and pub/sub communication via PanClient.
 *
 * @class DragDropList
 * @extends HTMLElement
 * @fires {CustomEvent} {topic}.reorder - Fires when items are reordered via drag and drop
 *
 * @example
 * // Basic usage
 * <drag-drop-list
 *   topic="mylist"
 *   items='[{"id":1,"content":"Item 1"},{"id":2,"content":"Item 2"}]'>
 * </drag-drop-list>
 *
 * @example
 * // With custom drag handle and disabled state
 * <drag-drop-list
 *   topic="tasks"
 *   items='[...]'
 *   handle=".drag-handle"
 *   disabled>
 * </drag-drop-list>
 *
 * @example
 * // Listening to reorder events
 * const pc = new PanClient();
 * pc.subscribe('mylist.reorder', (msg) => {
 *   console.log('Reordered:', msg.data.items);
 *   console.log('From index:', msg.data.from, 'To index:', msg.data.to);
 * });
 */
class DragDropList extends HTMLElement {
  /**
   * Specifies which attributes trigger attributeChangedCallback when modified.
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["topic", "items", "disabled", "handle"];
  }

  /**
   * Creates a new DragDropList instance.
   * Initializes shadow DOM, PanClient, and internal state.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /**
     * PanClient instance for pub/sub communication
     * @type {PanClient}
     * @private
     */
    this.pc = new PanClient(this);

    /**
     * Array of list items
     * @type {ListItem[]}
     */
    this.items = [];

    /**
     * The currently dragged DOM element
     * @type {HTMLElement|null}
     * @private
     */
    this.draggedElement = null;

    /**
     * The index of the currently dragged item
     * @type {number|null}
     * @private
     */
    this.draggedIndex = null;
  }

  /**
   * Lifecycle callback invoked when element is added to the DOM.
   * Parses initial items attribute and sets up topic subscriptions.
   */
  connectedCallback() {
    if (this.getAttribute("items")) {
      try {
        this.items = JSON.parse(this.getAttribute("items"));
      } catch (e) {
        console.error("Invalid items JSON:", e);
      }
    }
    this.render();
    this.setupTopics();
  }

  /**
   * Lifecycle callback invoked when an observed attribute changes.
   * @param {string} name - Name of the changed attribute
   * @param {string} oldVal - Previous attribute value
   * @param {string} newVal - New attribute value
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "items" && newVal) {
      try {
        this.items = JSON.parse(newVal);
        if (this.isConnected) this.render();
      } catch (e) {
        console.error("Invalid items JSON:", e);
      }
    } else if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Gets the topic name for pub/sub communication.
   * @returns {string} The topic name, defaults to "list"
   */
  get topic() {
    return this.getAttribute("topic") || "list";
  }

  /**
   * Checks if the list is disabled (drag operations not allowed).
   * @returns {boolean} True if disabled attribute is present
   */
  get disabled() {
    return this.hasAttribute("disabled");
  }

  /**
   * Gets the CSS selector for the drag handle element.
   * @returns {string|null} The handle selector or null for default behavior
   */
  get handle() {
    return this.getAttribute("handle") || null;
  }

  /**
   * Sets up PanClient topic subscriptions for list manipulation.
   * Subscribes to setItems, addItem, and removeItem topics.
   * @private
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.setItems`, (msg) => {
      if (msg.data.items) {
        this.items = msg.data.items;
        this.render();
      }
    });
    this.pc.subscribe(`${this.topic}.addItem`, (msg) => {
      if (msg.data.item) {
        const index = msg.data.index ?? this.items.length;
        this.items.splice(index, 0, msg.data.item);
        this.render();
      }
    });
    this.pc.subscribe(`${this.topic}.removeItem`, (msg) => {
      if (msg.data.id) {
        this.items = this.items.filter((item) => item.id !== msg.data.id);
        this.render();
      }
    });
  }

  /**
   * Attaches drag event listeners to all list items.
   * Handles dragstart, dragend, dragover, dragenter, dragleave, and drop events.
   * @private
   */
  setupDragEvents() {
    const listItems = this.shadowRoot.querySelectorAll(".list-item");
    listItems.forEach((item, index) => {
      const handle = this.handle ? item.querySelector(this.handle) : item;
      if (handle) {
        handle.style.cursor = "grab";
        item.setAttribute("draggable", "true");
        item.addEventListener("dragstart", (e) => {
          if (this.disabled) return;
          this.draggedElement = item;
          this.draggedIndex = index;
          item.classList.add("dragging");
          handle.style.cursor = "grabbing";
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/html", item.innerHTML);
        });
        item.addEventListener("dragend", (e) => {
          item.classList.remove("dragging");
          handle.style.cursor = "grab";
          this.draggedElement = null;
          this.draggedIndex = null;
          listItems.forEach((li) => li.classList.remove("drag-over"));
        });
        item.addEventListener("dragover", (e) => {
          if (this.disabled || !this.draggedElement) return;
          e.preventDefault();
          const afterElement = this.getDragAfterElement(e.clientY);
          if (afterElement == null) {
            item.parentElement.appendChild(this.draggedElement);
          } else {
            item.parentElement.insertBefore(this.draggedElement, afterElement);
          }
        });
        item.addEventListener("dragenter", (e) => {
          if (this.disabled || !this.draggedElement) return;
          if (item !== this.draggedElement) {
            item.classList.add("drag-over");
          }
        });
        item.addEventListener("dragleave", (e) => {
          item.classList.remove("drag-over");
        });
        item.addEventListener("drop", (e) => {
          if (this.disabled) return;
          e.preventDefault();
          item.classList.remove("drag-over");
          const newIndex = Array.from(listItems).indexOf(item);
          const oldIndex = this.draggedIndex;
          if (oldIndex !== newIndex && oldIndex !== null) {
            const movedItem = this.items[oldIndex];
            this.items.splice(oldIndex, 1);
            this.items.splice(newIndex, 0, movedItem);
            this.pc.publish({
              topic: `${this.topic}.reorder`,
              data: {
                items: this.items,
                from: oldIndex,
                to: newIndex
              }
            });
            this.render();
          }
        });
      }
    });
  }

  /**
   * Determines which element the dragged item should be inserted after.
   * Uses mouse Y position to find the closest non-dragging element.
   * @param {number} y - Mouse Y coordinate
   * @returns {HTMLElement|undefined} The element to insert after, or undefined for end of list
   * @private
   */
  getDragAfterElement(y) {
    const draggableElements = [...this.shadowRoot.querySelectorAll(".list-item:not(.dragging)")];
    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  /**
   * Renders the list UI into the shadow DOM.
   * Creates styled list items with drag handles and sets up drag events.
   * @private
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .list-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .list-item {
          background: var(--list-item-bg, #ffffff);
          border: 1px solid var(--list-item-border, #e2e8f0);
          border-radius: 0.5rem;
          padding: 0.75rem 1rem;
          transition: all 0.2s;
          user-select: none;
        }

        .list-item:not([draggable]) {
          cursor: default;
        }

        .list-item.dragging {
          opacity: 0.5;
          transform: scale(0.95);
        }

        .list-item.drag-over {
          border-color: var(--list-drag-border, #6366f1);
          background: var(--list-drag-bg, #eef2ff);
          transform: translateY(-2px);
        }

        .list-item:not(.dragging):hover {
          border-color: var(--list-hover-border, #cbd5e1);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }

        .item-content {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .drag-handle {
          color: var(--list-handle-color, #94a3b8);
          font-size: 1.25rem;
          line-height: 1;
        }

        :host([disabled]) .list-item {
          cursor: default !important;
          opacity: 0.6;
        }

        .empty-state {
          padding: 2rem;
          text-align: center;
          color: var(--list-empty-color, #94a3b8);
          font-style: italic;
        }
      </style>

      <div class="list-container">
        ${this.items.length === 0 ? `
          <div class="empty-state">
            <slot name="empty">No items to display</slot>
          </div>
        ` : this.items.map((item, index) => `
          <div class="list-item" data-id="${item.id}" data-index="${index}">
            <div class="item-content">
              ${!this.disabled && !this.handle ? '<span class="drag-handle">\u22EE\u22EE</span>' : ""}
              <div class="item-body">
                <slot name="item-${item.id}">
                  ${item.content || item.label || item.title || JSON.stringify(item)}
                </slot>
              </div>
            </div>
          </div>
        `).join("")}
      </div>
    `;
    if (!this.disabled) {
      setTimeout(() => this.setupDragEvents(), 0);
    }
  }
}
customElements.define("drag-drop-list", DragDropList);
var drag_drop_list_default = DragDropList;
export {
  DragDropList,
  drag_drop_list_default as default
};
//# sourceMappingURL=drag-drop-list.js.map
