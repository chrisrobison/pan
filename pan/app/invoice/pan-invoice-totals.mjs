/**
 * pan-invoice-totals
 *
 * Displays invoice totals with automatic calculations.
 * Tax rate is editable inline.
 *
 * Features:
 * - Auto-updates from invoice items changes
 * - Editable tax rate
 * - Displays subtotal, tax, and total due
 * - Large, prominent total display
 * - Broadcasts total changes via PAN
 *
 * PAN Events (subscribed):
 * - invoice.totals.changed: { subtotal, items }
 *
 * PAN Events (published):
 * - invoice.total.calculated: { subtotal, tax, taxRate, total }
 *
 * Usage:
 *   <pan-invoice-totals></pan-invoice-totals>
 */

export class PanInvoiceTotals extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._subtotal = 0;
    this._taxRate = 0; // Default 0% tax
    this._tax = 0;
    this._total = 0;
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

        .totals-container {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.5rem;
          padding: 1.5rem;
          max-width: 400px;
          margin-left: auto;
        }

        .totals-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--color-border, #e2e8f0);
        }

        .totals-row:last-child {
          border-bottom: none;
        }

        .totals-label {
          font-weight: 500;
          color: var(--color-text, #1e293b);
        }

        .totals-value {
          font-family: var(--font-mono, monospace);
          color: var(--color-text, #1e293b);
        }

        .subtotal-row {
          font-size: 0.95rem;
        }

        .tax-row {
          font-size: 0.95rem;
        }

        .tax-rate-input {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tax-rate-input input {
          width: 60px;
          padding: 0.25rem 0.5rem;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.25rem;
          text-align: right;
          font-family: var(--font-mono, monospace);
          outline: none;
          transition: all 0.15s ease;
        }

        .tax-rate-input input:focus {
          border-color: var(--color-primary, #006699);
          background: var(--color-primary-soft, #e0f2fe);
        }

        .total-row {
          margin-top: 0.5rem;
          padding-top: 1rem;
          border-top: 2px solid var(--color-primary, #006699);
        }

        .total-row .totals-label {
          font-size: 1.25rem;
          font-weight: 700;
          color: var(--color-primary, #006699);
        }

        .total-row .totals-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--color-primary, #006699);
        }

        .notes-section {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 1px solid var(--color-border, #e2e8f0);
        }

        .notes-label {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--color-text-muted, #64748b);
          margin-bottom: 0.5rem;
        }

        .notes-value {
          padding: 0.75rem;
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.375rem;
          min-height: 80px;
          outline: none;
          color: var(--color-text, #1e293b);
          line-height: 1.6;
          transition: all 0.15s ease;
        }

        .notes-value:hover {
          background: var(--color-bg-alt, #f8fafc);
        }

        .notes-value:focus {
          border-color: var(--color-primary, #006699);
          background: var(--color-primary-soft, #e0f2fe);
        }

        .notes-value:empty:before {
          content: attr(data-placeholder);
          color: var(--color-text-subtle, #94a3b8);
          font-style: italic;
        }
      </style>

      <div class="totals-container">
        <div class="totals-row subtotal-row">
          <div class="totals-label">Subtotal</div>
          <div class="totals-value">${this._formatCurrency(this._subtotal)}</div>
        </div>

        <div class="totals-row tax-row">
          <div class="totals-label">
            <div class="tax-rate-input">
              <span>Tax</span>
              <input
                type="number"
                class="tax-rate-field"
                value="${this._taxRate}"
                min="0"
                max="100"
                step="0.1"
                aria-label="Tax rate"
              />
              <span>%</span>
            </div>
          </div>
          <div class="totals-value">${this._formatCurrency(this._tax)}</div>
        </div>

        <div class="totals-row total-row">
          <div class="totals-label">Total Due</div>
          <div class="totals-value">${this._formatCurrency(this._total)}</div>
        </div>

        <div class="notes-section">
          <div class="notes-label">Notes / Payment Terms</div>
          <div
            class="notes-value"
            contenteditable="true"
            data-placeholder="Add payment terms, notes, or thank you message..."
          ></div>
        </div>
      </div>
    `;
  }

  _setupEventListeners() {
    const taxInput = this.shadowRoot.querySelector('.tax-rate-field');
    const notesField = this.shadowRoot.querySelector('.notes-value');

    // Handle tax rate changes
    taxInput?.addEventListener('input', (e) => {
      this._taxRate = parseFloat(e.target.value) || 0;
      this._calculate();
      this._updateDisplay();
      this._broadcastChanges();
    });

    // Handle notes changes
    notesField?.addEventListener('blur', () => {
      this._broadcastChanges();
    });
  }

  _setupPanListeners() {
    const bus = document.querySelector('pan-bus');
    if (bus) {
      bus.subscribe('invoice.totals.changed', (data) => {
        this._subtotal = data.subtotal || 0;
        this._calculate();
        this._updateDisplay();
        this._broadcastChanges();
      });

      bus.subscribe('invoice.load', (data) => {
        if (data.totals) {
          this._subtotal = data.totals.subtotal || 0;
          this._taxRate = data.totals.taxRate || 0;
          this._calculate();
          this.render();
          this._setupEventListeners();

          if (data.totals.notes) {
            const notesField = this.shadowRoot.querySelector('.notes-value');
            if (notesField) {
              notesField.textContent = data.totals.notes;
            }
          }
        }
      });

      bus.subscribe('invoice.clear', () => {
        this.clear();
      });
    }
  }

  _calculate() {
    this._tax = this._subtotal * (this._taxRate / 100);
    this._total = this._subtotal + this._tax;
  }

  _updateDisplay() {
    const subtotalValue = this.shadowRoot.querySelector('.subtotal-row .totals-value');
    const taxValue = this.shadowRoot.querySelector('.tax-row .totals-value');
    const totalValue = this.shadowRoot.querySelector('.total-row .totals-value');

    if (subtotalValue) subtotalValue.textContent = this._formatCurrency(this._subtotal);
    if (taxValue) taxValue.textContent = this._formatCurrency(this._tax);
    if (totalValue) totalValue.textContent = this._formatCurrency(this._total);
  }

  _broadcastChanges() {
    const bus = document.querySelector('pan-bus');
    const notesField = this.shadowRoot.querySelector('.notes-value');
    const notes = notesField?.textContent.trim() || '';

    if (bus) {
      bus.publish('invoice.total.calculated', {
        subtotal: this._subtotal,
        tax: this._tax,
        taxRate: this._taxRate,
        total: this._total,
        notes
      });
    }
  }

  _formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  // Public API
  setSubtotal(subtotal) {
    this._subtotal = subtotal || 0;
    this._calculate();
    this._updateDisplay();
  }

  setTaxRate(rate) {
    this._taxRate = rate || 0;
    const taxInput = this.shadowRoot.querySelector('.tax-rate-field');
    if (taxInput) taxInput.value = this._taxRate;
    this._calculate();
    this._updateDisplay();
  }

  getTotals() {
    const notesField = this.shadowRoot.querySelector('.notes-value');
    return {
      subtotal: this._subtotal,
      tax: this._tax,
      taxRate: this._taxRate,
      total: this._total,
      notes: notesField?.textContent.trim() || ''
    };
  }

  clear() {
    this._subtotal = 0;
    this._taxRate = 0;
    this._tax = 0;
    this._total = 0;
    this.render();
    this._setupEventListeners();
  }
}

customElements.define('pan-invoice-totals', PanInvoiceTotals);
export default PanInvoiceTotals;
