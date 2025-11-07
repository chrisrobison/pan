/**
 * @fileoverview PAN Autoload - Progressive loading of Web Components on demand
 *
 * Automatically discovers and loads custom elements as they approach the viewport using
 * IntersectionObserver. Eliminates the need for manual imports and customElements.define()
 * calls, enabling true zero-build development.
 *
 * @example
 * // Local development
 * <script type="module" src="./src/pan.mjs"></script>
 * <!-- Just use your components -->
 * <my-widget></my-widget>
 * <pan-card></pan-card>
 *
 * @example
 * // CDN usage with configuration
 * <script type="module">
 *   window.panAutoload = {
 *     baseUrl: 'https://unpkg.com/pan@latest/',
 *     extension: '.js'
 *   };
 * </script>
 * <script type="module" src="https://unpkg.com/pan@latest/autoload.js"></script>
 *
 * @example
 * // Override component path
 * <my-card data-module="/custom/path/special-card.mjs"></my-card>
 */

/**
 * @typedef {Object} AutoloadConfig
 * @property {string|null} baseUrl - Full CDN URL (e.g., 'https://unpkg.com/pan@latest/')
 * @property {string} componentsPath - Relative path from baseUrl (default: './')
 * @property {string} extension - File extension for components (default: '.mjs')
 * @property {number} rootMargin - IntersectionObserver margin in pixels (default: 600)
 * @property {string} resolvedComponentsPath - Computed full path for component loading
 */

/**
 * Default configuration for autoloader
 * @type {AutoloadConfig}
 * @private
 */
const defaults = {
  baseUrl: null,                // Full URL base (CDN or absolute path)
  componentsPath: './components/',  // Relative path from baseUrl or import.meta.url
  extension: '.mjs',
  rootMargin: 600,
};

// Merge user configuration from window.panAutoload if provided
const rawGlobal =
  typeof window !== 'undefined' && window.panAutoload && typeof window.panAutoload === 'object'
    ? window.panAutoload
    : {};

/**
 * Active configuration (merged defaults + user config)
 * @type {AutoloadConfig}
 */
const config = Object.assign({}, defaults, rawGlobal);
config.extension = config.extension?.startsWith('.') ? config.extension : `.${config.extension || 'mjs'}`;
config.componentsPath = config.componentsPath || defaults.componentsPath;
config.rootMargin = Number.isFinite(config.rootMargin) ? config.rootMargin : defaults.rootMargin;

// Calculate base URL for component loading
let baseHref;
if (config.baseUrl) {
  // Use explicit baseUrl (for CDN usage)
  const normalizedBase = config.baseUrl.endsWith('/') ? config.baseUrl : `${config.baseUrl}/`;
  const componentsPath = config.componentsPath.startsWith('./')
    ? config.componentsPath.slice(2)
    : config.componentsPath;
  try {
    baseHref = new URL(componentsPath, normalizedBase).href;
  } catch (_) {
    baseHref = `${normalizedBase}${componentsPath}`;
  }
} else {
  // Use relative path from import.meta.url (local development)
  try {
    const normalizedBase = config.componentsPath.endsWith('/') ? config.componentsPath : `${config.componentsPath}/`;
    baseHref = new URL(normalizedBase, import.meta.url).href;
  } catch (_) {
    const normalizedBase = config.componentsPath.endsWith('/') ? config.componentsPath : `${config.componentsPath}/`;
    baseHref = normalizedBase;
  }
}
config.resolvedComponentsPath = baseHref;

/**
 * Set of currently loading module URLs to prevent duplicate loads
 * @type {Set<string>}
 * @private
 */
const loading = new Set();

/**
 * WeakSet of observed elements to prevent duplicate observation
 * @type {WeakSet<Element>}
 * @private
 */
const observed = new WeakSet();

/**
 * Check if IntersectionObserver is available
 * @type {boolean}
 * @private
 */
