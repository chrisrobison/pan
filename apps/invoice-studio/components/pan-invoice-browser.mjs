/**
 * Invoice Browser Component
 *
 * Modal dialog for browsing, searching, and loading past invoices.
 */

import { PanClient } from '../../../src/components/pan-client.mjs';
import db from '../lib/invoice-db.mjs';

class PanInvoiceBrowser extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.invoices = [];
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.subscribeToMessages();
  }

  render() {
    this.innerHTML = `
      <div class="modal-overlay" style="display: none;">
        <div class="modal-dialog large">
          <div class="modal-header">
            <h2>📂 Invoice Browser</h2>
            <button class="btn-close" data-action="close">×</button>
          </div>

          <div class="modal-body">
            <!-- Search and Filter -->
            <div class="filter-bar">
              <input
                type="text"
                class="search-input"
                placeholder="Search by number, client, or amount..."
                data-field="search"
              />
              <select class="filter-select" data-field="sort">
                <option value="date-desc">Newest First</option>
                <option value="date-asc">Oldest First</option>
                <option value="number-desc">Number (High to Low)</option>
                <option value="number-asc">Number (Low to High)</option>
                <option value="total-desc">Amount (High to Low)</option>
                <option value="total-asc">Amount (Low to High)</option>
              </select>
            </div>

            <!-- Invoice Grid -->
            <div class="invoice-grid">
              <div class="loading-state">Loading invoices...</div>
            </div>
          </div>

          <div class="modal-footer">
            <div class="invoice-count">
              <span data-count="total">0</span> invoices
            </div>
            <button class="btn" data-action="close">Close</button>
          </div>
        </div>
      </div>

      <style>
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }

        .modal-dialog.large {
          background: white;
          border-radius: 12px;
          max-width: 1000px;
          width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }

        .modal-header {
          padding: 1.5rem;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h2 {
          font-size: 1.5rem;
          margin: 0;
          color: #333;
        }

        .btn-close {
          background: none;
          border: none;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          color: #666;
          padding: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .btn-close:hover {
          background: #f5f5f5;
          color: #333;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 1.5rem;
        }

        .filter-bar {
          display: flex;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }

        .search-input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          font-size: 1rem;
        }

        .search-input:focus {
          outline: none;
          border-color: #667eea;
        }

        .filter-select {
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 6px;
          background: white;
          font-size: 0.875rem;
          cursor: pointer;
        }

        .filter-select:focus {
          outline: none;
          border-color: #667eea;
        }

        .invoice-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1rem;
        }

        .loading-state {
          grid-column: 1 / -1;
          text-align: center;
          padding: 3rem;
          color: #666;
        }

        .invoice-card {
          background: white;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          padding: 1.25rem;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .invoice-card:hover {
          border-color: #667eea;
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
          transform: translateY(-2px);
        }

        .invoice-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .invoice-number {
          font-size: 1.125rem;
          font-weight: 700;
          color: #667eea;
        }

        .invoice-date {
          font-size: 0.75rem;
          color: #666;
          background: #f8f9fa;
          padding: 0.25rem 0.5rem;
          border-radius: 4px;
        }

        .invoice-client {
          font-weight: 600;
          color: #333;
          font-size: 0.875rem;
        }

        .invoice-company {
          color: #666;
          font-size: 0.75rem;
        }

        .invoice-total {
          font-size: 1.5rem;
          font-weight: 700;
          color: #333;
          margin-top: 0.5rem;
        }

        .invoice-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 0.75rem;
          border-top: 1px solid #e9ecef;
          font-size: 0.75rem;
          color: #666;
        }

        .invoice-actions {
          display: flex;
          gap: 0.5rem;
        }

        .btn-icon-sm {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 1.125rem;
          padding: 0.25rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-icon-sm:hover {
          opacity: 1;
        }

        .btn-icon-sm.delete {
          color: #dc3545;
        }

        .modal-footer {
          padding: 1rem 1.5rem;
          border-top: 1px solid #e0e0e0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .invoice-count {
          font-size: 0.875rem;
          color: #666;
          font-weight: 600;
        }

        .btn {
          padding: 0.5rem 1rem;
          border: 1px solid #ddd;
          background: white;
          color: #333;
          border-radius: 6px;
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
        }

        .btn:hover {
          background: #f5f5f5;
        }

        @media (max-width: 768px) {
          .modal-dialog.large {
            max-width: 100%;
            max-height: 100vh;
            border-radius: 0;
          }

          .invoice-grid {
            grid-template-columns: 1fr;
          }

          .filter-bar {
            flex-direction: column;
          }
        }
      </style>
    `;
  }

  attachEventListeners() {
    // Close modal
    this.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.hide());
    });

    // Click outside to close
    this.querySelector('.modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hide();
      }
    });

    // Search
    this.querySelector('[data-field="search"]')?.addEventListener('input', (e) => {
      this.filterInvoices(e.target.value);
    });

    // Sort
    this.querySelector('[data-field="sort"]')?.addEventListener('change', (e) => {
      this.sortInvoices(e.target.value);
    });
  }

  subscribeToMessages() {
    // Show browser
    this.client.subscribe('invoice.browser.show', () => {
      this.show();
    });

    // Refresh when invoice is saved
    this.client.subscribe('invoice.saved', () => {
      if (this.querySelector('.modal-overlay').style.display !== 'none') {
        this.loadInvoices();
      }
    });
  }

  async show() {
    await this.loadInvoices();
    this.querySelector('.modal-overlay').style.display = 'flex';
  }

  hide() {
    this.querySelector('.modal-overlay').style.display = 'none';
  }

  async loadInvoices() {
    try {
      this.invoices = await db.getAllInvoices();
      this.sortInvoices(this.querySelector('[data-field="sort"]')?.value || 'date-desc');
    } catch (err) {
      this.showError('Failed to load invoices: ' + err.message);
    }
  }

  renderInvoices(filtered = null) {
    const grid = this.querySelector('.invoice-grid');
    const invoices = filtered || this.invoices;

    // Update count
    this.querySelector('[data-count="total"]').textContent = invoices.length;

    if (invoices.length === 0) {
      grid.innerHTML = '<div class="loading-state">No invoices yet. Create your first invoice!</div>';
      return;
    }

    grid.innerHTML = invoices.map(invoice => {
      const total = invoice.totals?.total || 0;
      const date = invoice.date ? new Date(invoice.date).toLocaleDateString() : 'N/A';

      return `
        <div class="invoice-card" data-invoice-id="${invoice.id}">
          <div class="invoice-card-header">
            <div class="invoice-number">${this.escapeHtml(invoice.number || 'N/A')}</div>
            <div class="invoice-date">${date}</div>
          </div>

          <div class="invoice-client">
            ${this.escapeHtml(invoice.billTo?.name || 'No client')}
          </div>
          ${invoice.billTo?.company ? `
            <div class="invoice-company">${this.escapeHtml(invoice.billTo.company)}</div>
          ` : ''}

          <div class="invoice-total">
            $${this.formatCurrency(total)}
          </div>

          <div class="invoice-meta">
            <div>${invoice.items?.length || 0} items</div>
            <div class="invoice-actions">
              <button class="btn-icon-sm delete" data-action="delete" title="Delete invoice">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach event listeners
    grid.querySelectorAll('.invoice-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('[data-action="delete"]')) {
          const invoiceId = parseInt(card.dataset.invoiceId);
          this.loadInvoice(invoiceId);
        }
      });
    });

    grid.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = e.target.closest('.invoice-card');
        const invoiceId = parseInt(card.dataset.invoiceId);
        await this.deleteInvoice(invoiceId);
      });
    });
  }

  filterInvoices(query) {
    if (!query) {
      this.renderInvoices();
      return;
    }

    const lowerQuery = query.toLowerCase();
    const filtered = this.invoices.filter(invoice =>
      invoice.number?.toLowerCase().includes(lowerQuery) ||
      invoice.billTo?.name?.toLowerCase().includes(lowerQuery) ||
      invoice.billTo?.company?.toLowerCase().includes(lowerQuery) ||
      (invoice.totals?.total?.toString() || '').includes(query)
    );

    this.renderInvoices(filtered);
  }

  sortInvoices(sortBy) {
    const sorted = [...this.invoices];

    switch (sortBy) {
      case 'date-desc':
        sorted.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        break;
      case 'date-asc':
        sorted.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0));
        break;
      case 'number-desc':
        sorted.sort((a, b) => (b.number || '').localeCompare(a.number || ''));
        break;
      case 'number-asc':
        sorted.sort((a, b) => (a.number || '').localeCompare(b.number || ''));
        break;
      case 'total-desc':
        sorted.sort((a, b) => (b.totals?.total || 0) - (a.totals?.total || 0));
        break;
      case 'total-asc':
        sorted.sort((a, b) => (a.totals?.total || 0) - (b.totals?.total || 0));
        break;
    }

    this.invoices = sorted;
    this.renderInvoices();
  }

  async loadInvoice(invoiceId) {
    try {
      const invoice = await db.getInvoice(invoiceId);
      if (invoice) {
        this.client.publish({
          topic: 'invoice.load',
          data: { invoice }
        });
        this.hide();
      }
    } catch (err) {
      this.showError('Failed to load invoice: ' + err.message);
    }
  }

  async deleteInvoice(invoiceId) {
    if (!confirm('Delete this invoice? This cannot be undone.')) return;

    try {
      await db.deleteInvoice(invoiceId);
      await this.loadInvoices();
      this.showSuccess('Invoice deleted');
    } catch (err) {
      this.showError('Failed to delete invoice: ' + err.message);
    }
  }

  showSuccess(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'success', duration: 3000 }
    });
  }

  showError(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'error', duration: 5000 }
    });
  }

  formatCurrency(value) {
    return (value || 0).toFixed(2);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('pan-invoice-browser', PanInvoiceBrowser);

export default PanInvoiceBrowser;
