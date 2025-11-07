/**
 * Invoice Editor Component
 *
 * Main invoice layout with contenteditable fields.
 * Features dotted borders to indicate editable areas.
 * All edits auto-save to current invoice state.
 */

import { PanClient } from '../../../src/components/pan-client.mjs';
import db from '../lib/invoice-db.mjs';

class PanInvoiceEditor extends HTMLElement {
  constructor() {
    super();
    this.client = new PanClient(this);
    this.currentInvoice = null;
    this.debounceTimer = null;
  }

  connectedCallback() {
    this.render();
    this.attachEventListeners();
    this.subscribeToMessages();
    this.loadDefaults();
  }

  async loadDefaults() {
    // Load default business info from settings
    const businessInfo = await db.getSetting('businessInfo') || {
      name: 'Your Business Name',
      address: '123 Main St',
      city: 'City, ST 12345',
      phone: '(555) 555-5555',
      email: 'hello@example.com'
    };

    this.querySelector('[data-field="from.name"]').textContent = businessInfo.name;
    this.querySelector('[data-field="from.address"]').textContent = businessInfo.address;
    this.querySelector('[data-field="from.city"]').textContent = businessInfo.city;
    this.querySelector('[data-field="from.phone"]').textContent = businessInfo.phone;
    this.querySelector('[data-field="from.email"]').textContent = businessInfo.email;
  }

  render() {
    const today = new Date().toISOString().split('T')[0];

    this.innerHTML = `
      <div class="invoice-container">
        <div class="invoice-paper">
          <!-- Header -->
          <div class="invoice-header">
            <div class="invoice-title">
              <h1>INVOICE</h1>
              <div class="invoice-number">
                #<span contenteditable="true" data-field="number" placeholder="INV-0001">INV-0001</span>
              </div>
            </div>
            <div class="invoice-meta">
              <div class="meta-row">
                <label>Date:</label>
                <span contenteditable="true" data-field="date" placeholder="${today}">${today}</span>
              </div>
              <div class="meta-row">
                <label>Due:</label>
                <span contenteditable="true" data-field="dueDate" placeholder="${today}"></span>
              </div>
            </div>
          </div>

          <!-- From/To Section -->
          <div class="invoice-parties">
            <div class="party from">
              <h3>From</h3>
              <div class="party-details">
                <div contenteditable="true" data-field="from.name" placeholder="Your Business Name"></div>
                <div contenteditable="true" data-field="from.address" placeholder="123 Main Street"></div>
                <div contenteditable="true" data-field="from.city" placeholder="City, ST 12345"></div>
                <div contenteditable="true" data-field="from.phone" placeholder="(555) 555-5555"></div>
                <div contenteditable="true" data-field="from.email" placeholder="hello@example.com"></div>
              </div>
            </div>

            <div class="party to">
              <h3>Bill To <button class="btn-icon" data-action="select-contact" title="Select from contacts">👥</button></h3>
              <div class="party-details">
                <div contenteditable="true" data-field="billTo.name" placeholder="Client Name"></div>
                <div contenteditable="true" data-field="billTo.company" placeholder="Company Name"></div>
                <div contenteditable="true" data-field="billTo.address" placeholder="123 Client St"></div>
                <div contenteditable="true" data-field="billTo.city" placeholder="City, ST 12345"></div>
                <div contenteditable="true" data-field="billTo.email" placeholder="client@example.com"></div>
              </div>
            </div>
          </div>

          <!-- Line Items -->
          <pan-invoice-line-items></pan-invoice-line-items>

          <!-- Notes -->
          <div class="invoice-notes">
            <h3>Notes</h3>
            <div
              contenteditable="true"
              data-field="notes"
              placeholder="Thank you for your business!"
              class="notes-content"
            ></div>
          </div>

          <!-- Footer -->
          <div class="invoice-footer">
            <div class="payment-terms">
              <strong>Payment Terms:</strong>
              <span contenteditable="true" data-field="terms" placeholder="Net 30">Net 30</span>
            </div>
          </div>
        </div>
      </div>

      <style>
        .invoice-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .invoice-paper {
          background: white;
          padding: 3rem;
          border-radius: 8px;
          box-shadow: 0 2px 20px rgba(0,0,0,0.1);
          min-height: 11in;
        }

        /* Contenteditable styling */
        [contenteditable="true"] {
          border-bottom: 1px dotted #ccc;
          padding: 0.25rem 0;
          transition: all 0.2s;
          outline: none;
          min-width: 100px;
          display: inline-block;
        }

        [contenteditable="true"]:hover {
          border-bottom-color: #667eea;
          background: rgba(102, 126, 234, 0.05);
        }

        [contenteditable="true"]:focus {
          border-bottom: 1px solid #667eea;
          background: rgba(102, 126, 234, 0.08);
        }

        [contenteditable="true"]:empty:before {
          content: attr(placeholder);
          color: #999;
          font-style: italic;
        }

        /* Header */
        .invoice-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
          padding-bottom: 1.5rem;
          border-bottom: 3px solid #667eea;
        }

        .invoice-title h1 {
          font-size: 2.5rem;
          font-weight: 700;
          color: #667eea;
          margin: 0;
        }

        .invoice-number {
          font-size: 1.25rem;
          color: #666;
          margin-top: 0.5rem;
        }

        .invoice-meta {
          text-align: right;
        }

        .meta-row {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .meta-row label {
          font-weight: 600;
          color: #666;
        }

        /* Parties */
        .invoice-parties {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 2rem;
          margin-bottom: 2rem;
        }

        .party h3 {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .party-details {
          background: #f8f9fa;
          padding: 1rem;
          border-radius: 6px;
        }

        .party-details > div {
          margin-bottom: 0.25rem;
        }

        .btn-icon {
          background: none;
          border: none;
          padding: 0.25rem;
          cursor: pointer;
          font-size: 1rem;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .btn-icon:hover {
          opacity: 1;
        }

        /* Notes */
        .invoice-notes {
          margin-top: 2rem;
          padding-top: 2rem;
          border-top: 1px solid #e0e0e0;
        }

        .invoice-notes h3 {
          font-size: 0.875rem;
          font-weight: 600;
          text-transform: uppercase;
          color: #666;
          margin-bottom: 0.5rem;
        }

        .notes-content {
          min-height: 60px;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 6px;
          display: block;
          width: 100%;
        }

        /* Footer */
        .invoice-footer {
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #e0e0e0;
          color: #666;
          font-size: 0.875rem;
        }

        .payment-terms {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        /* Print styles */
        @media print {
          .invoice-paper {
            box-shadow: none;
            padding: 0;
          }

          [contenteditable="true"] {
            border-bottom: none;
          }

          .btn-icon {
            display: none;
          }
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .invoice-paper {
            padding: 1.5rem;
          }

          .invoice-header {
            flex-direction: column;
            gap: 1rem;
          }

          .invoice-title h1 {
            font-size: 2rem;
          }

          .invoice-meta {
            text-align: left;
          }

          .invoice-parties {
            grid-template-columns: 1fr;
            gap: 1.5rem;
          }
        }
      </style>
    `;
  }

