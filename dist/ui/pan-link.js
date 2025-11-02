import { PanClient } from "./pan-client.mjs";

/**
 * PanLink - A navigation link component that integrates with PanBus for client-side routing.
 *
 * @class PanLink
 * @extends {HTMLElement}
 *
 * @example
 * // Basic navigation link
 * <pan-link to="/dashboard">Dashboard</pan-link>
 *
 * @example
 * // Link with active class matching
 * <pan-link to="/users" active-class="current" exact>Users</pan-link>
 *
 * @example
 * // Link that replaces history instead of pushing
 * <pan-link to="/settings" replace>Settings</pan-link>
 */
class PanLink extends HTMLElement {
  /**
   * Returns the list of attributes that trigger attributeChangedCallback when modified.
   *
   * @static
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["to", "replace", "active-class", "exact"];
  }

  /**
   * Creates an instance of PanLink.
   * Initializes PanClient and current path tracking.
   *
   * @constructor
   */
  constructor() {
    super();

    /**
     * PanClient instance for pub/sub messaging.
     * @type {PanClient}
     */
    this.pc = new PanClient(this);

    /**
     * Current navigation path from PanBus state.
     * @type {string}
     */
    this.currentPath = "";
  }

  /**
   * Lifecycle callback invoked when the element is connected to the DOM.
   */
  connectedCallback() {
    this.#render();
    this.#subscribe();
    this.addEventListener("click", this.#handleClick);
  }

  /**
   * Lifecycle callback invoked when the element is disconnected from the DOM.
   */
  disconnectedCallback() {
    this.removeEventListener("click", this.#handleClick);
  }

  /**
   * Lifecycle callback invoked when an observed attribute changes.
   */
  attributeChangedCallback() {
    if (this.isConnected) this.#render();
  }

  /**
   * Gets the target navigation path.
   *
   * @type {string}
   * @returns {string} The target path
   */
  get to() {
    return this.getAttribute("to") || "";
  }

  /**
   * Gets whether to replace the current history entry instead of pushing.
   *
   * @type {boolean}
   * @returns {boolean} True if replace mode is enabled
   */
  get replace() {
    return this.hasAttribute("replace");
  }

  /**
   * Gets the CSS class to apply when the link is active.
   *
   * @type {string}
   * @returns {string} The active class name, defaults to "active"
   */
  get activeClass() {
    return this.getAttribute("active-class") || "active";
  }

  /**
   * Gets whether to use exact path matching for active state.
   *
   * @type {boolean}
   * @returns {boolean} True if exact matching is enabled
   */
  get exact() {
    return this.hasAttribute("exact");
  }

  /**
   * Renders the link element with appropriate attributes and styles.
   *
   * @private
   */
  #render() {
    this.style.cursor = "pointer";
    this.style.textDecoration = this.style.textDecoration || "none";
    this.setAttribute("role", "link");
    this.setAttribute("tabindex", "0");
    this.#updateActiveState();
  }

  /**
   * Subscribes to navigation state changes on PanBus.
   *
   * @private
   */
  #subscribe() {
    this.pc.subscribe("nav.state", (msg) => {
      this.currentPath = msg.data?.path || "";
      this.#updateActiveState();
    }, { retained: true });
  }

  /**
   * Handles click events and publishes navigation events to PanBus.
   *
   * @param {Event} e - The click event
   * @private
   */
  #handleClick = (e) => {
    e.preventDefault();
    if (!this.to) return;
    this.pc.publish({
      topic: this.replace ? "nav.replace" : "nav.goto",
      data: { path: this.to }
    });
  };

  /**
   * Updates the active CSS class based on current path matching.
   * Uses exact or prefix matching based on the `exact` attribute.
   *
   * @private
   */
  #updateActiveState() {
    const isActive = this.exact ? this.currentPath === this.to : this.currentPath.startsWith(this.to);
    if (isActive) {
      this.classList.add(this.activeClass);
    } else {
      this.classList.remove(this.activeClass);
    }
  }
}
customElements.define("pan-link", PanLink);
var pan_link_default = PanLink;
export {
  PanLink,
  pan_link_default as default
};
//# sourceMappingURL=pan-link.js.map
