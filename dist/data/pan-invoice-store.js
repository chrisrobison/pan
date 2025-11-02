/**
 * @fileoverview PanInvoiceStore - Invoice data management component
 * Provides persistent storage and state management for invoices
 * @module pan-invoice-store
 */

/**
 * @typedef {Object} InvoiceAddress
 * @property {string} name - Name of person/company
 * @property {string} address - Street address
 * @property {string} city - City, state, zip
 * @property {string} phone - Phone number
 * @property {string} email - Email address
 */

/**
 * @typedef {Object} InvoiceHeader
 * @property {InvoiceAddress} from - Sender information
 * @property {InvoiceAddress} to - Recipient information
 * @property {string} invoiceNumber - Invoice number
 * @property {string} invoiceDate - Invoice date
 * @property {string} dueDate - Due date
 */

/**
 * @typedef {Object} InvoiceItem
 * @property {string} description - Item description
 * @property {number} quantity - Item quantity
 * @property {number} rate - Item rate/price
 * @property {number} amount - Total amount (quantity * rate)
 */

/**
 * @typedef {Object} InvoiceTotals
 * @property {number} subtotal - Subtotal before tax
 * @property {number} tax - Tax amount
 * @property {number} taxRate - Tax rate percentage
 * @property {number} total - Total amount including tax
 * @property {string} notes - Additional notes
 */

/**
 * @typedef {Object} Invoice
 * @property {string} id - Unique invoice identifier
 * @property {string} created - ISO timestamp of creation
 * @property {string} modified - ISO timestamp of last modification
 * @property {InvoiceHeader} header - Invoice header information
 * @property {InvoiceItem[]} items - Invoice line items
 * @property {InvoiceTotals} totals - Invoice totals and calculations
 */

/**
 * PanInvoiceStore custom element - Manages invoice data persistence and state
 * Provides automatic saving, loading, import/export functionality
 * @class
 * @extends HTMLElement
 * @example
 * <pan-invoice-store auto-save="true"></pan-invoice-store>
 */
