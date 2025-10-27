/**
 * pan-invoice-items
 *
 * Contenteditable invoice line items grid with automatic calculations.
 * Emits changes via PAN for state management.
 *
 * Features:
 * - Click-to-add rows (just click in the items area)
 * - Contenteditable cells for natural editing
 * - Auto-calculate line totals (hours × rate)
 * - Delete rows with button or keyboard
 * - Broadcasts all changes via PAN
 *
 * PAN Events:
 * - invoice.items.changed: { items: [...] }
 * - invoice.totals.changed: { subtotal, items }
 *
 * Usage:
 *   <pan-invoice-items></pan-invoice-items>
 */

export class PanInvoiceItems extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._items = [];
    this._nextId = 1;
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

        .items-container {
          background: var(--color-surface, #ffffff);
          border: 1px solid var(--color-border, #e2e8f0);
          border-radius: 0.5rem;
          overflow: hidden;
        }

        table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.9rem;
        }

        thead {
          background: var(--color-bg-alt, #f8fafc);
          border-bottom: 2px solid var(--color-border, #e2e8f0);
        }

        th {
          padding: 0.75rem;
          text-align: left;
          font-weight: 600;
          color: var(--color-text-muted, #64748b);
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        th.col-num { width: 50px; }
        th.col-date { width: 120px; }
        th.col-hours { width: 80px; text-align: right; }
        th.col-rate { width: 100px; text-align: right; }
        th.col-total { width: 120px; text-align: right; }
        th.col-actions { width: 60px; }

        tbody tr {
          border-bottom: 1px solid var(--color-border, #e2e8f0);
          transition: background 0.15s ease;
        }

        tbody tr:hover {
          background: var(--color-bg-alt, #f8fafc);
        }

        tbody tr.empty-row:hover {
          background: var(--color-primary-soft, #e0f2fe);
        }

        td {
          padding: 0.5rem 0.75rem;
          color: var(--color-text, #1e293b);
        }

        td[contenteditable="true"] {
          outline: none;
          cursor: text;
          min-height: 1.5rem;
        }

        td[contenteditable="true"]:focus {
          background: var(--color-primary-soft, #e0f2fe);
          border-radius: 0.25rem;
        }

        td[contenteditable="true"]:empty:before {
          content: attr(data-placeholder);
          color: var(--color-text-subtle, #94a3b8);
          font-style: italic;
        }

        .col-num {
          color: var(--color-text-muted, #64748b);
          font-weight: 500;
          text-align: center;
        }

        .col-hours,
        .col-rate,
        .col-total {
          text-align: right;
          font-family: var(--font-mono, monospace);
        }

        .col-total {
          font-weight: 600;
          color: var(--color-primary, #006699);
        }

        .delete-btn {
          background: transparent;
          border: 1px solid var(--color-border, #e2e8f0);
          color: var(--color-text-muted, #64748b);
          border-radius: 0.25rem;
          padding: 0.25rem 0.5rem;
          cursor: pointer;
          font-size: 0.75rem;
          transition: all 0.2s ease;
          opacity: 0;
        }

        tr:hover .delete-btn {
          opacity: 1;
        }

        .delete-btn:hover {
          background: var(--color-danger-light, #fee2e2);
          border-color: var(--color-danger, #ef4444);
          color: var(--color-danger, #ef4444);
        }

        .add-row {
          padding: 1rem;
          text-align: center;
          color: var(--color-text-subtle, #94a3b8);
          cursor: pointer;
          transition: all 0.2s ease;
          border-top: 2px dashed var(--color-border, #e2e8f0);
        }

        .add-row:hover {
          background: var(--color-primary-soft, #e0f2fe);
          color: var(--color-primary, #006699);
        }

        .add-row-icon {
          display: inline-block;
          margin-right: 0.5rem;
          font-size: 1.2rem;
        }
      </style>

      <div class="items-container">
        <table>
          <thead>
            <tr>
              <th class="col-num">#</th>
              <th class="col-date">Date</th>
              <th class="col-description">Description</th>
              <th class="col-hours">Hours</th>
              <th class="col-rate">Rate</th>
              <th class="col-total">Total</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody class="items-body">
            ${this._renderRows()}
          </tbody>
        </table>
        <div class="add-row">
          <span class="add-row-icon">+</span>
          Click to add line item
        </div>
      </div>
    `;
  }

  _renderRows() {
    if (this._items.length === 0) {
      return '<tr class="empty-row"><td colspan="7" style="text-align: center; color: var(--color-text-subtle); padding: 2rem;">No items yet. Click below to add your first item.</td></tr>';
    }

    return this._items.map((item, idx) => `
      <tr data-id="${item.id}">
        <td class="col-num">${idx + 1}</td>
        <td class="col-date" contenteditable="true" data-field="date" data-placeholder="MM/DD/YYYY">${item.date || ''}</td>
        <td class="col-description" contenteditable="true" data-field="description" data-placeholder="Service description...">${item.description || ''}</td>
        <td class="col-hours" contenteditable="true" data-field="hours" data-placeholder="0">${item.hours || ''}</td>
        <td class="col-rate" contenteditable="true" data-field="rate" data-placeholder="0.00">${item.rate || ''}</td>
        <td class="col-total">${this._formatCurrency(item.total || 0)}</td>
        <td class="col-actions">
          <button class="delete-btn" data-id="${item.id}">×</button>
        </td>
      </tr>
    `).join('');
  }

  _setupEventListeners() {
    const tbody = this.shadowRoot.querySelector('.items-body');
    const addRow = this.shadowRoot.querySelector('.add-row');

    // Handle contenteditable changes
    tbody.addEventListener('blur', (e) => {
      if (e.target.hasAttribute('contenteditable')) {
        this._handleCellEdit(e.target);
      }
    }, true);

    // Handle Enter key in contenteditable
    tbody.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target.hasAttribute('contenteditable')) {
        e.preventDefault();
        e.target.blur();
        // Move to next cell or add new row
        this._moveToNextCell(e.target);
      }
    });

    // Handle delete buttons
    tbody.addEventListener('click', (e) => {
      if (e.target.classList.contains('delete-btn')) {
        const id = parseInt(e.target.dataset.id);
        this._deleteItem(id);
      }
    });

    // Handle add row click
    addRow.addEventListener('click', () => {
      this._addItem();
    });
  }

  _setupPanListeners() {
    const bus = document.querySelector('pan-bus');
    if (bus) {
      bus.subscribe('invoice.load', (data) => {
        if (data.items) {
          this.setItems(data.items);
        }
      });

      bus.subscribe('invoice.clear', () => {
        this.clear();
      });
    }
  }

  _handleCellEdit(cell) {
    const row = cell.closest('tr');
    const id = parseInt(row.dataset.id);
    const field = cell.dataset.field;
    const value = cell.textContent.trim();

    const item = this._items.find(i => i.id === id);
    if (item) {
      item[field] = value;

      // Recalculate total for numeric fields
      if (field === 'hours' || field === 'rate') {
        const hours = parseFloat(item.hours) || 0;
        const rate = parseFloat(item.rate) || 0;
        item.total = hours * rate;
      }

      this._updateRow(row, item);
      this._broadcastChanges();
    }
  }

  _updateRow(row, item) {
    const totalCell = row.querySelector('.col-total');
    if (totalCell) {
      totalCell.textContent = this._formatCurrency(item.total || 0);
    }
  }

  _moveToNextCell(currentCell) {
    const row = currentCell.closest('tr');
    const cells = Array.from(row.querySelectorAll('[contenteditable="true"]'));
    const currentIndex = cells.indexOf(currentCell);

    if (currentIndex < cells.length - 1) {
      // Move to next cell in row
      cells[currentIndex + 1].focus();
    } else {
      // Last cell - add new row or move to next row
      const nextRow = row.nextElementSibling;
      if (nextRow && nextRow.querySelector('[contenteditable="true"]')) {
        nextRow.querySelector('[contenteditable="true"]').focus();
      } else {
        this._addItem();
      }
    }
  }

  _addItem() {
    const newItem = {
      id: this._nextId++,
      date: this._formatDate(new Date()),
      description: '',
      hours: '',
      rate: '',
      total: 0
    };

    this._items.push(newItem);
    this.render();
    this._setupEventListeners();

    // Focus on first cell of new row
    setTimeout(() => {
      const newRow = this.shadowRoot.querySelector(`tr[data-id="${newItem.id}"]`);
      if (newRow) {
        const firstCell = newRow.querySelector('[contenteditable="true"]');
        if (firstCell) firstCell.focus();
      }
    }, 0);

    this._broadcastChanges();
  }

  _deleteItem(id) {
    this._items = this._items.filter(item => item.id !== id);
    this.render();
    this._setupEventListeners();
    this._broadcastChanges();
  }

  _broadcastChanges() {
    const bus = document.querySelector('pan-bus');
    if (bus) {
      // Emit items changed
      bus.publish('invoice.items.changed', { items: this._items });

      // Calculate and emit subtotal
      const subtotal = this._items.reduce((sum, item) => sum + (item.total || 0), 0);
      bus.publish('invoice.totals.changed', { subtotal, items: this._items });
    }
  }

  _formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }

  _formatDate(date) {
    return new Intl.DateFormat('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric'
    }).format(date);
  }

  // Public API
  setItems(items) {
    this._items = items.map(item => ({
      ...item,
      id: item.id || this._nextId++
    }));
    this._nextId = Math.max(...this._items.map(i => i.id), 0) + 1;
    this.render();
    this._setupEventListeners();
  }

  getItems() {
    return this._items;
  }

  clear() {
    this._items = [];
    this._nextId = 1;
    this.render();
    this._setupEventListeners();
  }

  getSubtotal() {
    return this._items.reduce((sum, item) => sum + (item.total || 0), 0);
  }
}

customElements.define('pan-invoice-items', PanInvoiceItems);
export default PanInvoiceItems;
