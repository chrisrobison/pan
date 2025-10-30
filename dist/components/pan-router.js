import { PanClient } from "./pan-client.mjs";
class PanRouter extends HTMLElement {
  static get observedAttributes() {
    return ["base", "mode", "auth-topic"];
  }
  // Private fields
  #onPopState;
  #onLinkClick;
  constructor() {
    super();
    this.pc = new PanClient(this);
    this.routes = [];
    this.guards = [];
    this.authState = null;
  }
  connectedCallback() {
    this.#bindNavigation();
    this.#subscribeToTopics();
    this.#publishCurrentState();
  }
  disconnectedCallback() {
    window.removeEventListener("popstate", this.#onPopState);
    window.removeEventListener("click", this.#onLinkClick);
  }
  attributeChangedCallback() {
    if (this.isConnected) this.#publishCurrentState();
  }
  get base() {
    return (this.getAttribute("base") || "").trim();
  }
  get mode() {
    return this.getAttribute("mode") || "history";
  }
  get authTopic() {
    return this.getAttribute("auth-topic") || "auth.state";
  }
  // Register a route with optional guard
  addRoute(pattern, guard) {
    this.routes.push({ pattern, guard });
  }
  // Add a global guard function
  addGuard(fn) {
    if (typeof fn === "function") this.guards.push(fn);
  }
  #bindNavigation() {
    this.#onPopState = () => this.#publishCurrentState();
    this.#onLinkClick = (e) => this.#handleLinkClick(e);
    window.addEventListener("popstate", this.#onPopState);
    window.addEventListener("click", this.#onLinkClick, true);
  }
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
  #handleGoto(msg, replace = false) {
    const data = msg.data || {};
    const path = data.path || data.url || "";
    const state = data.state || {};
    this.#navigate(path, replace || data.replace, state);
  }
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
  #matchRoute(path, pattern) {
    if (pattern === "*" || path === pattern) return true;
    if (pattern.includes("*")) {
      const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
      return regex.test(path);
    }
    return false;
  }
  #resolvePath(path) {
    if (path.startsWith("/")) return path;
    const current = this.#getCurrentPath();
    const segments = current.split("/").slice(0, -1);
    segments.push(path);
    return segments.join("/");
  }
  #getCurrentPath() {
    if (this.mode === "hash") {
      return window.location.hash.slice(1) || "/";
    }
    return window.location.pathname;
  }
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
