import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that displays an editable form with live updates from pan-bus.
 * Automatically subscribes to item selection and state changes.
 *
 * @fires {resource}.item.save - Published when form is submitted
 * @fires {resource}.item.delete - Published when delete button is clicked
 * @fires {resource}.item.get - Requested when item is selected
 *
 * @attr {string} resource - Resource name for pub/sub topics (default: "items")
 * @attr {string} fields - Comma-separated field names to display in form
 * @attr {string} key - Property name used as unique identifier (default: "id")
 * @attr {string} live - Enable live updates: "true" or "false" (default: "true")
 *
 * @example
 * <pan-form
 *   resource="users"
 *   fields="name,email,age"
 *   key="id"
 *   live="true">
 * </pan-form>
 */
class PanForm extends HTMLElement {
  static get observedAttributes() {
    return ["resource", "fields", "key", "live"];
  }

  /**
   * Creates a new PanForm instance
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.pc = new PanClient(this);
    /** @type {Object} */
    this.value = {};
    /** @type {Function|null} */
    this._offSel = null;
    /** @type {Function|null} */
    this._offLive = null;
    /** @type {*} */
    this._selectedId = null;
    /** @type {string|null} */
    this._liveTopic = null;
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   */
  connectedCallback() {
    this.render();
    this.#wire();
  }

  /**
   * Lifecycle: Called when element is removed from the DOM
   */
  disconnectedCallback() {
    this._unsubAll();
  }

  /**
   * Lifecycle: Called when an observed attribute changes
   */
  attributeChangedCallback() {
    this.render();
    this.#wire();
  }

  /**
   * Get the resource name for pub/sub topics
   * @returns {string} Resource name
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Get the fields to display in form
   * @returns {string[]} Array of field names
   */
  get fields() {
    const f = (this.getAttribute("fields") || "").trim();
    return f ? f.split(/\s*,\s*/) : [];
  }

  /**
   * Get the unique identifier property name
   * @returns {string} Key property name
   */
  get key() {
    return (this.getAttribute("key") || "id").trim();
  }

  /**
   * Check if live updates are enabled
   * @returns {boolean} True if live updates enabled
   */
  get live() {
    const v = (this.getAttribute("live") || "true").toLowerCase();
    return v !== "false" && v !== "0";
  }
  /**
   * Wire up event handlers and subscriptions
   * @private
   */
  #wire() {
    this._unsubAll();
    this._offSel = this.pc.subscribe(`${this.resource}.item.select`, async (m) => {
      const id = m?.data?.id;
      if (!id) return;
      this._selectedId = id;
      this.#subscribeLive();
      try {
        const { data } = await this.pc.request(`${this.resource}.item.get`, { id });
        this.#setValue(data?.item || {});
      } catch {
      }
    });
    const form = this.shadowRoot.getElementById("f");
    if (form) form.onsubmit = (e) => {
      e.preventDefault();
      this.#save();
    };
    const del = this.shadowRoot.getElementById("del");
    if (del) del.onclick = (e) => {
      e.preventDefault();
      this.#delete();
    };
  }

  /**
   * Unsubscribe from all active subscriptions
   * @private
   */
  _unsubAll() {
    try {
      this._offSel && this._offSel();
    } catch {
    }
    this._offSel = null;
    try {
      this._offLive && this._offLive();
    } catch {
    }
    this._offLive = null;
    this._liveTopic = null;
  }
  /**
   * Subscribe to live updates for current item
   * @private
   */
  #subscribeLive() {
    if (!this.live) return;
    const id = this._selectedId || this.value?.[this.key] || this.value?.id;
    if (!id) return;
    const topic = `${this.resource}.item.state.${id}`;
    if (this._liveTopic === topic && this._offLive) return;
    try {
      this._offLive && this._offLive();
    } catch {
    }
    this._offLive = null;
    this._liveTopic = topic;
    this._offLive = this.pc.subscribe(topic, (m) => {
      const d = m?.data || {};
      if (d.deleted) {
        const cur = this.value?.[this.key] || this.value?.id;
        if (String(cur) === String(id)) this.#setValue({});
        return;
      }
      if (d.item && typeof d.item === "object") {
        this.#setValue(d.item);
        return;
      }
      if (d.patch && typeof d.patch === "object") {
        this.#setValue(Object.assign({}, this.value || {}, d.patch));
        return;
      }
      if (d && typeof d === "object") {
        this.#setValue(Object.assign({}, this.value || {}, d));
      }
    }, { retained: true });
  }

  /**
   * Save current form values
   * @private
   */
  async #save() {
    const item = this.#collect();
    try {
      const { data } = await this.pc.request(`${this.resource}.item.save`, { item });
      const saved = data?.item || item;
      this.#setValue(saved);
      this._selectedId = saved?.[this.key] || saved?.id || this._selectedId;
      this.#subscribeLive();
    } catch {
    }
  }

  /**
   * Delete current item
   * @private
   */
  async #delete() {
    const id = this.value?.id || this.value?.[this.key];
    if (!id) return;
    try {
      await this.pc.request(`${this.resource}.item.delete`, { id });
      this.#setValue({});
    } catch {
    }
  }

  /**
   * Collect form values into object
   * @private
   * @returns {Object} Object with form field values
   */
  #collect() {
    const out = Object.assign({}, this.value);
    for (const name of this.fields) {
      const input = this.shadowRoot.querySelector(`[name="${name}"]`);
      if (!input) continue;
      const v = input.value;
      out[name] = v;
    }
    return out;
  }

  /**
   * Set form value and re-render
   * @private
   * @param {Object} v - New value object
   */
  #setValue(v) {
    this.value = v || {};
    this.render();
    this.#wire();
  }

  /**
   * Render form with shadow DOM styles
   */
  render() {
    const h = String.raw;
    const v = this.value || {};
    this.shadowRoot.innerHTML = h`
      <style>
        :host{display:block; border:1px solid #ddd; border-radius:8px; padding:12px; font:13px/1.4 system-ui, sans-serif}
        form{ display:grid; gap:8px }
        label{ display:grid; gap:4px }
        input,button{ padding:8px 10px }
        .row{ display:flex; gap:8px; align-items:center }
        .spacer{ flex:1 }
      </style>
      <form id="f">
        ${this.fields.map((name) => `
          <label>
            <span>${name}</span>
            <input name="${name}" value="${this.#escape(v[name] ?? "")}" />
          </label>`).join("")}
        <div class="row">
          <button id="save" type="submit">Save</button>
          <span class="spacer"></span>
          <button id="del" type="button">Delete</button>
        </div>
      </form>
    `;
    this.#subscribeLive();
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @private
   * @param {*} s - Value to escape
   * @returns {string} Escaped string
   */
  #escape(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
}
customElements.define("pan-form", PanForm);
var pan_form_default = PanForm;
export {
  PanForm,
  pan_form_default as default
};
//# sourceMappingURL=pan-form.js.map
