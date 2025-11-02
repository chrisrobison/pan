import { PanClient } from "./pan-client.mjs";

/**
 * PanModal - A modal dialog component with backdrop, keyboard controls, and PanBus integration.
 *
 * @class PanModal
 * @extends {HTMLElement}
 *
 * @fires modal.{id}.opened - Emitted when the modal is shown (published on PanBus)
 * @fires modal.{id}.closed - Emitted when the modal is hidden (published on PanBus)
 *
 * @example
 * // Basic modal
 * <pan-modal modal-id="confirm" title="Confirm Action">
 *   <p>Are you sure you want to proceed?</p>
 *   <div slot="footer">
 *     <button>Cancel</button>
 *     <button>Confirm</button>
 *   </div>
 * </pan-modal>
 *
 * @example
 * // Large modal with custom header
 * <pan-modal size="lg" closable="false">
 *   <div slot="header"><h2>Custom Header</h2></div>
 *   <p>Modal content</p>
 * </pan-modal>
 */
class PanModal extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["topic", "modal-id", "title", "size", "closable"];
  }

  /**
   * Creates an instance of PanModal.
   * Initializes shadow DOM, PanClient, and modal state.
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
     * Flag indicating if the modal is currently open.
     * @type {boolean}
     */
    this.isOpen = false;
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
   * Gets the unique identifier for this modal.
   *
   * @type {string}
   * @returns {string} The modal ID, defaults to "default"
   */
  get modalId() {
    return this.getAttribute("modal-id") || "default";
  }

  /**
   * Gets the PanBus topic prefix for publishing events.
   *
   * @type {string}
   * @returns {string} The topic prefix, defaults to "modal.{modalId}"
   */
  get topic() {
    return this.getAttribute("topic") || `modal.${this.modalId}`;
  }

  /**
   * Gets the modal title text.
   *
   * @type {string}
   * @returns {string} The modal title
   */
  get title() {
    return this.getAttribute("title") || "";
  }

  /**
   * Gets the modal size (sm, md, lg, xl, full).
   *
   * @type {string}
   * @returns {string} The size variant, defaults to "md"
   */
  get size() {
    return this.getAttribute("size") || "md";
  }

  /**
   * Gets whether the modal can be closed by clicking backdrop or escape key.
   *
   * @type {boolean}
   * @returns {boolean} True if closable (default)
   */
  get closable() {
    return this.getAttribute("closable") !== "false";
  }

  /**
   * Subscribes to PanBus topics for show/hide/toggle commands.
   *
   * @private
   */
  setupTopics() {
    this.pc.subscribe(`${this.topic}.show`, () => this.show());
    this.pc.subscribe(`${this.topic}.hide`, () => this.hide());
    this.pc.subscribe(`${this.topic}.toggle`, () => this.toggle());
  }

  /**
   * Sets up event listeners for backdrop clicks, close button, and keyboard.
   *
   * @private
   */
  setupEvents() {
    const backdrop = this.shadowRoot.querySelector(".modal-backdrop");
    const closeBtn = this.shadowRoot.querySelector(".close-btn");
    if (backdrop) {
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop && this.closable) {
          this.hide();
        }
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.hide());
    }
    this.handleKeydown = (e) => {
      if (e.key === "Escape" && this.isOpen && this.closable) {
        this.hide();
      }
    };
    document.addEventListener("keydown", this.handleKeydown);
  }

  /**
   * Lifecycle callback invoked when the element is disconnected from the DOM.
   * Cleans up keyboard event listener.
   */
  disconnectedCallback() {
    document.removeEventListener("keydown", this.handleKeydown);
  }

  /**
   * Shows the modal and publishes an opened event.
   * Disables body scrolling while modal is open.
   *
   * @public
   */
  show() {
    if (this.isOpen) return;
    this.isOpen = true;
    const backdrop = this.shadowRoot.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.classList.add("active");
      document.body.style.overflow = "hidden";
    }
    this.pc.publish({
      topic: `${this.topic}.opened`,
      data: { modalId: this.modalId }
    });
  }

  /**
   * Hides the modal and publishes a closed event.
   * Re-enables body scrolling.
   *
   * @public
   */
  hide() {
    if (!this.isOpen) return;
    this.isOpen = false;
    const backdrop = this.shadowRoot.querySelector(".modal-backdrop");
    if (backdrop) {
      backdrop.classList.remove("active");
      document.body.style.overflow = "";
    }
    this.pc.publish({
      topic: `${this.topic}.closed`,
      data: { modalId: this.modalId }
    });
  }

  /**
   * Toggles the modal between open and closed states.
   *
   * @public
   */
  toggle() {
    this.isOpen ? this.hide() : this.show();
  }

  /**
   * Renders the component's shadow DOM with styles and markup.
   * Supports header, body, and footer content slots.
   *
   * @private
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: contents;
        }

        .modal-backdrop {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(4px);
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .modal-backdrop.active {
          display: flex;
          opacity: 1;
        }

        .modal-content {
          background: var(--modal-bg, #ffffff);
          border-radius: var(--modal-radius, 0.75rem);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          transform: scale(0.95);
          transition: transform 0.2s ease;
        }

        .modal-backdrop.active .modal-content {
          transform: scale(1);
        }

        .modal-content.size-sm { width: 400px; max-width: 90vw; }
        .modal-content.size-md { width: 600px; max-width: 90vw; }
        .modal-content.size-lg { width: 800px; max-width: 90vw; }
        .modal-content.size-xl { width: 1200px; max-width: 95vw; }
        .modal-content.size-full { width: 95vw; height: 95vh; max-height: 95vh; }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--modal-border, #e2e8f0);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-title {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--modal-title-color, #1e293b);
          margin: 0;
        }

        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: var(--modal-close-color, #64748b);
          cursor: pointer;
          padding: 0.25rem;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 0.375rem;
          transition: all 0.2s;
        }

        .close-btn:hover {
          background: var(--modal-close-hover-bg, #f1f5f9);
          color: var(--modal-close-hover-color, #1e293b);
        }

        .modal-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
          color: var(--modal-text-color, #334155);
        }

        .modal-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--modal-border, #e2e8f0);
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
          background: var(--modal-footer-bg, #f8fafc);
        }

        .hidden {
          display: none;
        }
      </style>

      <div class="modal-backdrop">
        <div class="modal-content size-${this.size}" role="dialog" aria-modal="true">
          <div class="modal-header">
            <slot name="header">
              ${this.title ? `<h2 class="modal-title">${this.title}</h2>` : ""}
            </slot>
            ${this.closable ? `
              <button class="close-btn" aria-label="Close">&times;</button>
            ` : ""}
          </div>

          <div class="modal-body">
            <slot></slot>
          </div>

          <div class="modal-footer ${this.querySelector('[slot="footer"]') ? "" : "hidden"}">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }
}
customElements.define("pan-modal", PanModal);
var pan_modal_default = PanModal;
export {
  PanModal,
  pan_modal_default as default
};
//# sourceMappingURL=pan-modal.js.map
