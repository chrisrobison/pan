const defaults = {
  baseUrl: null,
  // Full URL base (CDN or absolute path)
  componentsPath: "./",
  // Relative path from baseUrl or import.meta.url
  extension: ".mjs",
  rootMargin: 600
};
const rawGlobal = typeof window !== "undefined" && window.panAutoload && typeof window.panAutoload === "object" ? window.panAutoload : {};
const config = Object.assign({}, defaults, rawGlobal);
config.extension = config.extension?.startsWith(".") ? config.extension : `.${config.extension || "mjs"}`;
config.componentsPath = config.componentsPath || defaults.componentsPath;
config.rootMargin = Number.isFinite(config.rootMargin) ? config.rootMargin : defaults.rootMargin;
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
const loading = /* @__PURE__ */ new Set();
const observed = /* @__PURE__ */ new WeakSet();
const hasIO = typeof window !== "undefined" && "IntersectionObserver" in window;
const io = hasIO ? new IntersectionObserver((entries) => {
  for (const { isIntersecting, target } of entries) {
    if (!isIntersecting) continue;
    io.unobserve(target);
    maybeLoadFor(target);
  }
}, { rootMargin: `${config.rootMargin}px` }) : null;
function moduleFromTag(tag) {
  try {
    return new URL(`${tag}${config.extension}`, baseHref).href;
  } catch (_) {
    const normalizedBase = baseHref.endsWith("/") ? baseHref : `${baseHref}/`;
    return `${normalizedBase}${tag}${config.extension}`;
  }
}
function isCustomTag(node) {
  if (typeof customElements === "undefined") return false;
  return node && node.nodeType === 1 && typeof node.tagName === "string" && node.tagName.includes("-") && !customElements.get(node.localName);
}
function urlFor(el) {
  const explicit = el.getAttribute("data-module");
  if (explicit) return explicit;
  return moduleFromTag(el.localName);
}
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
async function ensurePanBus() {
  if (document.querySelector("pan-bus")) return;
  const bus = document.createElement("pan-bus");
  const target = document.body || document.documentElement;
  if (target) {
    target.insertBefore(bus, target.firstChild);
  }
  await maybeLoadFor(bus);
}
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
//# sourceMappingURL=autoload.js.map