const hasIO = typeof window !== 'undefined' && 'IntersectionObserver' in window;

/**
 * IntersectionObserver instance for progressive loading
 * Loads components as they approach the viewport
 * @type {IntersectionObserver|null}
 * @private
 */
const io = hasIO
  ? new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        io.unobserve(target);
        maybeLoadFor(target);
      }
    }, { rootMargin: `${config.rootMargin}px` })
  : null;

/**
 * Constructs module URL from tag name using configured paths
 *
 * @param {string} tag - Tag name (e.g., 'my-widget')
 * @returns {string} Full URL to component module
 * @private
 *
 * @example
 * moduleFromTag('my-widget')
 * // Returns: 'https://example.com/components/my-widget.mjs'
 */
function moduleFromTag(tag) {
  try {
    return new URL(`${tag}${config.extension}`, baseHref).href;
  } catch (_) {
    const normalizedBase = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
    return `${normalizedBase}${tag}${config.extension}`;
  }
}

/**
 * Checks if a node is a custom element tag that needs loading
 * A custom tag must:
 * - Be an Element (nodeType === 1)
 * - Have a dash in the tag name (web component standard)
 * - Not be already defined in customElements registry
 *
 * @param {Node} node - DOM node to check
 * @returns {boolean} True if node is an undefined custom element
 * @private
 *
 * @example
 * isCustomTag(document.createElement('my-widget'))  // true (if not defined)
 * isCustomTag(document.createElement('div'))        // false (no dash)
 * isCustomTag(document.createElement('pan-bus'))    // false (if already defined)
 */
function isCustomTag(node) {
  if (typeof customElements === 'undefined') return false;
  return (
    node &&
    node.nodeType === 1 &&
    typeof node.tagName === 'string' &&
    node.tagName.includes('-') &&
    !customElements.get(node.localName)
  );
}

/**
 * Gets the module URL for an element
 * Respects data-module attribute for custom paths
 *
 * @param {Element} el - Element to get URL for
 * @returns {string} Module URL
 * @private
 *
 * @example
 * // Default: uses tag name
 * <my-widget></my-widget>
 * urlFor(el) // Returns: './my-widget.mjs'
 *
 * // Override with data-module
 * <my-card data-module="/custom/special-card.mjs"></my-card>
 * urlFor(el) // Returns: '/custom/special-card.mjs'
 */
function urlFor(el) {
  const explicit = el.getAttribute('data-module');
  if (explicit) return explicit;
  return moduleFromTag(el.localName);
}

/**
 * Loads the component module for an element if needed
 * - Checks if element is a custom tag
 * - Prevents duplicate loads
 * - Dynamically imports the module
 * - Auto-defines the element if module exports a default class
 *
 * @param {Element} el - Element to load component for
 * @returns {Promise<void>} Resolves when load completes or skips
 * @public
 *
 * @example
 * // Manual loading (usually not needed - autoload handles this)
 * const widget = document.createElement('my-widget');
 * await maybeLoadFor(widget);
 * // Component is now loaded and defined
 */
