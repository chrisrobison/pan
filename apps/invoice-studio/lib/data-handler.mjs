/**
 * Data Handler Service
 *
 * Handles import/export and PDF generation for invoices.
 * Subscribes to PAN messages from toolbar and other components.
 */

import { PanClient } from '../../../src/components/pan-client.mjs';
import db from './invoice-db.mjs';

class DataHandler {
  constructor() {
    this.client = new PanClient();
    this.init();
  }

  init() {
    // Export data
    this.client.subscribe('invoice.data.export', async () => {
      await this.exportData();
    });

    // Import data
    this.client.subscribe('invoice.data.import', async (msg) => {
      await this.importData(msg.data);
    });

    // Export PDF
    this.client.subscribe('invoice.export.pdf', async () => {
      await this.exportPDF();
    });
  }

  async exportData() {
    try {
      const data = await db.exportData();

      // Create blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-studio-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showSuccess(`Exported ${data.data.invoices.length} invoices and ${data.data.contacts.length} contacts`);
    } catch (err) {
      this.showError('Failed to export data: ' + err.message);
    }
  }

  async importData(data) {
    try {
      const result = await db.importData(data);

      this.showSuccess(`Imported ${result.invoices} invoices, ${result.contacts} contacts, ${result.settings} settings`);

      // Reload current view
      this.client.publish({
        topic: 'invoice.load.latest',
        data: {}
      });
    } catch (err) {
      this.showError('Failed to import data: ' + err.message);
    }
  }

  async exportPDF() {
    try {
      // Check if jsPDF is available
      if (typeof window.jspdf === 'undefined') {
        // Fallback to browser print
        this.showInfo('jsPDF not loaded. Using browser print instead...');
        window.print();
        return;
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();

      // Get invoice data from the editor
      const invoiceEditor = document.querySelector('pan-invoice-editor');
      if (!invoiceEditor) {
        throw new Error('Invoice editor not found');
      }

      // Get current invoice data
      const invoice = invoiceEditor.getInvoiceData();

      // PDF styling
      const margin = 20;
      let y = margin;

      // Title
      doc.setFontSize(24);
      doc.setTextColor(102, 126, 234);
      doc.text('INVOICE', margin, y);

      y += 10;

      // Invoice number and date
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`#${invoice.number}`, margin, y);
      doc.text(`Date: ${invoice.date}`, 150, y);

      y += 15;

      // From section
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(100);
      doc.text('FROM', margin, y);

      y += 5;

      doc.setFont(undefined, 'normal');
      doc.setTextColor(50);
      doc.text(invoice.from?.name || '', margin, y);
      y += 5;
      if (invoice.from?.address) {
        doc.text(invoice.from.address, margin, y);
        y += 5;
      }
      if (invoice.from?.city) {
        doc.text(invoice.from.city, margin, y);
        y += 5;
      }
      if (invoice.from?.phone) {
        doc.text(invoice.from.phone, margin, y);
        y += 5;
      }
      if (invoice.from?.email) {
        doc.setTextColor(102, 126, 234);
        doc.text(invoice.from.email, margin, y);
        doc.setTextColor(50);
        y += 5;
      }

      // Bill To section
      y += 5;
      doc.setFont(undefined, 'bold');
      doc.setTextColor(100);
      doc.text('BILL TO', margin, y);

      y += 5;

      doc.setFont(undefined, 'normal');
      doc.setTextColor(50);
      doc.text(invoice.billTo?.name || '', margin, y);
      y += 5;
      if (invoice.billTo?.company) {
        doc.text(invoice.billTo.company, margin, y);
        y += 5;
      }
      if (invoice.billTo?.address) {
        doc.text(invoice.billTo.address, margin, y);
        y += 5;
      }
      if (invoice.billTo?.city) {
        doc.text(invoice.billTo.city, margin, y);
        y += 5;
      }
      if (invoice.billTo?.email) {
        doc.setTextColor(102, 126, 234);
        doc.text(invoice.billTo.email, margin, y);
        doc.setTextColor(50);
        y += 5;
      }

      // Line items table
      y += 10;

      // Table headers
      doc.setFont(undefined, 'bold');
      doc.setFillColor(248, 249, 250);
      doc.rect(margin, y - 5, 170, 8, 'F');
      doc.text('Description', margin + 2, y);
      doc.text('Qty', 120, y, { align: 'right' });
      doc.text('Rate', 145, y, { align: 'right' });
      doc.text('Amount', 180, y, { align: 'right' });

      y += 8;

      // Table rows
      doc.setFont(undefined, 'normal');
      (invoice.items || []).forEach(item => {
        if (y > 260) {
          doc.addPage();
          y = margin;
        }

        doc.text(item.description || '', margin + 2, y);
        doc.text(item.quantity?.toString() || '1', 120, y, { align: 'right' });
        doc.text(`$${(item.rate || 0).toFixed(2)}`, 145, y, { align: 'right' });
        doc.text(`$${(item.amount || 0).toFixed(2)}`, 180, y, { align: 'right' });

        y += 7;
      });

      // Totals
      y += 10;

      const totals = invoice.totals || {};

      doc.setFont(undefined, 'normal');
      doc.text('Subtotal:', 150, y);
      doc.text(`$${(totals.subtotal || 0).toFixed(2)}`, 180, y, { align: 'right' });

      y += 7;

      doc.text(`Tax (${((totals.taxRate || 0) * 100).toFixed(0)}%):`, 150, y);
      doc.text(`$${(totals.tax || 0).toFixed(2)}`, 180, y, { align: 'right' });

      y += 7;

      doc.setFont(undefined, 'bold');
      doc.setFontSize(12);
      doc.text('Total:', 150, y);
      doc.text(`$${(totals.total || 0).toFixed(2)}`, 180, y, { align: 'right' });

      // Notes
      if (invoice.notes) {
        y += 15;
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text('NOTES', margin, y);
        y += 5;
        doc.setFont(undefined, 'normal');
        const lines = doc.splitTextToSize(invoice.notes, 170);
        doc.text(lines, margin, y);
      }

      // Save PDF
      doc.save(`${invoice.number || 'invoice'}.pdf`);

      this.showSuccess('PDF exported successfully!');
    } catch (err) {
      this.showError('Failed to export PDF: ' + err.message);
      console.error(err);
    }
  }

  showSuccess(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'success', duration: 3000 }
    });
  }

  showInfo(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'info', duration: 5000 }
    });
  }

  showError(message) {
    this.client.publish({
      topic: 'ui.toast.show',
      data: { message, type: 'error', duration: 5000 }
    });
  }
}

// Initialize data handler
const dataHandler = new DataHandler();

export default dataHandler;
