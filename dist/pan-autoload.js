// PAN Autoload — progressively loads Web Components on demand.
//
// Usage:
//   <script type="module" src="./dist/pan-autoload.js"></script>
//   <!-- declare <my-widget></my-widget> anywhere -->
//
// Conventions:
//   - Components live in `${componentsPath}/${tagName}.mjs`
//   - Override per element with `data-module="/path/to/file.mjs"`
//   - Configure before load with `window.panAutoload = { componentsPath: '/custom', extension: '.js' }`
//
// The loader observes the document for custom element tags (names with a dash)
// that are not yet defined. When one approaches the viewport it dynamically
// imports the module and, if the module did not register the custom element,
// defines it from the default export (if it is a class).

const defaults = {
  componentsPath: '../components/',
  extension: '.mjs',
  rootMargin: 600,
};

const rawGlobal =
  typeof window !== 'undefined' && window.panAutoload && typeof window.panAutoload === 'object'
    ? window.panAutoload
    : {};

const config = Object.assign({}, defaults, rawGlobal);
config.extension = config.extension?.startsWith('.') ? config.extension : `.${config.extension || 'mjs'}`;
config.componentsPath = config.componentsPath || defaults.componentsPath;
config.rootMargin = Number.isFinite(config.rootMargin) ? config.rootMargin : defaults.rootMargin;

let baseHref;
try {
  const normalizedBase = config.componentsPath.endsWith('/') ? config.componentsPath : `${config.componentsPath}/`;
  baseHref = new URL(normalizedBase, import.meta.url).href;
} catch (_) {
  const normalizedBase = config.componentsPath.endsWith('/') ? config.componentsPath : `${config.componentsPath}/`;
  baseHref = normalizedBase;
}
config.resolvedComponentsPath = baseHref;

const loading = new Set();
const observed = new WeakSet();

const hasIO = typeof window !== 'undefined' && 'IntersectionObserver' in window;

const io = hasIO
  ? new IntersectionObserver((entries) => {
      for (const { isIntersecting, target } of entries) {
        if (!isIntersecting) continue;
        io.unobserve(target);
        maybeLoadFor(target);
      }
    }, { rootMargin: `${config.rootMargin}px` })
  : null;

function moduleFromTag(tag) {
  try {
    return new URL(`${tag}${config.extension}`, baseHref).href;
  } catch (_) {
    const normalizedBase = baseHref.endsWith('/') ? baseHref : `${baseHref}/`;
    return `${normalizedBase}${tag}${config.extension}`;
  }
}

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

function urlFor(el) {
  const explicit = el.getAttribute('data-module');
  if (explicit) return explicit;
  return moduleFromTag(el.localName);
}

export async function maybeLoadFor(el) {
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

function init() {
  if (typeof document === 'undefined' || typeof customElements === 'undefined') return;

  observeTree(document);
  setupMutationObserver();

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      document.querySelectorAll(':not(:defined)').forEach((el) => {
        if (isCustomTag(el)) maybeLoadFor(el);
      });
    });
  } else {
    // Fallback: eager load anything currently in view.
    document.querySelectorAll(':not(:defined)').forEach((el) => {
      if (isCustomTag(el)) maybeLoadFor(el);
    });
  }
}

init();

export const panAutoload = {
  config,
  observeTree,
  maybeLoadFor,
};

if (typeof window !== 'undefined') {
  window.panAutoload = Object.assign(window.panAutoload || {}, panAutoload);
}

export default panAutoload;
