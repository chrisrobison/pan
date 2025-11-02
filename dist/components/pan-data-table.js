import { PanClient } from "./pan-client.mjs";

/**
 * Custom element that displays a data table with live updates from pan-bus.
 * Automatically subscribes to resource list and item state changes.
 *
 * @fires {resource}.item.select - Published when a row is clicked
 *
 * @attr {string} resource - Resource name for pub/sub topics (default: "items")
 * @attr {string} columns - Comma-separated column names to display
 * @attr {string} key - Property name used as unique identifier (default: "id")
 * @attr {string} live - Enable live updates: "true" or "false" (default: "true")
 *
 * @example
 * <pan-data-table
 *   resource="users"
 *   columns="id,name,email"
 *   key="id"
 *   live="true">
 * </pan-data-table>
 */
class PanDataTable extends HTMLElement {
  static get observedAttributes() {
    return ["resource", "columns", "key", "live"];
  }

  /**
   * Creates a new PanDataTable instance
   */
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.pc = new PanClient(this);
    /** @type {Array<Object>} */
    this.items = [];
    /** @type {Array<Function>} */
    this._offs = [];
  }
  /**
   * Lifecycle: Called when element is added to the DOM
   */
  connectedCallback() {
    this.render();
    this.#subscribe();
    this.#requestList();
  }

  /**
   * Lifecycle: Called when element is removed from the DOM
   */
  disconnectedCallback() {
    this._unsubscribeAll();
  }

  /**
   * Lifecycle: Called when an observed attribute changes
   */
  attributeChangedCallback() {
    this.render();
    this.#subscribe();
    this.#requestList();
  }

  /**
   * Get the resource name for pub/sub topics
   * @returns {string} Resource name
   */
  get resource() {
    return (this.getAttribute("resource") || "items").trim();
  }

  /**
   * Get the columns to display
   * @returns {string[]|null} Array of column names or null to auto-detect
   */
  get columns() {
    const c = (this.getAttribute("columns") || "").trim();
    return c ? c.split(/\s*,\s*/) : null;
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
   * Subscribe to list and item state topics
   * @private
   */
  #subscribe() {
    this._unsubscribeAll();
    this._offs.push(this.pc.subscribe(`${this.resource}.list.state`, (m) => {
      this.items = m?.data?.items || [];
      this.renderBody();
    }, { retained: true }));
    if (this.live) {
      this._offs.push(this.pc.subscribe(`${this.resource}.item.state.*`, (m) => this.#onItemState(m), { retained: false }));
    }
  }

  /**
   * Request the full list of items from the data source
   * @private
   */
  #requestList() {
    this.pc.publish({ topic: `${this.resource}.list.get`, data: {} });
  }

  /**
   * Unsubscribe from all active subscriptions
   * @private
   */
  _unsubscribeAll() {
    try {
      this._offs.forEach((f) => f && f());
    } catch {
    }
    this._offs = [];
  }
  /**
   * Handle item state change messages for live updates
   * @private
   * @param {Object} m - Message with item state changes
   */
  #onItemState(m) {
    const d = m?.data || {};
    const items = Array.isArray(this.items) ? this.items.slice() : [];
    const k = this.key;
    let id = d?.id ?? d?.item?.[k] ?? d?.item?.id;
    if (id == null && m?.topic) {
      const parts = String(m.topic).split(".");
      id = parts[parts.length - 1];
    }
    if (id == null) return;
    const idx = items.findIndex((x) => String(x?.[k] ?? x?.id) === String(id));
    if (d.deleted) {
      if (idx >= 0) {
        items.splice(idx, 1);
        this.items = items;
        this.renderBody();
      }
      return;
    }
    if (d.item && typeof d.item === "object") {
      if (idx >= 0) items[idx] = d.item;
      else items.push(d.item);
      this.items = items;
      this.renderBody();
      return;
    }
    if (d.patch && typeof d.patch === "object") {
      const base = idx >= 0 ? items[idx] : {};
      const next = Object.assign({}, base, d.patch);
      if (idx >= 0) items[idx] = next;
      else items.push(next);
      this.items = items;
      this.renderBody();
      return;
    }
    if (d && typeof d === "object") {
      const base = idx >= 0 ? items[idx] : {};
      const next = Object.assign({}, base, d);
      if (idx >= 0) items[idx] = next;
      else items.push(next);
      this.items = items;
      this.renderBody();
    }
  }

  /**
   * Render the table structure with shadow DOM styles
   */
  render() {
    const h = String.raw;
    const cols = this.columns || (this.items[0] ? Object.keys(this.items[0]) : []);
    this.shadowRoot.innerHTML = h`
      <style>
        :host{display:block; border:1px solid #ddd; border-radius:8px; overflow:hidden; font:13px/1.4 system-ui, sans-serif}
        table{width:100%; border-collapse:collapse}
        th,td{padding:8px 10px; border-bottom:1px solid #eee; text-align:left}
        tr:hover{ background:#fafafa; cursor:pointer }
        thead th{ background:#f6f6f6; font-weight:600 }
        .empty{ padding:10px; color:#888 }
      </style>
      <table>
        <thead><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr></thead>
        <tbody></tbody>
      </table>
      <div class="empty" id="empty" hidden>No records.</div>
    `;
    this.renderBody();
  }

  /**
   * Render table body rows with current items
   * Attaches click handlers to publish item.select events
   */
  renderBody() {
    const tbody = this.shadowRoot.querySelector("tbody");
    if (!tbody) return;
    const cols = this.columns || (this.items[0] ? Object.keys(this.items[0]) : []);
    tbody.innerHTML = this.items.map((it) => `<tr data-id="${it.id ?? it[this.getAttribute("key") || "id"]}">` + cols.map((c) => `<td>${this.#escape(it[c])}</td>`).join("") + `</tr>`).join("");
    const empty = this.shadowRoot.getElementById("empty");
    if (empty) empty.hidden = this.items.length > 0;
    tbody.querySelectorAll("tr").forEach((tr) => {
      tr.addEventListener("click", () => {
        const id = tr.getAttribute("data-id");
        this.pc.publish({ topic: `${this.resource}.item.select`, data: { id } });
      });
    });
  }

  /**
   * Escape HTML special characters to prevent XSS
   * @private
   * @param {*} v - Value to escape
   * @returns {string} Escaped string
   */
  #escape(v) {
    if (v == null) return "";
    return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }
}
customElements.define("pan-data-table", PanDataTable);
var pan_data_table_default = PanDataTable;
export {
  PanDataTable,
  pan_data_table_default as default
};
//# sourceMappingURL=pan-data-table.js.map
