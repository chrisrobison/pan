import { PanClient } from "./pan-client.mjs";

/**
 * PanDropdown - A dropdown menu component with customizable items and positioning.
 *
 * @class PanDropdown
 * @extends {HTMLElement}
 *
 * @fires dropdown.opened - Emitted when the dropdown is opened (published on PanBus)
 * @fires dropdown.closed - Emitted when the dropdown is closed (published on PanBus)
 * @fires dropdown.select - Emitted when an item is selected (published on PanBus)
 *
 * @example
 * // Basic dropdown with JSON items
 * <pan-dropdown
 *   label="Select Option"
 *   items='[{"label":"Option 1","value":"1"},{"label":"Option 2","value":"2"}]'>
 * </pan-dropdown>
 *
 * @example
 * // Dropdown with custom trigger and content slots
 * <pan-dropdown position="bottom-right">
 *   <button slot="trigger">Custom Trigger</button>
 *   <div data-value="action1">Action 1</div>
 *   <div data-value="action2">Action 2</div>
 * </pan-dropdown>
 *
 * @example
 * // Dropdown with icons and dividers
 * <pan-dropdown
 *   items='[{"label":"Edit","value":"edit","icon":"✏️"},{"divider":true},{"label":"Delete","value":"delete","icon":"🗑️"}]'>
 * </pan-dropdown>
 */