  attachEventListeners() {
    // Auto-save on edit (debounced)
    this.querySelectorAll('[contenteditable="true"]').forEach(field => {
      field.addEventListener('blur', () => {
        this.debouncedSave();
      });

      field.addEventListener('input', () => {
        this.debouncedSave();
      });
    });

    // Select contact button
    this.querySelector('[data-action="select-contact"]')?.addEventListener('click', () => {
      this.selectContact();
    });
  }

  subscribeToMessages() {
    // New invoice
    this.client.subscribe('invoice.new', () => {
      this.createNewInvoice();
    });

    // Save invoice
    this.client.subscribe('invoice.save', async () => {
      await this.saveInvoice();
    });

    // Load invoice
    this.client.subscribe('invoice.load', (msg) => {
      this.loadInvoice(msg.data.invoice);
    });

    // Load latest invoice
    this.client.subscribe('invoice.load.latest', async () => {
      const invoices = await db.getAllInvoices();
      if (invoices.length > 0) {
        const latest = invoices.sort((a, b) => b.updatedAt - a.updatedAt)[0];
        this.loadInvoice(latest);
      } else {
        this.createNewInvoice();
      }
    });

    // Contact selected
    this.client.subscribe('contacts.selected', (msg) => {
      this.fillContactInfo(msg.data.contact);
    });
  }

