function enforceHTTPS(options = {}) {
  const {
    enforce = true,
    allowedHosts = ["localhost", "127.0.0.1", "[::1]"]
  } = options;
  if (!enforce) return;
  const isHTTPS = location.protocol === "https:";
  const hostname = location.hostname;
  const isAllowedHost = allowedHosts.some((host) => hostname === host);
  if (!isHTTPS && !isAllowedHost) {
    console.error("\u{1F512} PAN Security: HTTPS is required in production");
    console.error(`Current URL: ${location.href}`);
    console.error("Redirecting to HTTPS...");
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
  }
}
function sanitizeHTML(html) {
  if (!html || typeof html !== "string") return "";
  const temp = document.createElement("div");
  temp.textContent = html;
  return temp.innerHTML;
}
function safeSetHTML(element, html) {
  if (!element) return;
  if (typeof html !== "string") {
    element.textContent = "";
    return;
  }
  if (typeof window !== "undefined" && window.DOMPurify) {
    element.innerHTML = window.DOMPurify.sanitize(html);
  } else {
    element.textContent = html;
    console.warn("DOMPurify not available. Using textContent. Install DOMPurify for proper HTML sanitization.");
  }
}
function createTextNode(text) {
  return document.createTextNode(text || "");
}
function createElement(tag, attrs = {}, content = "") {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith("on")) {
      console.warn(`Skipping event handler attribute: ${key}`);
      continue;
    }
    if (["innerHTML", "outerHTML"].includes(key)) {
      console.warn(`Skipping dangerous attribute: ${key}`);
      continue;
    }
    element.setAttribute(key, value);
  }
  if (content) {
    element.textContent = content;
  }
  return element;
}
function isSafeURL(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim().toLowerCase();
  const dangerousProtocols = [
    "javascript:",
    "data:",
    "vbscript:",
    "file:"
  ];
  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      console.warn(`Blocked dangerous URL protocol: ${protocol}`);
      return false;
    }
  }
  return true;
}
function setSafeHref(element, href) {
  if (!element || !href) return;
  if (isSafeURL(href)) {
    element.href = href;
  } else {
    console.error("Blocked unsafe URL:", href);
    element.href = "#";
  }
}
function checkCSP() {
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  const cspHeader = document.querySelector('meta[name="Content-Security-Policy"]');
  const hasCSP = !!(cspMeta || cspHeader);
  if (!hasCSP) {
    console.warn("\u26A0 PAN Security: No Content-Security-Policy found");
    console.warn("Add CSP meta tag or header for better security");
  }
  return {
    configured: hasCSP,
    meta: cspMeta ? cspMeta.content : null,
    header: cspHeader ? cspHeader.content : null
  };
}
function initSecurity(options = {}) {
  const {
    enforceHTTPS: shouldEnforceHTTPS = true,
    checkCSP: shouldCheckCSP = true
  } = options;
  console.log("\u{1F6E1}\uFE0F PAN Security initializing...");
  if (shouldEnforceHTTPS) {
    enforceHTTPS();
  }
  if (shouldCheckCSP) {
    checkCSP();
  }
  console.log("\u2713 PAN Security initialized");
}
function escapeHTML(text) {
  if (!text || typeof text !== "string") return "";
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
function stripHTML(html) {
  if (!html || typeof html !== "string") return "";
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}
var pan_security_default = {
  enforceHTTPS,
  sanitizeHTML,
  safeSetHTML,
  createTextNode,
  createElement,
  isSafeURL,
  setSafeHref,
  checkCSP,
  initSecurity,
  escapeHTML,
  stripHTML
};
export {
  checkCSP,
  createElement,
  createTextNode,
  pan_security_default as default,
  enforceHTTPS,
  escapeHTML,
  initSecurity,
  isSafeURL,
  safeSetHTML,
  sanitizeHTML,
  setSafeHref,
  stripHTML
};
//# sourceMappingURL=pan-security.js.map
