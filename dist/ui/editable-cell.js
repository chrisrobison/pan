import { PanClient } from "./pan-client.mjs";

/**
 * EditableCell - A custom web component that provides inline editing functionality for table cells or form fields.
 *
 * @class EditableCell
 * @extends {HTMLElement}
 *
 * @fires cell.change - Emitted when the cell value is changed (published on PanBus)
 * @fires cell.focus - Emitted when the cell input receives focus (published on PanBus)
 * @fires cell.blur - Emitted when the cell input loses focus (published on PanBus)
 *
 * @example
 * // Basic usage
 * <editable-cell value="Hello World" placeholder="Enter text"></editable-cell>
 *
 * @example
 * // With multiline support
 * <editable-cell value="Line 1\nLine 2" multiline></editable-cell>
 *
 * @example
 * // Non-editable display only
 * <editable-cell value="Read only" editable="false"></editable-cell>
 *
 * @example
 * // With custom topic for PanBus communication
 * <editable-cell value="John Doe" topic="user.name" cell-id="user-123"></editable-cell>
 */
class EditableCell extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["value", "type", "placeholder", "topic", "cell-id", "editable", "multiline"];
  }

  /**
   * Creates an instance of EditableCell.
   * Initializes shadow DOM, PanClient, and editing state.
   *
   * @constructor
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });

    /**
     * PanClient instance for pub/sub messaging.
     * @type {PanClient}
     */
    this.pc = new PanClient(this);

    /**
     * Flag indicating if the cell is currently being edited.
     * @type {boolean}
     */
    this.isEditing = false;

    /**
     * Stores the value before editing started, used for comparison on finish.
     * @type {string}
     */
    this.oldValue = "";
  }
  /**
   * Lifecycle callback invoked when the element is connected to the DOM.
   * Initializes rendering, topic subscriptions, and event listeners.
   */
  connectedCallback() {
    this.render();
    this.setupTopics();
    this.setupEvents();
  }

  /**
   * Lifecycle callback invoked when an observed attribute changes.
   * Re-renders the component unless currently editing.
   *
   * @param {string} name - Name of the changed attribute
   * @param {string} oldVal - Previous value of the attribute
   * @param {string} newVal - New value of the attribute
   */
  attributeChangedCallback(name, oldVal, newVal) {
    if (name === "value" && oldVal !== newVal && !this.isEditing) {
      if (this.isConnected) this.render();
    } else if (this.isConnected) {
      this.render();
    }
  }

  /**
   * Gets the current value of the cell.
   *
   * @type {string}
   * @returns {string} The cell value, empty string if not set
   */
  get value() {
    return this.getAttribute("value") || "";
  }

  /**
   * Sets the cell value.
   *
   * @param {string} val - The new value for the cell
   */
  set value(val) {
    this.setAttribute("value", val);
  }

  /**
   * Gets the input type (text, number, email, etc.).
   *
   * @type {string}
   * @returns {string} The input type, defaults to "text"
   */
  get type() {
    return this.getAttribute("type") || "text";
  }

  /**
   * Gets the placeholder text shown when the cell is empty.
   *
   * @type {string}
   * @returns {string} The placeholder text, defaults to "Click to edit"
   */
  get placeholder() {
    return this.getAttribute("placeholder") || "Click to edit";
  }

  /**
   * Gets the PanBus topic prefix for publishing events.
   *
   * @type {string}
   * @returns {string} The topic prefix, defaults to "cell"
   */
  get topic() {
    return this.getAttribute("topic") || "cell";
  }

  /**
   * Gets the unique identifier for this cell.
   *
   * @type {string}
   * @returns {string} The cell ID, generates a UUID if not set
   */
  get cellId() {
    return this.getAttribute("cell-id") || crypto.randomUUID();
  }

  /**
   * Gets whether the cell is editable.
   *
   * @type {boolean}
   * @returns {boolean} True if editable (default), false if readonly
   */
  get editable() {
    return this.getAttribute("editable") !== "false";
  }

  /**
   * Gets whether the cell uses multiline textarea input.
   *
   * @type {boolean}
   * @returns {boolean} True if multiline, false for single-line input
   */
  get multiline() {
    return this.hasAttribute("multiline");
  }
  /**
   * Subscribes to PanBus topics for remote cell value updates.
   * Listens for `{topic}.setValue` messages to update cell value remotely.
   *
   * @private
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.setValue`, (msg) => {
      if (msg.data.cellId === this.cellId) {
        this.value = msg.data.value;
      }
    });
  }

  /**
   * Sets up event listeners for user interactions.
   * Handles click, keyboard, focus, and blur events.
   *
   * @private
   */
  setupEvents() {
    const display = this.shadowRoot.querySelector(".cell-display");
    const input = this.shadowRoot.querySelector(".cell-input");
    if (display && this.editable) {
      display.addEventListener("click", () => this.startEdit());
      display.addEventListener("dblclick", () => this.startEdit());
    }
    if (input) {
      input.addEventListener("blur", () => this.finishEdit());
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !this.multiline) {
          e.preventDefault();
          this.finishEdit();
        } else if (e.key === "Escape") {
          this.cancelEdit();
        } else if (e.key === "Enter" && e.ctrlKey && this.multiline) {
          this.finishEdit();
        }
      });
      input.addEventListener("focus", () => {
        this.pc.publish({
          topic: `${this.topic}.focus`,
          data: { cellId: this.cellId }
        });
      });
    }
  }

  /**
   * Enters edit mode, showing the input field and hiding the display.
   * Selects the input text for easy editing.
   *
   * @public
   */
  startEdit() {
    if (!this.editable || this.isEditing) return;
    this.isEditing = true;
    this.oldValue = this.value;
    const display = this.shadowRoot.querySelector(".cell-display");
    const input = this.shadowRoot.querySelector(".cell-input");
    if (display) display.style.display = "none";
    if (input) {
      input.style.display = "block";
      input.value = this.value;
      input.focus();
      if (input.select) input.select();
    }
  }

  /**
   * Exits edit mode and saves changes if the value was modified.
   * Publishes a change event to PanBus if the value changed.
   *
   * @public
   */
  finishEdit() {
    if (!this.isEditing) return;
    const input = this.shadowRoot.querySelector(".cell-input");
    const newValue = input ? input.value : this.value;
    this.isEditing = false;
    if (newValue !== this.oldValue) {
      this.value = newValue;
      this.pc.publish({
        topic: `${this.topic}.change`,
        data: {
          cellId: this.cellId,
          value: newValue,
          oldValue: this.oldValue
        }
      });
    }
    this.updateDisplay();
    this.pc.publish({
      topic: `${this.topic}.blur`,
      data: { cellId: this.cellId }
    });
  }

  /**
   * Cancels edit mode without saving changes, reverting to display mode.
   *
   * @public
   */
  cancelEdit() {
    if (!this.isEditing) return;
    this.isEditing = false;
    this.updateDisplay();
  }

  /**
   * Updates the display element to show the current value.
   * Hides the input and shows the display element.
   *
   * @private
   */
  updateDisplay() {
    const display = this.shadowRoot.querySelector(".cell-display");
    const input = this.shadowRoot.querySelector(".cell-input");
    if (display) {
      display.style.display = "flex";
      display.textContent = this.value || this.placeholder;
      display.classList.toggle("empty", !this.value);
    }
    if (input) {
      input.style.display = "none";
    }
  }

  /**
   * Renders the component's shadow DOM with styles and markup.
   * Creates both display and input elements based on configuration.
   *
   * @private
   */
  render() {
    const hasValue = !!this.value;
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .cell-container {
          position: relative;
          min-height: 32px;
        }

        .cell-display {
          display: flex;
          align-items: center;
          padding: 0.5rem 0.75rem;
          min-height: 32px;
          cursor: ${this.editable ? "text" : "default"};
          border-radius: 0.375rem;
          transition: all 0.2s;
          color: var(--cell-color, #1e293b);
          background: var(--cell-bg, transparent);
          border: 1px solid transparent;
        }

        .cell-display:hover {
          background: var(--cell-hover-bg, #f8fafc);
          border-color: var(--cell-hover-border, #e2e8f0);
        }

        .cell-display.empty {
          color: var(--cell-placeholder-color, #94a3b8);
          font-style: italic;
        }

        .cell-input {
          display: none;
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 2px solid var(--cell-focus-border, #6366f1);
          border-radius: 0.375rem;
          font-family: inherit;
          font-size: inherit;
          background: var(--cell-input-bg, #ffffff);
          color: var(--cell-color, #1e293b);
          outline: none;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        textarea.cell-input {
          min-height: 80px;
          resize: vertical;
        }

        .cell-input:focus {
          border-color: var(--cell-focus-border, #6366f1);
        }

        :host([editable="false"]) .cell-display {
          cursor: default;
        }

        :host([editable="false"]) .cell-display:hover {
          background: transparent;
          border-color: transparent;
        }
      </style>

      <div class="cell-container">
        <div class="cell-display ${!hasValue ? "empty" : ""}">
          ${this.value || this.placeholder}
        </div>
        ${this.multiline ? `
          <textarea class="cell-input" placeholder="${this.placeholder}"></textarea>
        ` : `
          <input
            type="${this.type}"
            class="cell-input"
            placeholder="${this.placeholder}"
          >
        `}
      </div>
    `;
    if (this.isConnected) {
      setTimeout(() => this.setupEvents(), 0);
    }
  }
}
customElements.define("editable-cell", EditableCell);
var editable_cell_default = EditableCell;
export {
  EditableCell,
  editable_cell_default as default
};
//# sourceMappingURL=editable-cell.js.map
