/**
 * Invoice Toolbar Component
 *
 * Provides action buttons for invoice operations:
 * - New invoice
 * - Save invoice
 * - Browse invoices
 * - Print
 * - Export PDF
 * - Import/Export data
 */

import { PanClient } from '../../../src/components/pan-client.mjs';

class PanInvoiceToolbar extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.subscribeToMessages();
  }

  render() {
    this.innerHTML = `
      <div class="invoice-toolbar">
        <div class="toolbar-section">
          <button class="btn btn-primary" data-action="new">
            ➕ New
          </button>
          <button class="btn btn-primary" data-action="save">
            💾 Save
          </button>
          <button class="btn" data-action="browse">
            📂 Browse
          </button>
        </div>

        <div class="toolbar-section">
          <button class="btn" data-action="contacts">
            👥 Contacts
          </button>
          <button class="btn" data-action="print">
            🖨️ Print
          </button>
          <button class="btn" data-action="pdf">
            📄 PDF
          </button>
        </div>

        <div class="toolbar-section">
          <button class="btn btn-secondary" data-action="import">
            📥 Import
          </button>
          <button class="btn btn-secondary" data-action="export">
            📤 Export
          </button>
        </div>

        <input type="file" id="import-file" accept=".json" style="display: none;">
      </div>

      <style>
        .invoice-toolbar {
          background: white;
          padding: 1rem;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          margin-bottom: 2rem;
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .toolbar-section {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .toolbar-section:not(:last-child)::after {
          content: '';
          width: 1px;
          height: 24px;
          background: #e0e0e0;
          margin-left: 0.5rem;
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
          white-space: nowrap;
        }

        .btn:hover {
          background: #f5f5f5;
          border-color: #ccc;
          transform: translateY(-1px);
        }

        .btn:active {
          transform: translateY(0);
        }

        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-color: transparent;
        }

        .btn-primary:hover {
          opacity: 0.9;
          background: linear-gradient(135deg, #5568d3 0%, #6a3f91 100%);
        }

        .btn-secondary {
          background: #f8f9fa;
          border-color: #dee2e6;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        @media (max-width: 768px) {
          .invoice-toolbar {
            padding: 0.75rem;
          }

          .toolbar-section::after {
            display: none;
          }

          .btn {
            padding: 0.4rem 0.75rem;
            font-size: 0.8125rem;
          }
        }

        @media (max-width: 480px) {
          .invoice-toolbar {
            flex-direction: column;
          }

          .toolbar-section {
            width: 100%;
            justify-content: space-between;
          }

          .btn {
            flex: 1;
            min-width: 0;
          }
        }
      </style>
    `;
  }

  attachEventListeners() {
    // Button clicks
    this.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        this.handleAction(action);
      });
    });

    // Import file input
    const importInput = this.querySelector('#import-file');
    importInput?.addEventListener('change', (e) => {
      this.handleImport(e.target.files[0]);
    });
  }

  subscribeToMessages() {
    // Listen for invoice save confirmation
    this.client.subscribe('invoice.saved', (msg) => {
      this.showToast('Invoice saved successfully!', 'success');
    });

    // Listen for errors
    this.client.subscribe('invoice.error', (msg) => {
      this.showToast(msg.data.message || 'An error occurred', 'error');
    });
  }

  handleAction(action) {
    switch (action) {
      case 'new':
        this.newInvoice();
        break;
      case 'save':
        this.saveInvoice();
        break;
      case 'browse':
        this.browseInvoices();
        break;
      case 'contacts':
        this.openContacts();
        break;
      case 'print':
        this.printInvoice();
        break;
      case 'pdf':
        this.exportPDF();
        break;
      case 'import':
        this.querySelector('#import-file').click();
        break;
      case 'export':
        this.exportData();
        break;
    }
  }

  newInvoice() {
    if (confirm('Create a new invoice? Any unsaved changes will be lost.')) {
      this.client.publish({
        topic: 'invoice.new',
        data: {}
      });
    }
  }

  saveInvoice() {
    this.client.publish({
      topic: 'invoice.save',
      data: {}
    });
  }

  browseInvoices() {
    this.client.publish({
      topic: 'invoice.browser.show',
      data: {}
    });
  }

  openContacts() {
    this.client.publish({
      topic: 'contacts.manager.show',
      data: {}
    });
  }

  printInvoice() {
    window.print();
  }

  async exportPDF() {
    this.client.publish({
      topic: 'invoice.export.pdf',
      data: {}
    });
  }

  async exportData() {
    this.client.publish({
      topic: 'invoice.data.export',
      data: {}
    });
  }

  async handleImport(file) {
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      this.client.publish({
        topic: 'invoice.data.import',
        data: data
      });

      this.showToast('Data imported successfully!', 'success');
    } catch (err) {
      this.showToast('Failed to import data: ' + err.message, 'error');
    }
  }

  showToast(message, type = 'info') {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type, duration: 3000 }
    });
  }
}

customElements.define('pan-invoice-toolbar', PanInvoiceToolbar);

export default PanInvoiceToolbar;