class PanDropdown extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["label", "position", "topic", "items"];
  }

  /**
   * Creates an instance of PanDropdown.
   * Initializes shadow DOM, PanClient, and dropdown state.
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
     * Flag indicating if the dropdown is currently open.
     * @type {boolean}
     */
    this.isOpen = false;
  }

  /**
   * Lifecycle callback invoked when the element is connected to the DOM.
   */
  connectedCallback() {
    this.render();
    this.setupEvents();
  }

  /**
   * Lifecycle callback invoked when the element is disconnected from the DOM.
   * Cleans up the outside click listener.
   */
  disconnectedCallback() {
    document.removeEventListener("click", this.handleOutsideClick);
  }

  /**
   * Lifecycle callback invoked when an observed attribute changes.
   */
  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /**
   * Gets the dropdown trigger button label.
   *
   * @type {string}
   * @returns {string} The button label, defaults to "Menu"
   */
  get label() {
    return this.getAttribute("label") || "Menu";
  }

  /**
   * Gets the dropdown menu position (bottom-left, bottom-right, top-left, top-right).
   *
   * @type {string}
   * @returns {string} The position, defaults to "bottom-left"
   */
  get position() {
    return this.getAttribute("position") || "bottom-left";
  }

  /**
   * Gets the PanBus topic prefix for publishing events.
   *
   * @type {string}
   * @returns {string} The topic prefix, defaults to "dropdown"
   */
  get topic() {
    return this.getAttribute("topic") || "dropdown";
  }

  /**
   * Gets the dropdown items array from JSON attribute.
   *
   * @type {Array<{label: string, value: string, icon?: string, disabled?: boolean, divider?: boolean}>}
   * @returns {Array} Array of menu items, empty array if invalid JSON
   */
  get items() {
    const attr = this.getAttribute("items");
    if (!attr) return [];
    try {
      return JSON.parse(attr);
    } catch {
      return [];
    }
  }

  /**
   * Sets up event listeners for trigger clicks, item selection, and outside clicks.
   *
   * @private
   */
  setupEvents() {
    const trigger = this.shadowRoot.querySelector(".dropdown-trigger");
    const menu = this.shadowRoot.querySelector(".dropdown-menu");
    if (trigger) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        this.toggle();
      });
    }
    if (menu) {
      menu.addEventListener("click", (e) => {
        const item = e.target.closest("[data-value]");
        if (item && !item.hasAttribute("disabled")) {
          const value = item.dataset.value;
          const label = item.textContent.trim();
          this.selectItem(value, label);
        }
      });
    }
    this.handleOutsideClick = (e) => {
      if (!this.contains(e.target) && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener("click", this.handleOutsideClick);
  }

  /**
   * Toggles the dropdown between open and closed states.
   *
   * @public
   */
  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  /**
   * Opens the dropdown menu and publishes an opened event.
   *
   * @public
   */
  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    const menu = this.shadowRoot.querySelector(".dropdown-menu");
    if (menu) menu.classList.add("active");
    this.pc.publish({
      topic: `${this.topic}.opened`,
      data: {}
    });
  }

  /**
   * Closes the dropdown menu and publishes a closed event.
   *
   * @public
   */
  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    const menu = this.shadowRoot.querySelector(".dropdown-menu");
    if (menu) menu.classList.remove("active");
    this.pc.publish({
      topic: `${this.topic}.closed`,
      data: {}
    });
  }

  /**
   * Handles item selection, publishes a select event, and closes the dropdown.
   *
   * @param {string} value - The selected item's value
   * @param {string} label - The selected item's label
   * @public
   */
  selectItem(value, label) {
    this.pc.publish({
      topic: `${this.topic}.select`,
      data: { value, label }
    });
    this.close();
  }

  /**
   * Renders the component's shadow DOM with styles and markup.
   * Supports custom trigger slot and item slots.
   *
   * @private
   */
  render() {
    const hasTriggerSlot = this.querySelector('[slot="trigger"]');
    const hasDefaultSlot = this.querySelector(":not([slot])");
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-block;
          position: relative;
        }

        .dropdown-trigger {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.625rem 1rem;
          background: var(--dropdown-trigger-bg, #ffffff);
          border: 1px solid var(--dropdown-trigger-border, #e2e8f0);
          border-radius: 0.5rem;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--dropdown-trigger-color, #1e293b);
          transition: all 0.2s;
        }

        .dropdown-trigger:hover {
          background: var(--dropdown-trigger-hover-bg, #f8fafc);
          border-color: var(--dropdown-trigger-hover-border, #cbd5e1);
        }

        .dropdown-arrow {
          font-size: 0.75rem;
          transition: transform 0.2s;
        }

        .dropdown-trigger.open .dropdown-arrow {
          transform: rotate(180deg);
        }

        .dropdown-menu {
          position: absolute;
          min-width: 200px;
          background: var(--dropdown-menu-bg, #ffffff);
          border: 1px solid var(--dropdown-menu-border, #e2e8f0);
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s ease;
          padding: 0.5rem 0;
        }

        .dropdown-menu.active {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .dropdown-menu.position-bottom-left {
          top: calc(100% + 0.5rem);
          left: 0;
        }

        .dropdown-menu.position-bottom-right {
          top: calc(100% + 0.5rem);
          right: 0;
        }

        .dropdown-menu.position-top-left {
          bottom: calc(100% + 0.5rem);
          left: 0;
        }

        .dropdown-menu.position-top-right {
          bottom: calc(100% + 0.5rem);
          right: 0;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 1rem;
          cursor: pointer;
          color: var(--dropdown-item-color, #334155);
          font-size: 0.95rem;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .dropdown-item:hover {
          background: var(--dropdown-item-hover-bg, #f1f5f9);
          color: var(--dropdown-item-hover-color, #1e293b);
        }

        .dropdown-item[disabled] {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .dropdown-item[disabled]:hover {
          background: transparent;
        }

        .dropdown-divider {
          height: 1px;
          background: var(--dropdown-divider-color, #e2e8f0);
          margin: 0.5rem 0;
        }

        .item-icon {
          font-size: 1rem;
        }
      </style>

      <div class="dropdown">
        ${hasTriggerSlot ? `
          <slot name="trigger"></slot>
        ` : `
          <button class="dropdown-trigger ${this.isOpen ? "open" : ""}">
            ${this.label}
            <span class="dropdown-arrow">▼</span>
          </button>
        `}

        <div class="dropdown-menu position-${this.position}">
          ${hasDefaultSlot ? `
            <slot></slot>
          ` : this.items.map((item) => {
      if (item.divider) {
        return '<div class="dropdown-divider"></div>';
      }
      return `
              <div
                class="dropdown-item"
                data-value="${item.value || item.label}"
                ${item.disabled ? "disabled" : ""}
              >
                ${item.icon ? `<span class="item-icon">${item.icon}</span>` : ""}
                ${item.label}
              </div>
            `;
    }).join("")}
        </div>
      </div>
    `;
  }
}
customElements.define("pan-dropdown", PanDropdown);
var pan_dropdown_default = PanDropdown;
export {
  PanDropdown,
  pan_dropdown_default as default
};
//# sourceMappingURL=pan-dropdown.js.map
