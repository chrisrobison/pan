/**
 * pan-invoice-header
 *
 * Contenteditable invoice header with from/to customer information.
 * All fields are editable inline for a natural app-like experience.
 *
 * Features:
 * - Contenteditable from/to sections
 * - Invoice number and date
 * - Auto-save on blur
 * - Integrates with pan-contacts for customer selection
 * - Broadcasts changes via PAN
 *
 * PAN Events:
 * - invoice.header.changed: { from, to, invoiceNumber, invoiceDate, dueDate }
 *
 * Usage:
 *   <pan-invoice-header></pan-invoice-header>
 */

export class PanInvoiceHeader extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._data = {
      from: { name: '', address: '', city: '', phone: '', email: '' },
      to: { name: '', address: '', city: '', phone: '', email: '' },
      invoiceNumber: '',
      invoiceDate: this._formatDate(new Date()),
      dueDate: ''
    };
  }

  connectedCallback() {
    this.render();
    this._setupEventListeners();
    this._setupPanListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .header-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.5rem;
          padding: 1.5rem;
        }

        .section {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .section-title {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--color-text-muted, #64748b);
          margin-bottom: 0.5rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .field-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted, #64748b);
        }

        .field-value {
          padding: 0.5rem;
          border-radius: 0.25rem;
          outline: none;
          cursor: text;
          color: var(--color-text, #1e293b);
          min-height: 1.5rem;
          transition: background 0.15s ease;
        }

        .field-value:hover {
          background: var(--color-bg-alt, #f8fafc);
        }

        .field-value:focus {
          background: var(--color-primary-soft, #e0f2fe);
        }

        .field-value:empty:before {
          content: attr(data-placeholder);
          color: var(--color-text-subtle, #94a3b8);
          font-style: italic;
        }

        .field-value.large {
          font-size: 1.1rem;
          font-weight: 600;
        }

        .invoice-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border, #e2e8f0);
        }

        .contact-selector {
          margin-top: 0.5rem;
        }

        .select-contact-btn {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          color: var(--color-primary, #006699);
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }

        .select-contact-btn:hover {
          background: var(--color-primary-soft, #e0f2fe);
          border-color: var(--color-primary, #006699);
        }

        @media (max-width: 768px) {
          .header-container {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="header-container">
        <!-- From Section -->
        <div class="section">
          <div class="section-title">From</div>
          <div class="field">
            <div class="field-label">Name / Business</div>
            <div class="field-value large" contenteditable="true" data-field="from.name" data-placeholder="Your name or business name">${this._data.from.name}</div>
          </div>
          <div class="field">
            <div class="field-label">Address</div>
            <div class="field-value" contenteditable="true" data-field="from.address" data-placeholder="Street address">${this._data.from.address}</div>
          </div>
          <div class="field">
            <div class="field-label">City, State ZIP</div>
            <div class="field-value" contenteditable="true" data-field="from.city" data-placeholder="City, State ZIP">${this._data.from.city}</div>
          </div>
          <div class="field">
            <div class="field-label">Phone</div>
            <div class="field-value" contenteditable="true" data-field="from.phone" data-placeholder="(555) 555-5555">${this._data.from.phone}</div>
          </div>
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value" contenteditable="true" data-field="from.email" data-placeholder="email@example.com">${this._data.from.email}</div>
          </div>
        </div>

        <!-- To Section -->
        <div class="section">
          <div class="section-title">Bill To</div>
          <div class="field">
            <div class="field-label">Customer Name</div>
            <div class="field-value large" contenteditable="true" data-field="to.name" data-placeholder="Customer name or business">${this._data.to.name}</div>
          </div>
          <div class="field">
            <div class="field-label">Address</div>
            <div class="field-value" contenteditable="true" data-field="to.address" data-placeholder="Street address">${this._data.to.address}</div>
          </div>
          <div class="field">
            <div class="field-label">City, State ZIP</div>
            <div class="field-value" contenteditable="true" data-field="to.city" data-placeholder="City, State ZIP">${this._data.to.city}</div>
          </div>
          <div class="field">
            <div class="field-label">Phone</div>
            <div class="field-value" contenteditable="true" data-field="to.phone" data-placeholder="(555) 555-5555">${this._data.to.phone}</div>
          </div>
          <div class="field">
            <div class="field-label">Email</div>
            <div class="field-value" contenteditable="true" data-field="to.email" data-placeholder="email@example.com">${this._data.to.email}</div>
          </div>

          <div class="contact-selector">
            <button class="select-contact-btn" data-action="select-contact">
              📇 Select from Contacts
            </button>
          </div>

          <div class="invoice-meta">
            <div class="field">
              <div class="field-label">Invoice #</div>
              <div class="field-value" contenteditable="true" data-field="invoiceNumber" data-placeholder="INV-001">${this._data.invoiceNumber}</div>
            </div>
            <div class="field">
              <div class="field-label">Date</div>
              <div class="field-value" contenteditable="true" data-field="invoiceDate" data-placeholder="MM/DD/YYYY">${this._data.invoiceDate}</div>
            </div>
            <div class="field">
              <div class="field-label">Due Date</div>
              <div class="field-value" contenteditable="true" data-field="dueDate" data-placeholder="MM/DD/YYYY">${this._data.dueDate}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  _setupEventListeners() {
    const container = this.shadowRoot.querySelector('.header-container');

    // Handle contenteditable changes
    container.addEventListener('blur', (e) => {
      if (e.target.hasAttribute('contenteditable')) {
        this._handleFieldEdit(e.target);
      }
    }, true);

    // Handle Enter key
    container.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.hasAttribute('contenteditable')) {
        e.preventDefault();
        e.target.blur();
      }
    });

    // Handle select contact button
    const selectBtn = this.shadowRoot.querySelector('[data-action="select-contact"]');
    selectBtn?.addEventListener('click', () => {
      this._openContactSelector();
    });
  }

  _setupPanListeners() {
    const bus = document.querySelector('pan-bus');
    if (bus) {
      bus.subscribe('invoice.load', (data) => {
        if (data.header) {
          this.setData(data.header);
        }
      });

      bus.subscribe('invoice.clear', () => {
        this.clear();
      });

      bus.subscribe('contact.selected', (contact) => {
        this._fillFromContact(contact);
      });
    }
  }

  _handleFieldEdit(field) {
    const fieldPath = field.dataset.field;
    const value = field.textContent.trim();

    // Handle nested fields (e.g., "from.name")
    if (fieldPath.includes('.')) {
      const [section, key] = fieldPath.split('.');
      this._data[section][key] = value;
    } else {
      this._data[fieldPath] = value;
    }

    this._broadcastChanges();
  }

  _fillFromContact(contact) {
    this._data.to = {
      name: contact.name || '',
      address: contact.address || '',
      city: contact.city || '',
      phone: contact.phone || '',
      email: contact.email || ''
    };

    this.render();
    this._setupEventListeners();
    this._broadcastChanges();
  }

  _openContactSelector() {
    // Emit event to open contact selector modal
    const bus = document.querySelector('pan-bus');
    if (bus) {
      bus.publish('invoice.open-contact-selector', {});
    }

    // Also dispatch DOM event for non-PAN listeners
    this.dispatchEvent(new CustomEvent('select-contact', {
      bubbles: true,
      composed: true
    }));
  }

  _broadcastChanges() {
    const bus = document.querySelector('pan-bus');
    if (bus) {
      bus.publish('invoice.header.changed', this._data);
    }
  }

  _formatDate(date) {
    return new Intl.DateFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  // Public API
  setData(data) {
    this._data = {
      from: { ...this._data.from, ...data.from },
      to: { ...this._data.to, ...data.to },
      invoiceNumber: data.invoiceNumber || this._data.invoiceNumber,
      invoiceDate: data.invoiceDate || this._data.invoiceDate,
      dueDate: data.dueDate || this._data.dueDate
    };
    this.render();
    this._setupEventListeners();
  }

  getData() {
    return this._data;
  }

  clear() {
    this._data = {
      from: this._data.from, // Keep from data
      to: { name: '', address: '', city: '', phone: '', email: '' },
      invoiceNumber: '',
      invoiceDate: this._formatDate(new Date()),
      dueDate: ''
    };
    this.render();
    this._setupEventListeners();
  }
}

customElements.define('pan-invoice-header', PanInvoiceHeader);
export default PanInvoiceHeader;
