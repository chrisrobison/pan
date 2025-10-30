class PanThemeProvider extends HTMLElement {
  static observedAttributes = ["theme"];
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._theme = "auto";
    this._systemTheme = this._getSystemTheme();
    this._mediaQuery = null;
  }
  connectedCallback() {
    this.render();
    this._setupSystemThemeListener();
    this._applyTheme();
    this._broadcastThemeChange();
  }
  disconnectedCallback() {
    if (this._mediaQuery) {
      this._mediaQuery.removeEventListener("change", this._handleSystemThemeChange);
    }
  }
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === "theme" && oldValue !== newValue) {
      this._theme = newValue || "auto";
      this._applyTheme();
      this._broadcastThemeChange();
    }
  }
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: none;
        }
      </style>
    `;
  }
  _getSystemTheme() {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  _setupSystemThemeListener() {
    if (typeof window === "undefined") return;
    this._mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this._handleSystemThemeChange = this._handleSystemThemeChange.bind(this);
    this._mediaQuery.addEventListener("change", this._handleSystemThemeChange);
  }
  _handleSystemThemeChange(e) {
    this._systemTheme = e.matches ? "dark" : "light";
    this._broadcast("theme.system-changed", {
      theme: this._systemTheme
    });
    if (this._theme === "auto") {
      this._applyTheme();
      this._broadcastThemeChange();
    }
  }
  _getEffectiveTheme() {
    if (this._theme === "auto") {
      return this._systemTheme;
    }
    return this._theme;
  }
  _applyTheme() {
    const effectiveTheme = this._getEffectiveTheme();
    document.documentElement.setAttribute("data-theme", effectiveTheme);
    document.documentElement.style.colorScheme = effectiveTheme;
  }
  _broadcastThemeChange() {
    this._broadcast("theme.changed", {
      theme: this._theme,
      effective: this._getEffectiveTheme()
    });
  }
  _broadcast(topic, data) {
    const bus = document.querySelector("pan-bus");
    if (bus) {
      bus.publish(topic, data);
    }
    this.dispatchEvent(new CustomEvent("theme-change", {
      bubbles: true,
      composed: true,
      detail: data
    }));
  }
  // Public API
  setTheme(theme) {
    if (["light", "dark", "auto"].includes(theme)) {
      this.setAttribute("theme", theme);
    }
  }
  getTheme() {
    return this._theme;
  }
  getEffectiveTheme() {
    return this._getEffectiveTheme();
  }
  getSystemTheme() {
    return this._systemTheme;
  }
}
customElements.define("pan-theme-provider", PanThemeProvider);
export {
  PanThemeProvider
};
//# sourceMappingURL=pan-theme-provider.js.map
