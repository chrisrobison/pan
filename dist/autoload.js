/**
 * @fileoverview Pan Autoload - Automatic custom element loader for Pan framework
 * Automatically detects and loads custom elements on demand using IntersectionObserver
 * @module pan-autoload
 */

/**
 * @typedef {Object} AutoloadConfig
 * @property {string|null} baseUrl - Full URL base (CDN or absolute path)
 * @property {string} componentsPath - Relative path from baseUrl or import.meta.url
 * @property {string} extension - File extension for component modules (e.g., ".mjs", ".js")
 * @property {number} rootMargin - IntersectionObserver root margin in pixels
 * @property {string} [resolvedComponentsPath] - Computed absolute path to components
 */

/**
 * Default configuration for pan-autoload
 * @type {AutoloadConfig}
 */
const defaults = {
  baseUrl: null,
  // Full URL base (CDN or absolute path)
  componentsPath: "./",
  // Relative path from baseUrl or import.meta.url
  extension: ".mjs",
  rootMargin: 600
};
/**
 * Global configuration from window.panAutoload if available
 * @type {Partial<AutoloadConfig>}
 */
const rawGlobal = typeof window !== "undefined" && window.panAutoload && typeof window.panAutoload === "object" ? window.panAutoload : {};

/**
 * Merged configuration combining defaults and global settings
 * @type {AutoloadConfig}
 */
const config = Object.assign({}, defaults, rawGlobal);
config.extension = config.extension?.startsWith(".") ? config.extension : `.${config.extension || "mjs"}`;
config.componentsPath = config.componentsPath || defaults.componentsPath;
config.rootMargin = Number.isFinite(config.rootMargin) ? config.rootMargin : defaults.rootMargin;

/**
 * Computed base URL for loading components
 * @type {string}
 */
let baseHref;
if (config.baseUrl) {
  const normalizedBase = config.baseUrl.endsWith("/") ? config.baseUrl : `${config.baseUrl}/`;
  const componentsPath = config.componentsPath.startsWith("./") ? config.componentsPath.slice(2) : config.componentsPath;
  try {
    baseHref = new URL(componentsPath, normalizedBase).href;
  } catch (_) {
    baseHref = `${normalizedBase}${componentsPath}`;
  }
} else {
  try {
    const normalizedBase = config.componentsPath.endsWith("/") ? config.componentsPath : `${config.componentsPath}/`;
    baseHref = new URL(normalizedBase, import.meta.url).href;
  } catch (_) {
    const normalizedBase = config.componentsPath.endsWith("/") ? config.componentsPath : `${config.componentsPath}/`;
    baseHref = normalizedBase;
  }
}
config.resolvedComponentsPath = baseHref;

/**
 * Set of currently loading module URLs to prevent duplicate loads
 * @type {Set<string>}
 */
const loading = /* @__PURE__ */ new Set();

/**
 * WeakSet of elements already observed to prevent duplicate observations
 * @type {WeakSet<Element>}
 */
const observed = /* @__PURE__ */ new WeakSet();

/**
 * Whether IntersectionObserver is available in this environment
 * @type {boolean}
 */
const hasIO = typeof window !== "undefined" && "IntersectionObserver" in window;

/**
 * IntersectionObserver instance for lazy-loading components when they become visible
 * @type {IntersectionObserver|null}
 */
const io = hasIO ? new IntersectionObserver((entries) => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue;
    io.unobserve(target);
    maybeLoadFor(target);
  }
}, { rootMargin: `${config.rootMargin}px` }) : null;

/**
 * Converts a custom element tag name to its module URL
 * @param {string} tag - The custom element tag name (e.g., "my-component")
 * @returns {string} The full URL to the component module
 * @example
 * moduleFromTag("my-component") // Returns: "https://example.com/components/my-component.mjs"
 */
function moduleFromTag(tag) {
  try {
    return new URL(`${tag}${config.extension}`, baseHref).href;
  } catch (_) {
    const normalizedBase = baseHref.endsWith("/") ? baseHref : `${baseHref}/`;
    return `${normalizedBase}${tag}${config.extension}`;
  }
}

/**
 * Checks if a node is an undefined custom element that needs to be loaded
 * @param {Node} node - The DOM node to check
 * @returns {boolean} True if the node is an unregistered custom element
 */
function isCustomTag(node) {
  if (typeof customElements === "undefined") return false;
  return node && node.nodeType === 1 && typeof node.tagName === "string" && node.tagName.includes("-") && !customElements.get(node.localName);
}

