import { PanClient } from "./pan-client.mjs";

/**
 * PanPagination - A pagination component with page numbers, navigation buttons, and optional jump-to-page input.
 *
 * @class PanPagination
 * @extends {HTMLElement}
 *
 * @fires pagination.changed - Emitted when the page changes (published on PanBus)
 *
 * @example
 * // Basic pagination
 * <pan-pagination current-page="1" total-pages="10"></pan-pagination>
 *
 * @example
 * // With total items and page size (calculates total pages)
 * <pan-pagination total-items="100" page-size="10" show-info show-jump></pan-pagination>
 *
 * @example
 * // With custom topic
 * <pan-pagination current-page="1" total-pages="5" topic="results"></pan-pagination>
 */
class PanPagination extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["current-page", "total-pages", "total-items", "page-size", "topic", "show-info", "show-jump"];
  }

  /**
   * Creates an instance of PanPagination.
   * Initializes shadow DOM and PanClient.
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
   * Lifecycle callback invoked when an observed attribute changes.
   */
  attributeChangedCallback() {
    if (this.isConnected) this.render();
  }

  /**
   * Gets the current page number.
   *
   * @type {number}
   * @returns {number} The current page, defaults to 1
   */
  get currentPage() {
    return parseInt(this.getAttribute("current-page")) || 1;
  }

  /**
   * Sets the current page number.
   *
   * @param {number} val - The new page number
   */
  set currentPage(val) {
    this.setAttribute("current-page", val);
  }

  /**
   * Gets the total number of pages.
   * Calculates from total-items and page-size if not explicitly set.
   *
   * @type {number}
   * @returns {number} The total pages
   */
  get totalPages() {
    const attr = parseInt(this.getAttribute("total-pages"));
    if (attr) return attr;
    const totalItems = this.totalItems;
    const pageSize = this.pageSize;
    if (totalItems && pageSize) {
      return Math.ceil(totalItems / pageSize);
    }
    return 1;
  }

  /**
   * Gets the total number of items across all pages.
   *
   * @type {number}
   * @returns {number} The total items, defaults to 0
   */
  get totalItems() {
    return parseInt(this.getAttribute("total-items")) || 0;
  }

  /**
   * Gets the number of items per page.
   *
   * @type {number}
   * @returns {number} The page size, defaults to 10
   */
  get pageSize() {
    return parseInt(this.getAttribute("page-size")) || 10;
  }

  /**
   * Gets the PanBus topic prefix for publishing events.
   *
   * @type {string}
   * @returns {string} The topic prefix, defaults to "pagination"
   */
  get topic() {
    return this.getAttribute("topic") || "pagination";
  }

  /**
   * Gets whether to show pagination info (e.g., "Showing 1-10 of 100").
   *
   * @type {boolean}
   * @returns {boolean} True if info should be shown (default)
   */
  get showInfo() {
    return this.getAttribute("show-info") !== "false";
  }

  /**
   * Gets whether to show the jump-to-page input field.
   *
   * @type {boolean}
   * @returns {boolean} True if jump input should be shown
   */
  get showJump() {
    return this.hasAttribute("show-jump");
  }

  /**
   * Subscribes to PanBus topics for goto page commands.
   *
   * @private
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.goto`, (msg) => {
      if (typeof msg.data.page === "number") {
        this.goToPage(msg.data.page);
      }
    });
  }

  /**
   * Sets up event listeners for navigation buttons and jump input.
   *
   * @private
   */
  setupEvents() {
    const prevBtn = this.shadowRoot.querySelector(".prev-btn");
    const nextBtn = this.shadowRoot.querySelector(".next-btn");
    const firstBtn = this.shadowRoot.querySelector(".first-btn");
    const lastBtn = this.shadowRoot.querySelector(".last-btn");
    const pageButtons = this.shadowRoot.querySelectorAll(".page-btn");
    const jumpInput = this.shadowRoot.querySelector(".jump-input");
    if (prevBtn) prevBtn.addEventListener("click", () => this.goToPage(this.currentPage - 1));
    if (nextBtn) nextBtn.addEventListener("click", () => this.goToPage(this.currentPage + 1));
    if (firstBtn) firstBtn.addEventListener("click", () => this.goToPage(1));
    if (lastBtn) lastBtn.addEventListener("click", () => this.goToPage(this.totalPages));
    pageButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const page = parseInt(btn.dataset.page);
        this.goToPage(page);
      });
    });
    if (jumpInput) {
      jumpInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const page = parseInt(jumpInput.value);
          if (page >= 1 && page <= this.totalPages) {
            this.goToPage(page);
          }
        }
      });
    }
  }
  /**
   * Navigates to a specific page and publishes a changed event.
   *
   * @param {number} page - The page number to navigate to
   * @public
   */
  goToPage(page) {
    if (page < 1 || page > this.totalPages) return;
    if (page === this.currentPage) return;
    this.currentPage = page;
    this.pc.publish({
      topic: `${this.topic}.changed`,
      data: { page, pageSize: this.pageSize }
    });
  }

  /**
   * Calculates which page numbers to display with ellipsis for large page counts.
   * Shows up to 7 pages with intelligent ellipsis placement.
   *
   * @returns {Array<number|string>} Array of page numbers and ellipsis strings
   * @private
   */
  getPageNumbers() {
    const current = this.currentPage;
    const total = this.totalPages;
    const pages = [];
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push("...");
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < total - 2) {
        pages.push("...");
      }
      pages.push(total);
    }
    return pages;
  }

  /**
   * Renders the component's shadow DOM with styles and markup.
   * Creates pagination buttons, page numbers, and optional info/jump elements.
   *
   * @private
   */
  render() {
    const pages = this.getPageNumbers();
    const startItem = (this.currentPage - 1) * this.pageSize + 1;
    const endItem = Math.min(this.currentPage * this.pageSize, this.totalItems);
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .pagination {
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .pagination-info {
          color: var(--pagination-info-color, #64748b);
          font-size: 0.875rem;
        }

        .pagination-buttons {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .pagination-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          min-width: 2.5rem;
          height: 2.5rem;
          padding: 0 0.75rem;
          border: 1px solid var(--pagination-border, #e2e8f0);
          background: var(--pagination-bg, #ffffff);
          color: var(--pagination-color, #334155);
          border-radius: 0.5rem;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .pagination-btn:hover:not(:disabled) {
          background: var(--pagination-hover-bg, #f8fafc);
          border-color: var(--pagination-hover-border, #cbd5e1);
        }

        .pagination-btn.active {
          background: var(--pagination-active-bg, #6366f1);
          color: var(--pagination-active-color, #ffffff);
          border-color: var(--pagination-active-border, #6366f1);
        }

        .pagination-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .pagination-btn.ellipsis {
          border: none;
          background: transparent;
          cursor: default;
        }

        .pagination-btn.ellipsis:hover {
          background: transparent;
        }

        .jump-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .jump-input {
          width: 4rem;
          padding: 0.5rem;
          border: 1px solid var(--pagination-border, #e2e8f0);
          border-radius: 0.375rem;
          font-family: inherit;
          text-align: center;
        }
      </style>

      <div class="pagination">
        ${this.showInfo && this.totalItems > 0 ? `
          <div class="pagination-info">
            Showing ${startItem}-${endItem} of ${this.totalItems}
          </div>
        ` : ""}

        <div class="pagination-buttons">
          <button
            class="pagination-btn first-btn"
            ${this.currentPage === 1 ? "disabled" : ""}
            title="First page"
          >
            \u27E8\u27E8
          </button>

          <button
            class="pagination-btn prev-btn"
            ${this.currentPage === 1 ? "disabled" : ""}
            title="Previous page"
          >
            \u27E8
          </button>

          ${pages.map((page) => {
      if (page === "...") {
        return '<button class="pagination-btn ellipsis" disabled>...</button>';
      }
      return `
              <button
                class="pagination-btn page-btn ${page === this.currentPage ? "active" : ""}"
                data-page="${page}"
              >
                ${page}
              </button>
            `;
    }).join("")}

          <button
            class="pagination-btn next-btn"
            ${this.currentPage === this.totalPages ? "disabled" : ""}
            title="Next page"
          >
            \u27E9
          </button>

          <button
            class="pagination-btn last-btn"
            ${this.currentPage === this.totalPages ? "disabled" : ""}
            title="Last page"
          >
            \u27E9\u27E9
          </button>
        </div>

        ${this.showJump ? `
          <div class="jump-container">
            <span>Go to:</span>
            <input
              type="number"
              class="jump-input"
              min="1"
              max="${this.totalPages}"
              placeholder="${this.currentPage}"
            >
          </div>
        ` : ""}
      </div>
    `;
    if (this.isConnected) {
      setTimeout(() => this.setupEvents(), 0);
    }
  }
}
customElements.define("pan-pagination", PanPagination);
var pan_pagination_default = PanPagination;
export {
  PanPagination,
  pan_pagination_default as default
};
//# sourceMappingURL=pan-pagination.js.map