  debouncedSave() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.publishState();
    }, 500);
  }

  publishState() {
    const invoice = this.getInvoiceData();
    this.client.publish({
      topic: 'invoice.state',
      data: invoice,
      retain: true
    });
  }

  getInvoiceData() {
    const data = {
      id: this.currentInvoice?.id,
      number: this.getFieldValue('number'),
      date: this.getFieldValue('date'),
      dueDate: this.getFieldValue('dueDate'),
      from: {
        name: this.getFieldValue('from.name'),
        address: this.getFieldValue('from.address'),
        city: this.getFieldValue('from.city'),
        phone: this.getFieldValue('from.phone'),
        email: this.getFieldValue('from.email')
      },
      billTo: {
        name: this.getFieldValue('billTo.name'),
        company: this.getFieldValue('billTo.company'),
        address: this.getFieldValue('billTo.address'),
        city: this.getFieldValue('billTo.city'),
        email: this.getFieldValue('billTo.email')
      },
      notes: this.getFieldValue('notes'),
      terms: this.getFieldValue('terms'),
      items: [], // Will be set by line-items component
      totals: {} // Will be calculated by line-items component
    };

    return data;
  }

  getFieldValue(fieldName) {
    const field = this.querySelector(`[data-field="${fieldName}"]`);
    return field?.textContent?.trim() || '';
  }

  setFieldValue(fieldName, value) {
    const field = this.querySelector(`[data-field="${fieldName}"]`);
    if (field) {
      field.textContent = value || '';
    }
  }

  async saveInvoice() {
    try {
      const invoice = this.getInvoiceData();
      const id = await db.saveInvoice(invoice);
      this.currentInvoice = { ...invoice, id };

      this.client.publish({
        topic: 'invoice.saved',
        data: { invoice: this.currentInvoice }
      });
    } catch (err) {
      this.client.publish({
        topic: 'invoice.error',
        data: { message: 'Failed to save invoice: ' + err.message }
      });
    }
  }

  createNewInvoice() {
    // Clear all fields
    this.querySelectorAll('[contenteditable="true"]').forEach(field => {
      if (!field.dataset.field.startsWith('from.') && field.dataset.field !== 'terms') {
        field.textContent = '';
      }
    });

    // Generate new invoice number
    this.setFieldValue('number', `INV-${Date.now().toString().slice(-4)}`);
    this.setFieldValue('date', new Date().toISOString().split('T')[0]);

    this.currentInvoice = null;

    this.client.publish({
      topic: 'invoice.items.clear',
      data: {}
    });
  }

  loadInvoice(invoice) {
    this.currentInvoice = invoice;

    // Set all fields
    this.setFieldValue('number', invoice.number);
    this.setFieldValue('date', invoice.date);
    this.setFieldValue('dueDate', invoice.dueDate);

    // From fields
    if (invoice.from) {
      this.setFieldValue('from.name', invoice.from.name);
      this.setFieldValue('from.address', invoice.from.address);
      this.setFieldValue('from.city', invoice.from.city);
      this.setFieldValue('from.phone', invoice.from.phone);
      this.setFieldValue('from.email', invoice.from.email);
    }

    // Bill To fields
    if (invoice.billTo) {
      this.setFieldValue('billTo.name', invoice.billTo.name);
      this.setFieldValue('billTo.company', invoice.billTo.company);
      this.setFieldValue('billTo.address', invoice.billTo.address);
      this.setFieldValue('billTo.city', invoice.billTo.city);
      this.setFieldValue('billTo.email', invoice.billTo.email);
    }

    this.setFieldValue('notes', invoice.notes);
    this.setFieldValue('terms', invoice.terms);

    // Notify line items component
    this.client.publish({
      topic: 'invoice.items.load',
      data: { items: invoice.items || [] }
    });
  }

  selectContact() {
    this.client.publish({
      topic: 'contacts.picker.show',
      data: { mode: 'select' }
    });
  }

  fillContactInfo(contact) {
    this.setFieldValue('billTo.name', contact.name);
    this.setFieldValue('billTo.company', contact.company);
    this.setFieldValue('billTo.address', contact.address);
    this.setFieldValue('billTo.city', contact.city);
    this.setFieldValue('billTo.email', contact.email);

    this.debouncedSave();
  }
}

customElements.define('pan-invoice-editor', PanInvoiceEditor);

export default PanInvoiceEditor;
