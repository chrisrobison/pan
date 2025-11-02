import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that provides client-side routing with guards and authentication support.
 * Supports both history and hash-based routing modes.
 *
 * @fires nav.state - Publishes navigation state changes to pan-bus
 * @fires nav.blocked - Published when navigation is blocked by a guard
 *
 * @attr {string} base - Base path for all routes
 * @attr {string} mode - Routing mode: "history" or "hash" (default: "history")
 * @attr {string} auth-topic - Topic to subscribe for auth state (default: "auth.state")
 *
 * @example
 * <pan-router mode="history" auth-topic="auth.state"></pan-router>
 * <script>
 *   const router = document.querySelector('pan-router');
 *   router.addRoute('/admin/*', (path, authState) => authState?.isAdmin);
 *   router.addGuard((path, authState) => {
 *     if (path.startsWith('/protected/') && !authState) return false;
 *     return true;
 *   });
 * </script>
 */
class PanRouter extends HTMLElement {
  static get observedAttributes() {
    return ["base", "mode", "auth-topic"];
  }
  // Private fields
  #onPopState;
  #onLinkClick;

  /**
   * Creates a new PanRouter instance
   */
  constructor() {
    super();
    this.pc = new PanClient(this);
    /** @type {Array<{pattern: string, guard: Function}>} */
    this.routes = [];
    /** @type {Array<Function>} */
    this.guards = [];
    /** @type {Object|null} */
    this.authState = null;
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   */
  connectedCallback() {
    this.#bindNavigation();
    this.#subscribeToTopics();
    this.#publishCurrentState();
  }

  /**
   * Lifecycle: Called when element is removed from the DOM
   */
  disconnectedCallback() {
    window.removeEventListener("popstate", this.#onPopState);
    window.removeEventListener("click", this.#onLinkClick);
  }

  /**
   * Lifecycle: Called when an observed attribute changes
   * @param {string} name - Attribute name
   * @param {string} oldValue - Previous value
   * @param {string} newValue - New value
   */
  attributeChangedCallback() {
    if (this.isConnected) this.#publishCurrentState();
  }

  /**
   * Get the base path for routes
   * @returns {string} Base path
   */
  get base() {
    return (this.getAttribute("base") || "").trim();
  }

  /**
   * Get the routing mode
   * @returns {string} "history" or "hash"
   */
  get mode() {
    return this.getAttribute("mode") || "history";
  }

  /**
   * Get the authentication state topic
   * @returns {string} Topic name for auth state
   */
  get authTopic() {
    return this.getAttribute("auth-topic") || "auth.state";
  }

  /**
   * Register a route with an optional guard function
   * @param {string} pattern - Route pattern (supports :params and * wildcards)
   * @param {Function} [guard] - Guard function (path, authState) => boolean
   *
   * @example
   * router.addRoute('/users/:id', (path, auth) => auth?.isLoggedIn);
   * router.addRoute('/admin/*', (path, auth) => auth?.isAdmin);
   */
  addRoute(pattern, guard) {
    this.routes.push({ pattern, guard });
  }

  /**
   * Add a global guard function that applies to all routes
   * @param {Function} fn - Guard function (path, authState) => boolean
   *
   * @example
   * router.addGuard((path, authState) => {
   *   if (path.startsWith('/protected/') && !authState) return false;
   *   return true;
   * });
   */
  addGuard(fn) {
    if (typeof fn === "function") this.guards.push(fn);
  }
  /**
   * Bind browser navigation events
   * @private
   */
  #bindNavigation() {
    this.#onPopState = () => this.#publishCurrentState();
    this.#onLinkClick = (e) => this.#handleLinkClick(e);
    window.addEventListener("popstate", this.#onPopState);
    window.addEventListener("click", this.#onLinkClick, true);
  }

  /**
   * Subscribe to navigation and auth topics on the pan-bus
   * @private
   */
  #subscribeToTopics() {
    this.pc.subscribe("nav.goto", (msg) => this.#handleGoto(msg));
    this.pc.subscribe("nav.back", () => window.history.back());
    this.pc.subscribe("nav.forward", () => window.history.forward());
    this.pc.subscribe("nav.replace", (msg) => this.#handleGoto(msg, true));
    if (this.authTopic) {
      this.pc.subscribe(this.authTopic, (msg) => {
        this.authState = msg.data;
      }, { retained: true });
    }
  }
  /**
   * Handle clicks on anchor elements for SPA navigation
   * @private
   * @param {MouseEvent} e - Click event
   */
  #handleLinkClick(e) {
    const link = e.target.closest("a");
    if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("http://") || href.startsWith("https://") || href.startsWith("//")) return;
    if (href.startsWith("#")) {
      if (this.mode === "hash") {
        e.preventDefault();
        this.#navigate(href);
      }
      return;
    }
    if (this.mode === "history") {
      e.preventDefault();
      this.#navigate(href, link.hasAttribute("data-replace"));
    }
  }

  /**
   * Handle nav.goto messages from pan-bus
   * @private
   * @param {Object} msg - Message with path and optional state
   * @param {boolean} [replace=false] - Whether to replace history entry
   */
  #handleGoto(msg, replace = false) {
    const data = msg.data || {};
    const path = data.path || data.url || "";
    const state = data.state || {};
    this.#navigate(path, replace || data.replace, state);
  }

  /**
   * Navigate to a path, checking guards first
   * @private
   * @param {string} path - Path to navigate to
   * @param {boolean} [replace=false] - Whether to replace history entry
   * @param {Object} [state={}] - State to push to history
   */
  #navigate(path, replace = false, state = {}) {
    if (!this.#checkGuards(path)) {
      this.pc.publish({
        topic: "nav.blocked",
        data: { path, reason: "guard" }
      });
      return;
    }
    const fullPath = this.#resolvePath(path);
    if (this.mode === "hash") {
      if (replace) {
        window.location.replace("#" + fullPath);
      } else {
        window.location.hash = fullPath;
      }
    } else {
      if (replace) {
        window.history.replaceState(state, "", fullPath);
      } else {
        window.history.pushState(state, "", fullPath);
      }
    }
    this.#publishCurrentState();
  }

  /**
   * Check if navigation to path is allowed by guards
   * @private
   * @param {string} path - Path to check
   * @returns {boolean} True if navigation is allowed
   */
  #checkGuards(path) {
    for (const route of this.routes) {
      if (this.#matchRoute(path, route.pattern)) {
        if (route.guard && !route.guard(path, this.authState)) {
          return false;
        }
      }
    }
    for (const guard of this.guards) {
      if (!guard(path, this.authState)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a path matches a route pattern
   * @private
   * @param {string} path - Path to check
   * @param {string} pattern - Pattern with * wildcards
   * @returns {boolean} True if path matches pattern
   */
  #matchRoute(path, pattern) {
    if (pattern === "*" || path === pattern) return true;
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(path);
    }
    return false;
  }

  /**
   * Resolve a relative path to absolute
   * @private
   * @param {string} path - Path to resolve
   * @returns {string} Absolute path
   */
  #resolvePath(path) {
    if (path.startsWith("/")) return path;
    const current = this.#getCurrentPath();
    const segments = current.split("/").slice(0, -1);
    segments.push(path);
    return segments.join("/");
  }