export async function maybeLoadFor(el) {
  if (!el || !isCustomTag(el)) return;
  const url = urlFor(el);
  if (!url || loading.has(url) || customElements.get(el.localName)) return;

  loading.add(url);
  try {
    const mod = await import(url);
    // Auto-define if module exports a class and element isn't defined yet
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
 * Observes a DOM tree for undefined custom elements
 * - Finds all :not(:defined) elements
 * - Sets up IntersectionObserver (or loads immediately if not available)
 * - Prevents duplicate observation with WeakSet
 *
 * @param {Document|Element} [root=document] - Root element to observe
 * @returns {void}
 * @public
 *
 * @example
 * // Observe entire document (default)
 * observeTree();
 *
 * // Observe specific subtree
 * const container = document.querySelector('#dynamic-content');
 * observeTree(container);
 */
export function observeTree(root = document) {
  if (!root || observed.has(root)) return;

  const nodes = typeof root.querySelectorAll === 'function'
    ? root.querySelectorAll(':not(:defined)')
    : [];

  nodes.forEach((el) => {
    if (isCustomTag(el) && !observed.has(el)) {
      observed.add(el);
      if (io) io.observe(el); else maybeLoadFor(el);
    }
  });

  if (isCustomTag(root) && !observed.has(root)) {
    observed.add(root);
    if (io) io.observe(root); else maybeLoadFor(root);
  }
}

/**
 * Sets up MutationObserver to watch for new custom elements
 * Observes:
 * - childList: New elements added to DOM
 * - attributes: data-module attribute changes
 * - subtree: All descendants
 *
 * @private
 */
function setupMutationObserver() {
  if (typeof MutationObserver === 'undefined') return;
  const target = document.documentElement;
  if (!target) return;

  new MutationObserver((mutations) => {
    for (const mut of mutations) {
      if (mut.type === 'childList') {
        mut.addedNodes.forEach((node) => observeTree(node));
      } else if (mut.type === 'attributes' && mut.attributeName === 'data-module') {
        if (isCustomTag(mut.target)) {
          if (io) io.observe(mut.target); else maybeLoadFor(mut.target);
        }
      }
    }
  }).observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-module'],
  });
}

/**
 * Ensures pan-bus element exists and is loaded
 * PAN bus is the backbone of PAN messaging, so it's loaded first
 * - Checks if pan-bus already exists
 * - Creates and inserts it if not found
 * - Loads the pan-bus component immediately
 *
 * @returns {Promise<void>} Resolves when pan-bus is ready
 * @private
 */
async function ensurePanBus() {
  // Check if pan-bus already exists in the document
  if (document.querySelector('pan-bus')) return;

  // Create and insert pan-bus element
  const bus = document.createElement('pan-bus');
  const target = document.body || document.documentElement;
  if (target) {
    target.insertBefore(bus, target.firstChild);
  }

  // Load the pan-bus component immediately
  await maybeLoadFor(bus);
}

/**
 * Initializes the autoloader
 * - Ensures pan-bus is loaded first
 * - Observes document for undefined elements
 * - Sets up MutationObserver for dynamic content
 * - Uses requestIdleCallback for non-blocking initial scan
 *
 * @private
 */
function init() {
  if (typeof document === 'undefined' || typeof customElements === 'undefined') return;

  // Ensure pan-bus is loaded first (it's the backbone)
  ensurePanBus().then(() => {
    observeTree(document);
    setupMutationObserver();

    // Non-blocking initial scan of existing elements
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => {
        document.querySelectorAll(':not(:defined)').forEach((el) => {
          if (isCustomTag(el)) maybeLoadFor(el);
        });
      });
    } else {
      // Fallback: eager load anything currently in view
      document.querySelectorAll(':not(:defined)').forEach((el) => {
        if (isCustomTag(el)) maybeLoadFor(el);
      });
    }
  });
}

// Start autoloading
init();

/**
 * Public API for pan-autoload
 * Exposed as window.panAutoload and as module exports
 *
 * @type {Object}
 * @property {AutoloadConfig} config - Active configuration
 * @property {Function} observeTree - Manually observe a DOM tree
 * @property {Function} maybeLoadFor - Manually load a component
 *
 * @example
 * // Access configuration
 * console.log(window.panAutoload.config);
 *
 * // Manually observe new content
 * const newContent = document.querySelector('#dynamic');
 * window.panAutoload.observeTree(newContent);
 *
 * // Manually load component
 * const widget = document.createElement('my-widget');
 * await window.panAutoload.maybeLoadFor(widget);
 */
export const panAutoload = {
  config,
  observeTree,
  maybeLoadFor,
};

if (typeof window !== 'undefined') {
  window.panAutoload = Object.assign(window.panAutoload || {}, panAutoload);
}

export default panAutoload;
