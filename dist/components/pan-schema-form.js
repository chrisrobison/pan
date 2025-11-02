import { PanClient } from "./pan-client.mjs";

/**
 * Dynamic form component that renders and validates based on JSON Schema definitions.
 *
 * This component listens for schema definitions and selected items from the Pan message bus,
 * then dynamically generates form fields with validation. It supports various input types
 * including text, number, boolean, select, and textarea fields, with live updates when data changes.
 *
 * @class PanSchemaForm
 * @extends HTMLElement
 * @fires Publishes to topic: `{resource}.item.save` when form is submitted
 * @fires Publishes to topic: `{resource}.item.delete` when delete button is clicked
 *
 * @example
 * <pan-schema-form resource="users" key="id" live="true"></pan-schema-form>
 */
class PanSchemaForm extends HTMLElement {
  /**
   * Defines which attributes trigger attributeChangedCallback when modified.
   * @returns {string[]} Array of observed attribute names
   */
  static get observedAttributes() {
    return ["resource", "key", "live"];
  }

  /**
   * Initializes the form with shadow DOM, PanClient connection, and empty state.
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    /** @type {PanClient} Pan message bus client instance */
    this.pc = new PanClient(this);
    /** @type {Object|null} The JSON Schema definition for this form */
    this.schema = null;
    /** @type {Object} Current form values */
    this.value = {};
    /** @type {Function[]} Array of unsubscribe functions for cleanup */
    this._offs = [];
    /** @type {Function|null} Unsubscribe function for live updates */
    this._offLive = null;
    /** @type {string|null} Currently selected item ID */
    this._selectedId = null;
  }
  /**
   * Called when element is added to the DOM. Renders the form and sets up event handlers.
   */
  connectedCallback() {
    this.render();
    this.#wire();
  }

  /**
   * Called when element is removed from the DOM. Cleans up all subscriptions.
   */
  disconnectedCallback() {
    this.#unsubAll();
  }

  /**
   * Called when observed attributes change. Re-renders and re-wires the form.
   */
  attributeChangedCallback() {
    this.render();
    this.#wire();
  }

  /**
   * Gets the resource name for this form (used in topic names).
   * @returns {string} The resource name, defaults to "items"
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Gets the key field name used to identify items (usually "id").
   * @returns {string} The key field name, defaults to "id"
   */
  get key() {
    return (this.getAttribute("key") || "id").trim();
  }

  /**
   * Gets whether live updates are enabled for this form.
   * @returns {boolean} True if live updates are enabled, false otherwise
   */
  get live() {
    const v = (this.getAttribute("live") || "true").toLowerCase();
    return v !== "false" && v !== "0";
  }
  /**
   * Sets up event subscriptions and handlers for the form.
   * Subscribes to schema state and item selection events, and wires up form submit and delete handlers.
   * @private
   */
  #wire() {
    this.#unsubAll();
    this._offs.push(this.pc.subscribe(`${this.resource}.schema.state`, (m) => {
      this.schema = m?.data?.schema || null;
      this.render();
    }, { retained: true }));
    this._offs.push(this.pc.subscribe(`${this.resource}.item.select`, async (m) => {
      const id = m?.data?.id;
      if (!id) return;
      this._selectedId = id;
      this.#subscribeLive();
      try {
        const { data } = await this.pc.request(`${this.resource}.item.get`, { id });
        this.#setValue(data?.item || {});
      } catch {
      }
    }));
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
   * Unsubscribes from all event subscriptions to prevent memory leaks.
   * @private
   */
  #unsubAll() {
    try {
      this._offs.forEach((f) => f && f());
    } catch {
    }
    this._offs = [];
    try {
      this._offLive && this._offLive();
    } catch {
    }
    this._offLive = null;
  }

  /**
   * Subscribes to live updates for the currently selected item if live mode is enabled.
   * Updates form values when the item changes on the server.
   * @private
   */
  #subscribeLive() {
    try {
      this._offLive && this._offLive();
    } catch {
    }
    this._offLive = null;
    if (!this.live) return;
    const id = this._selectedId || this.value?.[this.key] || this.value?.id;
    if (!id) return;
    const topic = `${this.resource}.item.state.${id}`;
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
    }, { retained: false });
  }
  /**
   * Saves the form data by collecting values, validating, and publishing to the message bus.
   * @private
   * @fires Publishes to topic: `{resource}.item.save` with collected item data
   */
  async #save() {
    const item = this.#collect();
    const errors = this.#validate(item);
    this.#showErrors(errors);
    if (errors && errors.length) return;
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
   * Deletes the current item by publishing a delete request to the message bus.
   * @private
   * @fires Publishes to topic: `{resource}.item.delete` with item ID
   */
  async #delete() {
    const id = this.value?.[this.key] || this.value?.id;
    if (!id) return;
    try {
      await this.pc.request(`${this.resource}.item.delete`, { id });
      this.#setValue({});
    } catch {
    }
  }

  /**
   * Collects form field values from the shadow DOM inputs and returns them as an object.
   * @private
   * @returns {Object} Object containing all form field values
   */
  #collect() {
    const v = Object.assign({}, this.value || {});
    const props = this.schema?.properties || {};
    const order = this.#fieldOrder();
    for (const name of order) {
      const input = this.shadowRoot.querySelector(`[name="${name}"]`);
      if (!input) continue;
      v[name] = this.#coerce(props[name], input);
    }
    return v;
  }

  /**
   * Coerces an input value to the correct type based on the schema property definition.
   * @private
   * @param {Object} prop - The schema property definition
   * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} input - The input element
   * @returns {*} The coerced value (boolean, number, or string)
   */
  #coerce(prop, input) {
    const t = prop && prop.type || "string";
    if (t === "boolean") return !!input.checked;
    if (t === "number" || t === "integer") {
      const n = Number(input.value);
      return Number.isFinite(n) ? t === "integer" ? Math.trunc(n) : n : void 0;
    }
    return input.value;
  }

  /**
   * Validates form values against the JSON Schema definition.
   * @private
   * @param {Object} v - The values to validate
   * @returns {Array<{name: string, message: string}>} Array of validation errors
   */
  #validate(v) {
    const errors = [];
    const props = this.schema?.properties || {};
    const required = Array.isArray(this.schema?.required) ? this.schema.required : [];
    for (const name of required) {
      const val = v[name];
      if (val === void 0 || val === null || val === "") errors.push({ name, message: "Required" });
    }
    for (const [name, prop] of Object.entries(props)) {
      const val = v[name];
      if (val == null || val === "") continue;
      const t = prop.type || "string";
      if (t === "number" || t === "integer") {
        if (typeof val !== "number" || !Number.isFinite(val)) errors.push({ name, message: "Must be a number" });
      }
      if (t === "boolean") {
        if (typeof val !== "boolean") errors.push({ name, message: "Must be true/false" });
      }
      if (prop.pattern && typeof val === "string") {
        try {
          const rx = new RegExp(prop.pattern);
          if (!rx.test(val)) errors.push({ name, message: "Invalid format" });
        } catch {
        }
      }
      if (prop.minLength != null && typeof val === "string" && val.length < prop.minLength) errors.push({ name, message: `Min length ${prop.minLength}` });
      if (prop.maxLength != null && typeof val === "string" && val.length > prop.maxLength) errors.push({ name, message: `Max length ${prop.maxLength}` });
      if (prop.minimum != null && typeof val === "number" && val < prop.minimum) errors.push({ name, message: `>= ${prop.minimum}` });
      if (prop.maximum != null && typeof val === "number" && val > prop.maximum) errors.push({ name, message: `<= ${prop.maximum}` });
      if (Array.isArray(prop.enum) && !prop.enum.includes(val)) errors.push({ name, message: "Invalid value" });
      if (prop.format === "email" && typeof val === "string") {
        const ok = /.+@.+\..+/.test(val);
        if (!ok) errors.push({ name, message: "Invalid email" });
      }
    }
    return errors;
  }
  /**
   * Displays validation errors in the form by updating error message elements.
   * @private
   * @param {Array<{name: string, message: string}>} errors - Array of validation errors
   */
  #showErrors(errors) {
    const map = new Map((errors || []).map((e) => [e.name, e.message]));
    this.shadowRoot.querySelectorAll(".err").forEach((el) => el.textContent = "");
    for (const [name, msg] of map) {
      const el = this.shadowRoot.querySelector(`.err[data-for="${name}"]`);
      if (el) el.textContent = msg;
    }
  }

  /**
   * Sets the form value and re-renders the form.
   * @private
   * @param {Object} v - The new form values
   */
  #setValue(v) {
    this.value = v || {};
    this.render();
    this.#wire();
  }

  /**
   * Determines the display order of form fields based on schema ui:order or uiOrder hint.
   * @private
   * @returns {string[]} Ordered array of field names
   */
  #fieldOrder() {
    const props = this.schema?.properties || {};
    const names = Object.keys(props);
    const ui = this.schema && (this.schema["ui:order"] || this.schema.uiOrder || null);
    if (Array.isArray(ui)) return names.sort((a, b) => (ui.indexOf(a) === -1 ? 1 : ui.indexOf(a)) - (ui.indexOf(b) === -1 ? 1 : ui.indexOf(b)));
    return names;
  }

  /**
   * Renders the form UI in the shadow DOM based on the current schema and values.
   * Creates form fields dynamically based on schema property types and constraints.
   */
  render() {
    const h = String.raw;
    const props = this.schema?.properties || {};
    const order = this.#fieldOrder();
    const v = this.value || {};
    const key = this.key;
    const rows = order.map((name) => {
      const prop = props[name] || {};
      const type = prop.type || "string";
      const title = prop.title || name;
      const hint = prop.description || "";
      const required = Array.isArray(this.schema?.required) && this.schema.required.includes(name);
      const val = v[name] ?? "";
      if (Array.isArray(prop.enum)) {
        return h`<label class="row"><span class="lab">${title}${required ? " *" : ""}</span>
          <select name="${name}">${prop.enum.map((opt) => `<option value="${String(opt)}" ${String(opt) === String(val) ? "selected" : ""}>${String(opt)}</option>`).join("")}</select>
          <small class="hint">${hint}</small><small class="err" data-for="${name}"></small></label>`;
      }
      if (type === "boolean") {
        return h`<label class="row chk"><input type="checkbox" name="${name}" ${val ? "checked" : ""}/><span>${title}</span><small class="hint">${hint}</small><small class="err" data-for="${name}"></small></label>`;
      }
      const inputType = type === "number" || type === "integer" ? "number" : prop.format === "email" ? "email" : "text";
      const isLong = prop.maxLength && prop.maxLength > 180 || prop.format === "multiline";
      if (isLong) {
        return h`<label class="row"><span class="lab">${title}${required ? " *" : ""}</span>
          <textarea name="${name}" rows="4">${this.#esc(val)}</textarea>
          <small class="hint">${hint}</small><small class="err" data-for="${name}"></small></label>`;
      }
      return h`<label class="row"><span class="lab">${title}${required ? " *" : ""}</span>
        <input type="${inputType}" name="${name}" value="${this.#esc(val)}" />
        <small class="hint">${hint}</small><small class="err" data-for="${name}"></small></label>`;
    }).join("");
    this.shadowRoot.innerHTML = h`
      <style>
        :host{display:block; border:1px solid #ddd; border-radius:8px; padding:12px; font:13px/1.4 system-ui, sans-serif}
        form{ display:grid; gap:10px }
        .row{ display:grid; gap:6px }
        .row.chk{ grid-template-columns: auto 1fr; align-items:center }
        .lab{ font-weight:600 }
        input,select,textarea,button{ padding:8px 10px; font:inherit }
        input,select,textarea{ border:1px solid #e2e2e2; border-radius:8px }
        .actions{ display:flex; gap:8px; align-items:center }
        .hint{ color:#888 }
        .err{ color:#c33 }
      </style>
      <form id="f">
        ${rows}
        <div class="actions">
          <button id="save" type="submit">Save</button>
          <span style="flex:1"></span>
          <button id="del" type="button">Delete</button>
        </div>
      </form>
    `;
    this.#subscribeLive();
  }
  /**
   * Escapes HTML special characters to prevent XSS attacks.
   * @private
   * @param {*} s - The string to escape
   * @returns {string} The escaped string
   */
  #esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
}
customElements.define("pan-schema-form", PanSchemaForm);
var pan_schema_form_default = PanSchemaForm;
export {
  PanSchemaForm,
  pan_schema_form_default as default
};
//# sourceMappingURL=pan-schema-form.js.map