/**
 * Gets the module URL for a custom element, checking data-module attribute first
 * @param {Element} el - The custom element
 * @returns {string} The URL to load the element's module from
 */
function urlFor(el) {
  const explicit = el.getAttribute("data-module");
  if (explicit) return explicit;
  return moduleFromTag(el.localName);
}

/**
 * Attempts to load and define a custom element if not already loaded
 * @param {Element} el - The custom element to load
 * @returns {Promise<void>}
 * @example
 * await maybeLoadFor(document.querySelector('my-component'));
 */
async function maybeLoadFor(el) {
  if (!el || !isCustomTag(el)) return;
  const url = urlFor(el);
  if (!url || loading.has(url) || customElements.get(el.localName)) return;
  loading.add(url);
  try {
    const mod = await import(url);
    if (!customElements.get(el.localName) && mod?.default instanceof Function) {
      customElements.define(el.localName, mod.default);
    }
  } catch (err) {
    console.warn(`[pan-autoload] Failed to load ${url} for <${el.localName}>`, err);
  } finally {
    loading.delete(url);
  }
}

/**
 * Observes a DOM tree for undefined custom elements and sets up loading
 * @param {Document|Element} [root=document] - The root element to observe
 * @example
 * // Observe the entire document
 * observeTree();
 *
 * // Observe a specific container
 * observeTree(document.getElementById('container'));
 */
function observeTree(root = document) {
  if (!root || observed.has(root)) return;
  const nodes = typeof root.querySelectorAll === "function" ? root.querySelectorAll(":not(:defined)") : [];
  nodes.forEach((el) => {
    if (isCustomTag(el) && !observed.has(el)) {
      observed.add(el);
      if (io) io.observe(el);
      else maybeLoadFor(el);
    }
  });
  if (isCustomTag(root) && !observed.has(root)) {
    observed.add(root);
    if (io) io.observe(root);
    else maybeLoadFor(root);
  }
}

/**
 * Sets up a MutationObserver to watch for dynamically added custom elements
 * Automatically called during initialization
 */
function setupMutationObserver() {
  if (typeof MutationObserver === "undefined") return;
  const target = document.documentElement;
  if (!target) return;
  new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.type === "childList") {
        mut.addedNodes.forEach((node) => observeTree(node));
      } else if (mut.type === "attributes" && mut.attributeName === "data-module") {
        if (isCustomTag(mut.target)) {
          if (io) io.observe(mut.target);
          else maybeLoadFor(mut.target);
        }
      }
    }
  }).observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["data-module"]
  });
}

/**
 * Ensures the pan-bus element exists in the document
 * Creates and injects it if not already present
 * @returns {Promise<void>}
 */
async function ensurePanBus() {
  if (document.querySelector("pan-bus")) return;
  const bus = document.createElement("pan-bus");
  const target = document.body || document.documentElement;
  if (target) {
    target.insertBefore(bus, target.firstChild);
  }
  await maybeLoadFor(bus);
}

/**
 * Initializes the pan-autoload system
 * Sets up observers and loads initial custom elements
 */
function init() {
  if (typeof document === "undefined" || typeof customElements === "undefined") return;
  ensurePanBus().then(() => {
    observeTree(document);
    setupMutationObserver();
    if (typeof requestIdleCallback === "function") {
      requestIdleCallback(() => {
        document.querySelectorAll(":not(:defined)").forEach((el) => {
          if (isCustomTag(el)) maybeLoadFor(el);
        });
      });
    } else {
      document.querySelectorAll(":not(:defined)").forEach((el) => {
        if (isCustomTag(el)) maybeLoadFor(el);
      });
    }
  });
}
init();

/**
 * @typedef {Object} PanAutoloadAPI
 * @property {AutoloadConfig} config - The current autoload configuration
 * @property {Function} observeTree - Function to observe a DOM tree for custom elements
 * @property {Function} maybeLoadFor - Function to load a specific custom element
 */

/**
 * Public API for pan-autoload
 * @type {PanAutoloadAPI}
 */
const panAutoload = {
  config,
  observeTree,
  maybeLoadFor
};
if (typeof window !== "undefined") {
  window.panAutoload = Object.assign(window.panAutoload || {}, panAutoload);
}
var pan_autoload_default = panAutoload;
export {
  pan_autoload_default as default,
  maybeLoadFor,
  observeTree,
  panAutoload
};
//# sourceMappingURL=pan-autoload.js.map
