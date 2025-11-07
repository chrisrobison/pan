/**
 * Invoice Line Items Component
 *
 * Editable table for invoice line items with auto-calculations.
 * Calculates subtotal, tax, and total automatically.
 */

import { PanClient } from '../../../src/components/pan-client.mjs';

class PanInvoiceLineItems extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.items = [];
    this.taxRate = 0.08; // 8% default tax rate
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.subscribeToMessages();
    this.addInitialRows();
  }

  render() {
    this.innerHTML = `
      <div class="line-items-section">
        <h3>Items</h3>

        <table class="line-items-table">
          <thead>
            <tr>
              <th>Description</th>
              <th class="number-col">Quantity</th>
              <th class="number-col">Rate</th>
              <th class="number-col">Amount</th>
              <th class="actions-col"></th>
            </tr>
          </thead>
          <tbody class="items-body">
            <!-- Items will be inserted here -->
          </tbody>
        </table>

        <button class="btn-add-item" data-action="add-row">+ Add Item</button>

        <div class="totals-section">
          <div class="totals-row">
            <span class="totals-label">Subtotal:</span>
            <span class="totals-value" data-total="subtotal">$0.00</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">
              Tax (<span contenteditable="true" data-field="taxRate" class="tax-rate-input">8</span>%):
            </span>
            <span class="totals-value" data-total="tax">$0.00</span>
          </div>
          <div class="totals-row total">
            <span class="totals-label">Total:</span>
            <span class="totals-value" data-total="total">$0.00</span>
          </div>
        </div>
      </div>

      <style>
        .line-items-section {
          margin: 2rem 0;
        }

        .line-items-section h3 {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 1rem;
        }

        .line-items-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 1rem;
        }

        .line-items-table th {
          background: #f8f9fa;
          padding: 0.75rem;
          text-align: left;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          border-bottom: 2px solid #dee2e6;
        }

        .line-items-table th.number-col {
          text-align: right;
          width: 100px;
        }

        .line-items-table th.actions-col {
          width: 40px;
        }

        .line-items-table td {
          padding: 0.75rem;
          border-bottom: 1px solid #e9ecef;
        }

        .line-items-table td.number-col {
          text-align: right;
        }

        .line-items-table td.actions-col {
          text-align: center;
        }

        .item-field {
          border: none;
          border-bottom: 1px dotted #ccc;
          padding: 0.25rem;
          width: 100%;
          background: transparent;
          outline: none;
          transition: all 0.2s;
        }

        .item-field:hover {
          border-bottom-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
        }

        .item-field:focus {
          border-bottom-color: #667eea;
          background: rgba(102, 126, 234, 0.08);
        }

        .item-field::placeholder {
          color: #999;
          font-style: italic;
        }

        .item-field.number {
          text-align: right;
        }

        .item-amount {
          font-weight: 600;
          color: #333;
        }

        .btn-delete {
          background: none;
          border: none;
          color: #dc3545;
          cursor: pointer;
          font-size: 1.25rem;
          padding: 0.25rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-delete:hover {
          opacity: 1;
        }

        .btn-add-item {
          background: #f8f9fa;
          border: 1px dashed #dee2e6;
          padding: 0.75rem 1rem;
          border-radius: 6px;
          cursor: pointer;
          width: 100%;
          color: #667eea;
          font-weight: 600;
          transition: all 0.2s;
        }

        .btn-add-item:hover {
          background: #e9ecef;
          border-color: #667eea;
        }

        .totals-section {
          margin-top: 2rem;
          padding: 1.5rem;
          background: #f8f9fa;
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.75rem;
        }

        .totals-row {
          display: flex;
          gap: 2rem;
          align-items: center;
          min-width: 300px;
          justify-content: space-between;
        }

        .totals-row.total {
          border-top: 2px solid #dee2e6;
          padding-top: 0.75rem;
          font-size: 1.25rem;
          font-weight: 700;
        }

        .totals-label {
          color: #666;
        }

        .totals-value {
          font-weight: 600;
          color: #333;
          min-width: 100px;
          text-align: right;
        }

        .tax-rate-input {
          display: inline-block;
          min-width: 30px;
          border-bottom: 1px dotted #ccc;
          padding: 0 0.25rem;
          outline: none;
        }

        .tax-rate-input:hover,
        .tax-rate-input:focus {
          border-bottom-color: #667eea;
          background: rgba(102, 126, 234, 0.08);
        }

        @media print {
          .btn-add-item,
          .btn-delete {
            display: none;
          }

          .item-field {
            border: none;
          }

          .tax-rate-input {
            border: none;
          }
        }

        @media (max-width: 768px) {
          .line-items-table {
            font-size: 0.875rem;
          }

          .line-items-table th,
          .line-items-table td {
            padding: 0.5rem;
          }

          .totals-row {
            min-width: 100%;
          }
        }

        @media (max-width: 480px) {
          .line-items-table {
            display: block;
            overflow-x: auto;
          }

          .totals-section {
            padding: 1rem;
          }

          .totals-row {
            font-size: 0.875rem;
          }

          .totals-row.total {
            font-size: 1.1rem;
          }
        }
      </style>
    `;
  }

  attachEventListeners() {
    // Add row button
    this.querySelector('[data-action="add-row"]')?.addEventListener('click', () => {
      this.addRow();
    });

    // Tax rate change
    this.querySelector('[data-field="taxRate"]')?.addEventListener('input', (e) => {
      this.taxRate = parseFloat(e.target.textContent) / 100 || 0;
      this.calculate();
    });
  }

  subscribeToMessages() {
    // Clear items
    this.client.subscribe('invoice.items.clear', () => {
      this.items = [];
      this.refreshTable();
      this.addInitialRows();
    });

    // Load items
    this.client.subscribe('invoice.items.load', (msg) => {
      this.items = msg.data.items || [];
      this.refreshTable();
      if (this.items.length === 0) {
        this.addInitialRows();
      }
    });

    // Listen for invoice state requests
    this.client.subscribe('invoice.state', (msg) => {
      // When invoice state is published, add our items and totals
      const invoice = msg.data;
      invoice.items = this.items;
      invoice.totals = this.getTotals();
    });
  }

  addInitialRows() {
    // Add 3 empty rows by default
    for (let i = 0; i < 3; i++) {
      this.addRow();
    }
  }

  addRow(item = null) {
    const row = {
      id: item?.id || Date.now() + Math.random(),
      description: item?.description || '',
      quantity: item?.quantity || 1,
      rate: item?.rate || 0,
      amount: item?.amount || 0
    };

    this.items.push(row);
    this.renderRow(row);
    this.calculate();
  }

  renderRow(item) {
    const tbody = this.querySelector('.items-body');
    const tr = document.createElement('tr');
    tr.dataset.itemId = item.id;

    tr.innerHTML = `
      <td>
        <input
          type="text"
          class="item-field"
          data-field="description"
          placeholder="Description of service or product"
          value="${item.description || ''}"
        />
      </td>
      <td class="number-col">
        <input
          type="number"
          class="item-field number"
          data-field="quantity"
          placeholder="1"
          value="${item.quantity || 1}"
          min="0"
          step="0.01"
        />
      </td>
      <td class="number-col">
        <input
          type="number"
          class="item-field number"
          data-field="rate"
          placeholder="0.00"
          value="${item.rate || 0}"
          min="0"
          step="0.01"
        />
      </td>
      <td class="number-col item-amount" data-field="amount">
        $${this.formatCurrency(item.amount)}
      </td>
      <td class="actions-col">
        <button class="btn-delete" data-action="delete" title="Delete item">×</button>
      </td>
    `;

    tbody.appendChild(tr);

    // Attach event listeners to fields
    tr.querySelectorAll('.item-field').forEach(field => {
      field.addEventListener('input', (e) => {
        this.updateItem(item.id, e.target.dataset.field, e.target.value);
      });
    });

    // Delete button
    tr.querySelector('[data-action="delete"]')?.addEventListener('click', () => {
      this.deleteItem(item.id);
    });
  }

  updateItem(itemId, field, value) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return;

    item[field] = field === 'description' ? value : parseFloat(value) || 0;

    // Recalculate amount
    item.amount = item.quantity * item.rate;

    // Update amount display
    const row = this.querySelector(`tr[data-item-id="${itemId}"]`);
    const amountCell = row?.querySelector('[data-field="amount"]');
    if (amountCell) {
      amountCell.textContent = '$' + this.formatCurrency(item.amount);
    }

    this.calculate();
  }

  deleteItem(itemId) {
    this.items = this.items.filter(i => i.id !== itemId);
    const row = this.querySelector(`tr[data-item-id="${itemId}"]`);
    row?.remove();
    this.calculate();
  }

  refreshTable() {
    const tbody = this.querySelector('.items-body');
    tbody.innerHTML = '';
    this.items.forEach(item => this.renderRow(item));
    this.calculate();
  }

  calculate() {
    const totals = this.getTotals();

    // Update display
    this.querySelector('[data-total="subtotal"]').textContent = '$' + this.formatCurrency(totals.subtotal);
    this.querySelector('[data-total="tax"]').textContent = '$' + this.formatCurrency(totals.tax);
    this.querySelector('[data-total="total"]').textContent = '$' + this.formatCurrency(totals.total);

    // Publish totals
    this.client.publish({
      topic: 'invoice.totals.updated',
      data: totals
    });
  }

  getTotals() {
    const subtotal = this.items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * this.taxRate;
    const total = subtotal + tax;

    return { subtotal, tax, total, taxRate: this.taxRate };
  }

  formatCurrency(value) {
    return (value || 0).toFixed(2);
  }
}

customElements.define('pan-invoice-line-items', PanInvoiceLineItems);

export default PanInvoiceLineItems;