class PanInvoiceStore extends HTMLElement {
  /**
   * Observed attributes for this element
   * @type {string[]}
   * @static
   */
  static observedAttributes = ["auto-save"];
  /**
   * Creates a new PanInvoiceStore instance
   */
  constructor() {
    super();
    /**
     * Current invoice ID
     * @type {string|null}
     * @private
     */
    this._currentInvoiceId = null;
    /**
     * Current invoice data
     * @type {Invoice}
     * @private
     */
    this._currentInvoice = this._getEmptyInvoice();
    /**
     * Whether auto-save is enabled
     * @type {boolean}
     * @private
     */
    this._autoSave = true;
    /**
     * Timer for debounced save operations
     * @type {number|null}
     * @private
     */
    this._saveDebounceTimer = null;
    /**
     * LocalStorage key for invoice data
     * @type {string}
     * @private
     */
    this._storageKey = "pan-invoices";
  }
  /**
   * Called when element is connected to the DOM
   * Initializes PAN listeners and loads invoices
   */
  connectedCallback() {
    this._autoSave = this.hasAttribute("auto-save") ? this.getAttribute("auto-save") !== "false" : true;
    this._setupPanListeners();
    this._loadInvoicesList();
    const invoices = this._getAllInvoices();
    if (invoices.length > 0) {
      const lastId = localStorage.getItem("pan-invoice-last-id");
      const lastInvoice = invoices.find((inv) => inv.id === lastId) || invoices[0];
      this._loadInvoice(lastInvoice.id);
    } else {
      this._createNewInvoice();
    }
  }
  /**
   * Sets up PAN bus listeners for invoice events
   * @private
   */
  _setupPanListeners() {
    const bus = document.querySelector("pan-bus");
    if (!bus) return;
    bus.subscribe("invoice.header.changed", (data) => {
      this._currentInvoice.header = data;
      this._markModified();
      if (this._autoSave) this._debounceSave();
    });
    bus.subscribe("invoice.items.changed", (data) => {
      this._currentInvoice.items = data.items;
      this._markModified();
      if (this._autoSave) this._debounceSave();
    });
    bus.subscribe("invoice.total.calculated", (data) => {
      this._currentInvoice.totals = data;
      this._markModified();
      if (this._autoSave) this._debounceSave();
    });
    bus.subscribe("invoice.save", () => {
      this._saveCurrentInvoice();
    });
    bus.subscribe("invoice.load-by-id", (data) => {
      if (data.id) this._loadInvoice(data.id);
    });
    bus.subscribe("invoice.new", () => {
      this._createNewInvoice();
    });
    bus.subscribe("invoice.delete", (data) => {
      const id = data.id || this._currentInvoiceId;
      if (id) this._deleteInvoice(id);
    });
    bus.subscribe("invoice.export", () => {
      this._exportInvoice();
    });
    bus.subscribe("invoice.import", (data) => {
      if (data.json) this._importInvoice(data.json);
    });
    bus.subscribe("invoice.export-all", () => {
      this._exportAllInvoices();
    });
    bus.subscribe("invoice.clear", () => {
      this._currentInvoice = this._getEmptyInvoice();
      this._broadcastInvoice();
    });
  }
  /**
   * Creates and returns an empty invoice template
   * @returns {Invoice} A new empty invoice object
   * @private
   */
  _getEmptyInvoice() {
    return {
      id: this._generateId(),
      created: (/* @__PURE__ */ new Date()).toISOString(),
      modified: (/* @__PURE__ */ new Date()).toISOString(),
      header: {
        from: { name: "", address: "", city: "", phone: "", email: "" },
        to: { name: "", address: "", city: "", phone: "", email: "" },
        invoiceNumber: "",
        invoiceDate: new Intl.DateFormat("en-US").format(/* @__PURE__ */ new Date()),
        dueDate: ""
      },
      items: [],
      totals: {
        subtotal: 0,
        tax: 0,
        taxRate: 0,
        total: 0,
        notes: ""
      }
    };
  }
  /**
   * Creates a new invoice, saving the current one if modified
   * Copies sender info and tax rate from last invoice if available
   * @private
   */
  _createNewInvoice() {
    if (this._currentInvoice.modified) {
      this._saveCurrentInvoice();
    }
    this._currentInvoice = this._getEmptyInvoice();
    this._currentInvoiceId = this._currentInvoice.id;
    const invoices = this._getAllInvoices();
    if (invoices.length > 0) {
      const lastInvoice = invoices[invoices.length - 1];
      if (lastInvoice.header?.from) {
        this._currentInvoice.header.from = { ...lastInvoice.header.from };
      }
      if (lastInvoice.totals?.taxRate) {
        this._currentInvoice.totals.taxRate = lastInvoice.totals.taxRate;
      }
    }
    this._broadcastInvoice();
    this._broadcastInvoicesList();
    this._publishEvent("invoice.current-changed", {
      id: this._currentInvoiceId,
      invoice: this._currentInvoice
    });
  }
  /**
   * Loads an invoice by ID and makes it the current invoice
   * @param {string} id - The invoice ID to load
   * @private
   */
  _loadInvoice(id) {
    const invoices = this._getAllInvoices();
    const invoice = invoices.find((inv) => inv.id === id);
    if (invoice) {
      this._currentInvoice = invoice;
      this._currentInvoiceId = id;
      localStorage.setItem("pan-invoice-last-id", id);
      this._broadcastInvoice();
      this._publishEvent("invoice.current-changed", {
        id: this._currentInvoiceId,
        invoice: this._currentInvoice
      });
    }
  }
  /**
   * Saves the current invoice to localStorage
   * @private
   */
  _saveCurrentInvoice() {
    const invoices = this._getAllInvoices();
    const existingIndex = invoices.findIndex((inv) => inv.id === this._currentInvoiceId);
    this._currentInvoice.modified = (/* @__PURE__ */ new Date()).toISOString();
    if (existingIndex >= 0) {
      invoices[existingIndex] = this._currentInvoice;
    } else {
      invoices.push(this._currentInvoice);
    }
    this._saveAllInvoices(invoices);
    this._broadcastInvoicesList();
    this._publishEvent("invoice.saved", {
      id: this._currentInvoiceId,
      timestamp: this._currentInvoice.modified
    });
  }
  /**
   * Deletes an invoice by ID after confirmation
   * @param {string} id - The invoice ID to delete
   * @private
   */
  _deleteInvoice(id) {
    if (!confirm("Are you sure you want to delete this invoice?")) {
      return;
    }
    const invoices = this._getAllInvoices();
    const filtered = invoices.filter((inv) => inv.id !== id);
    this._saveAllInvoices(filtered);
    if (id === this._currentInvoiceId) {
      if (filtered.length > 0) {
        this._loadInvoice(filtered[0].id);
      } else {
        this._createNewInvoice();
      }
    }
    this._broadcastInvoicesList();
  }
  /**
   * Exports the current invoice as a JSON file
   * @private
   */
  _exportInvoice() {
    const json = JSON.stringify(this._currentInvoice, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${this._currentInvoice.header.invoiceNumber || this._currentInvoiceId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  /**
   * Exports all invoices as a JSON file
   * @private
   */
  _exportAllInvoices() {
    const invoices = this._getAllInvoices();
    const json = JSON.stringify(invoices, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-invoices-${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  /**
   * Imports invoice(s) from JSON data
   * @param {string|Invoice|Invoice[]} json - JSON string or parsed invoice data
   * @private
   */
  _importInvoice(json) {
    try {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      if (Array.isArray(data)) {
        const invoices = this._getAllInvoices();
        data.forEach((invoice) => {
          invoice.id = invoice.id || this._generateId();
          const existingIndex = invoices.findIndex((inv) => inv.id === invoice.id);
          if (existingIndex >= 0) {
            invoices[existingIndex] = invoice;
          } else {
            invoices.push(invoice);
          }
        });
        this._saveAllInvoices(invoices);
        this._loadInvoice(data[0].id);
      } else {
        data.id = data.id || this._generateId();
        const invoices = this._getAllInvoices();
        invoices.push(data);
        this._saveAllInvoices(invoices);
        this._loadInvoice(data.id);
      }
      this._broadcastInvoicesList();
    } catch (error) {
      console.error("Failed to import invoice:", error);
      this._publishEvent("invoice.error", { message: "Failed to import invoice", error });
    }
  }
  /**
   * Broadcasts the current invoice to all subscribers
   * @private
   */
  _broadcastInvoice() {
    const bus = document.querySelector("pan-bus");
    if (bus) {
      bus.publish("invoice.load", this._currentInvoice);
    }
  }
  /**
   * Broadcasts the list of all invoices to subscribers
   * @private
   */
  _broadcastInvoicesList() {
    const invoices = this._getAllInvoices();
    const list = invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.header?.invoiceNumber || "Untitled",
      customerName: inv.header?.to?.name || "No customer",
      date: inv.header?.invoiceDate || inv.created,
      total: inv.totals?.total || 0,
      created: inv.created,
      modified: inv.modified
    }));
    this._publishEvent("invoice.list-updated", { invoices: list });
  }
  /**
   * Loads and broadcasts the invoices list
   * @private
   */
  _loadInvoicesList() {
    this._broadcastInvoicesList();
  }
  /**
   * Marks the current invoice as modified
   * @private
   */
  _markModified() {
    this._currentInvoice.modified = (/* @__PURE__ */ new Date()).toISOString();
  }
  /**
   * Debounces save operations to prevent excessive writes
   * @private
   */
  _debounceSave() {
    clearTimeout(this._saveDebounceTimer);
    this._saveDebounceTimer = setTimeout(() => {
      this._saveCurrentInvoice();
    }, 1e3);
  }
  /**
   * Gets all invoices from localStorage
   * @returns {Invoice[]} Array of all stored invoices
   * @private
   */
  _getAllInvoices() {
    try {
      const data = localStorage.getItem(this._storageKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load invoices:", error);
      return [];
    }
  }
  /**
   * Saves all invoices to localStorage
   * @param {Invoice[]} invoices - Array of invoices to save
   * @private
   */
  _saveAllInvoices(invoices) {
    try {
      localStorage.setItem(this._storageKey, JSON.stringify(invoices));
    } catch (error) {
      console.error("Failed to save invoices:", error);
      this._publishEvent("invoice.error", { message: "Failed to save to localStorage", error });
    }
  }
  /**
   * Generates a unique invoice ID
   * @returns {string} Unique invoice identifier
   * @private
   */
  _generateId() {
    return `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Publishes an event to the PAN bus
   * @param {string} topic - The event topic
   * @param {*} data - The event data
   * @private
   */
  _publishEvent(topic, data) {
    const bus = document.querySelector("pan-bus");
    if (bus) {
      bus.publish(topic, data);
    }
  }
  // Public API
  /**
   * Gets the current invoice
   * @returns {Invoice} The current invoice object
   * @public
   */
  getCurrentInvoice() {
    return this._currentInvoice;
  }
  /**
   * Gets all stored invoices
   * @returns {Invoice[]} Array of all invoices
   * @public
   */
  getAllInvoices() {
    return this._getAllInvoices();
  }
  /**
   * Saves the current invoice immediately
   * @public
   */
  save() {
    this._saveCurrentInvoice();
  }
  /**
   * Loads an invoice by ID
   * @param {string} id - The invoice ID to load
   * @public
   */
  load(id) {
    this._loadInvoice(id);
  }
  /**
   * Creates a new invoice
   * @public
   */
  createNew() {
    this._createNewInvoice();
  }
}
customElements.define("pan-invoice-store", PanInvoiceStore);
var pan_invoice_store_default = PanInvoiceStore;
export {
  PanInvoiceStore,
  pan_invoice_store_default as default
};
//# sourceMappingURL=pan-invoice-store.js.map
