import { PanClient } from "./pan-client.mjs";

/**
 * PanSearchBar - A search input component with debouncing, filters, and PanBus integration.
 *
 * @class PanSearchBar
 * @extends {HTMLElement}
 *
 * @fires search.search - Emitted when search query changes (published on PanBus)
 * @fires search.clear - Emitted when search is cleared (published on PanBus)
 *
 * @example
 * // Basic search bar
 * <pan-search-bar placeholder="Search products..."></pan-search-bar>
 *
 * @example
 * // With filters and custom debounce
 * <pan-search-bar
 *   debounce="500"
 *   filters='[{"label":"All","value":""},{"label":"Active","value":"active"}]'>
 * </pan-search-bar>
 *
 * @example
 * // With custom topic
 * <pan-search-bar topic="products" placeholder="Find products"></pan-search-bar>
 */
class PanSearchBar extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["placeholder", "topic", "debounce", "filters", "show-filters"];
  }

  /**
   * Creates an instance of PanSearchBar.
   * Initializes shadow DOM, PanClient, and search state.
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
     * Timer ID for debounced search.
     * @type {number|null}
     */
    this.debounceTimer = null;

    /**
     * Current search query string.
     * @type {string}
     */
    this.currentQuery = "";

    /**
     * Currently selected filter value.
     * @type {string|null}
     */
    this.currentFilter = null;
  }
  /**
   * Lifecycle callback invoked when the element is connected to the DOM.
   */
  connectedCallback() {
    this.render();
    this.setupTopics();
    this.setupEvents();
  }

  /**
   * Lifecycle callback invoked when the element is disconnected from the DOM.
   * Cleans up the debounce timer.
   */
  disconnectedCallback() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
  }

  /**
   * Lifecycle callback invoked when an observed attribute changes.
   */
  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /**
   * Gets the search input placeholder text.
   *
   * @type {string}
   * @returns {string} The placeholder, defaults to "Search..."
   */
  get placeholder() {
    return this.getAttribute("placeholder") || "Search...";
  }

  /**
   * Gets the PanBus topic prefix for publishing events.
   *
   * @type {string}
   * @returns {string} The topic prefix, defaults to "search"
   */
  get topic() {
    return this.getAttribute("topic") || "search";
  }

  /**
   * Gets the debounce delay in milliseconds.
   *
   * @type {number}
   * @returns {number} The debounce delay, defaults to 300ms
   */
  get debounce() {
    return parseInt(this.getAttribute("debounce")) || 300;
  }

  /**
   * Gets the filter options array from JSON attribute.
   *
   * @type {Array<{label: string, value: string, icon?: string}>}
   * @returns {Array} Array of filter options, empty array if invalid JSON
   */
  get filters() {
    const attr = this.getAttribute("filters");
    if (!attr) return [];
    try {
      return JSON.parse(attr);
    } catch {
      return [];
    }
  }

  /**
   * Gets whether to show the filter dropdown.
   *
   * @type {boolean}
   * @returns {boolean} True if filters exist and not disabled
   */
  get showFilters() {
    const attr = this.getAttribute("show-filters");
    if (attr === "false") return false;
    return this.filters.length > 0;
  }

  /**
   * Subscribes to PanBus topics for remote search control.
   * Listens for `{topic}.set` messages to update query and filter.
   *
   * @private
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.set`, (msg) => {
      const { query, filter } = msg.data;
      const input = this.shadowRoot.querySelector(".search-input");
      if (typeof query === "string") {
        this.currentQuery = query;
        if (input) input.value = query;
      }
      if (filter !== void 0) {
        this.currentFilter = filter;
        this.updateFilterButton();
      }
    });
  }

  /**
   * Sets up event listeners for input, clear button, and filter dropdown.
   *
   * @private
   */
  setupEvents() {
    const input = this.shadowRoot.querySelector(".search-input");
    const clearBtn = this.shadowRoot.querySelector(".clear-btn");
    const filterBtn = this.shadowRoot.querySelector(".filter-btn");
    const filterDropdown = this.shadowRoot.querySelector(".filter-dropdown");
    if (input) {
      input.addEventListener("input", (e) => {
        this.currentQuery = e.target.value;
        this.debouncedSearch();
        if (clearBtn) {
          clearBtn.style.display = this.currentQuery ? "flex" : "none";
        }
      });
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.search();
        }
      });
    }
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        this.clear();
      });
    }
    if (filterBtn && filterDropdown) {
      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        filterDropdown.classList.toggle("active");
      });
      document.addEventListener("click", () => {
        filterDropdown.classList.remove("active");
      });
      filterDropdown.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = e.target.closest("[data-value]");
        if (item) {
          this.currentFilter = item.dataset.value;
          this.updateFilterButton();
          filterDropdown.classList.remove("active");
          this.search();
        }
      });
    }
  }
  /**
   * Triggers a debounced search, clearing any pending search timer.
   *
   * @private
   */
  debouncedSearch() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => this.search(), this.debounce);
  }

  /**
   * Executes the search and publishes a search event to PanBus.
   *
   * @public
   */
  search() {
    this.pc.publish({
      topic: `${this.topic}.search`,
      data: {
        query: this.currentQuery,
        filter: this.currentFilter
      }
    });
  }

  /**
   * Clears the search input and filter, then triggers a new search.
   * Publishes a clear event to PanBus.
   *
   * @public
   */
  clear() {
    const input = this.shadowRoot.querySelector(".search-input");
    if (input) input.value = "";
    this.currentQuery = "";
    this.currentFilter = null;
    this.pc.publish({
      topic: `${this.topic}.clear`,
      data: {}
    });
    this.search();
  }

  /**
   * Updates the filter button text and active state based on selected filter.
   *
   * @private
   */
  updateFilterButton() {
    const filterBtn = this.shadowRoot.querySelector(".filter-btn");
    if (!filterBtn) return;
    const selectedFilter = this.filters.find((f) => f.value === this.currentFilter);
    if (selectedFilter) {
      filterBtn.textContent = `${selectedFilter.icon || "\u{1F53D}"} ${selectedFilter.label}`;
      filterBtn.classList.add("active");
    } else {
      filterBtn.textContent = "\u{1F53D} Filter";
      filterBtn.classList.remove("active");
    }
  }

  /**
   * Renders the component's shadow DOM with styles and markup.
   * Creates search input, clear button, and optional filter dropdown.
   *
   * @private
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .search-bar {
          display: flex;
          gap: 0.5rem;
          align-items: stretch;
        }

        .search-input-wrapper {
          flex: 1;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 1rem;
          color: var(--search-icon-color, #94a3b8);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 3rem 0.75rem 2.75rem;
          border: 1px solid var(--search-border, #e2e8f0);
          border-radius: 0.5rem;
          font-family: inherit;
          font-size: 0.95rem;
          background: var(--search-bg, #ffffff);
          color: var(--search-color, #1e293b);
          transition: all 0.2s;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--search-focus-border, #6366f1);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }

        .clear-btn {
          position: absolute;
          right: 0.75rem;
          display: none;
          align-items: center;
          justify-content: center;
          width: 1.5rem;
          height: 1.5rem;
          border: none;
          background: var(--search-clear-bg, #e2e8f0);
          color: var(--search-clear-color, #64748b);
          border-radius: 50%;
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s;
        }

        .clear-btn:hover {
          background: var(--search-clear-hover-bg, #cbd5e1);
        }

        .filter-container {
          position: relative;
        }

        .filter-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          border: 1px solid var(--search-border, #e2e8f0);
          border-radius: 0.5rem;
          background: var(--search-bg, #ffffff);
          color: var(--search-color, #64748b);
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          white-space: nowrap;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: var(--search-hover-bg, #f8fafc);
        }

        .filter-btn.active {
          border-color: var(--search-active-border, #6366f1);
          color: var(--search-active-color, #6366f1);
        }

        .filter-dropdown {
          position: absolute;
          top: calc(100% + 0.5rem);
          right: 0;
          min-width: 200px;
          background: var(--search-dropdown-bg, #ffffff);
          border: 1px solid var(--search-dropdown-border, #e2e8f0);
          border-radius: 0.5rem;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          z-index: 100;
          opacity: 0;
          visibility: hidden;
          transform: translateY(-10px);
          transition: all 0.2s;
          padding: 0.5rem 0;
        }

        .filter-dropdown.active {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }

        .filter-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.625rem 1rem;
          cursor: pointer;
          color: var(--search-dropdown-color, #334155);
          font-size: 0.95rem;
          transition: all 0.15s;
        }

        .filter-item:hover {
          background: var(--search-dropdown-hover-bg, #f1f5f9);
        }
      </style>

      <div class="search-bar">
        <div class="search-input-wrapper">
          <span class="search-icon">\u{1F50D}</span>
          <input
            type="text"
            class="search-input"
            placeholder="${this.placeholder}"
            value="${this.currentQuery}"
          >
          <button class="clear-btn" title="Clear">\xD7</button>
        </div>

        ${this.showFilters ? `
          <div class="filter-container">
            <button class="filter-btn">\u{1F53D} Filter</button>
            <div class="filter-dropdown">
              <div class="filter-item" data-value="">All</div>
              ${this.filters.map((filter) => `
                <div class="filter-item" data-value="${filter.value}">
                  ${filter.icon || ""} ${filter.label}
                </div>
              `).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    `;
    if (this.isConnected) {
      setTimeout(() => this.setupEvents(), 0);
    }
  }
}
customElements.define("pan-search-bar", PanSearchBar);
var pan_search_bar_default = PanSearchBar;
export {
  PanSearchBar,
  pan_search_bar_default as default
};
//# sourceMappingURL=pan-search-bar.js.map