  /**
   * Get the current path based on routing mode
   * @private
   * @returns {string} Current path
   */
  #getCurrentPath() {
    if (this.mode === "hash") {
      return window.location.hash.slice(1) || "/";
    }
    return window.location.pathname;
  }

  /**
   * Publish current navigation state to pan-bus
   * @private
   */
  #publishCurrentState() {
    const path = this.#getCurrentPath();
    const search = window.location.search;
    const hash = this.mode === "history" ? window.location.hash : "";
    const query = {};
    const params = new URLSearchParams(search);
    for (const [key, value] of params) {
      query[key] = value;
    }
    const pathParams = this.#extractPathParams(path);
    const state = {
      path,
      query,
      hash: hash.slice(1),
      params: pathParams,
      full: window.location.href
    };
    this.pc.publish({
      topic: "nav.state",
      data: state,
      retain: true
    });
  }

  /**
   * Extract path parameters from current path based on registered routes
   * @private
   * @param {string} path - Current path
   * @returns {Object} Object with parameter key-value pairs
   */
  #extractPathParams(path) {
    const params = {};
    for (const route of this.routes) {
      const pattern = route.pattern;
      if (pattern.includes(":")) {
        const regex = new RegExp(
          "^" + pattern.replace(/:[^/]+/g, "([^/]+)") + "$"
        );
        const match = path.match(regex);
        if (match) {
          const paramNames = (pattern.match(/:[^/]+/g) || []).map((p) => p.slice(1));
          paramNames.forEach((name, i) => {
            params[name] = match[i + 1];
          });
          break;
        }
      }
    }
    return params;
  }
}
customElements.define("pan-router", PanRouter);
var pan_router_default = PanRouter;
export {
  PanRouter,
  pan_router_default as default
};
//# sourceMappingURL=pan-router.js.map
