/**
 * Invoice Studio - IndexedDB Storage Layer
 *
 * Handles all database operations for invoices, contacts, and settings.
 * Uses IndexedDB for offline-first, local storage.
 */

const DB_NAME = 'pan-invoice-studio';
const DB_VERSION = 1;

class InvoiceDB {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Invoices store
        if (!db.objectStoreNames.contains('invoices')) {
          const invoiceStore = db.createObjectStore('invoices', { keyPath: 'id', autoIncrement: true });
          invoiceStore.createIndex('number', 'number', { unique: true });
          invoiceStore.createIndex('date', 'date', { unique: false });
          invoiceStore.createIndex('clientName', 'billTo.name', { unique: false });
          invoiceStore.createIndex('status', 'status', { unique: false });
          invoiceStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Contacts store
        if (!db.objectStoreNames.contains('contacts')) {
          const contactStore = db.createObjectStore('contacts', { keyPath: 'id', autoIncrement: true });
          contactStore.createIndex('name', 'name', { unique: false });
          contactStore.createIndex('email', 'email', { unique: true });
          contactStore.createIndex('type', 'type', { unique: false }); // 'client' or 'vendor'
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Get all invoices
   */
  async getAllInvoices() {
    const tx = this.db.transaction('invoices', 'readonly');
    const store = tx.objectStore('invoices');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(id) {
    const tx = this.db.transaction('invoices', 'readonly');
    const store = tx.objectStore('invoices');
    const request = store.get(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save invoice (create or update)
   */
  async saveInvoice(invoice) {
    const tx = this.db.transaction('invoices', 'readwrite');
    const store = tx.objectStore('invoices');

    // Clean up the invoice object - remove undefined/null id for new invoices
    // This allows autoIncrement to work properly
    if (invoice.id === undefined || invoice.id === null || invoice.id === '') {
      delete invoice.id;
    }

    // Add timestamps
    if (!invoice.createdAt) {
      invoice.createdAt = Date.now();
    }
    invoice.updatedAt = Date.now();

    // Generate invoice number if needed
    if (!invoice.number) {
      const allInvoices = await this.getAllInvoices();
      const maxNumber = allInvoices.reduce((max, inv) => {
        const num = parseInt(inv.number?.replace('INV-', '') || '0');
        return Math.max(max, num);
      }, 0);
      invoice.number = `INV-${String(maxNumber + 1).padStart(4, '0')}`;
    }

    const request = store.put(invoice);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete invoice
   */
  async deleteInvoice(id) {
    const tx = this.db.transaction('invoices', 'readwrite');
    const store = tx.objectStore('invoices');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all contacts
   */
  async getAllContacts() {
    const tx = this.db.transaction('contacts', 'readonly');
    const store = tx.objectStore('contacts');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save contact (create or update)
   */
  async saveContact(contact) {
    const tx = this.db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');

    if (!contact.createdAt) {
      contact.createdAt = Date.now();
    }
    contact.updatedAt = Date.now();

    const request = store.put(contact);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete contact
   */
  async deleteContact(id) {
    const tx = this.db.transaction('contacts', 'readwrite');
    const store = tx.objectStore('contacts');
    const request = store.delete(id);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get setting value
   */
  async getSetting(key) {
    const tx = this.db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save setting
   */
  async saveSetting(key, value) {
    const tx = this.db.transaction('settings', 'readwrite');
    const store = tx.objectStore('settings');
    const request = store.put({ key, value });

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Export all data as JSON
   */
  async exportData() {
    const [invoices, contacts, settings] = await Promise.all([
      this.getAllInvoices(),
      this.getAllContacts(),
      this.getAllSettings()
    ]);

    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      data: { invoices, contacts, settings }
    };
  }

  /**
   * Import data from JSON
   */
  async importData(data) {
    const { invoices = [], contacts = [], settings = [] } = data.data || data;

    // Import invoices
    for (const invoice of invoices) {
      await this.saveInvoice(invoice);
    }

    // Import contacts
    for (const contact of contacts) {
      await this.saveContact(contact);
    }

    // Import settings
    for (const setting of settings) {
      await this.saveSetting(setting.key, setting.value);
    }

    return {
      invoices: invoices.length,
      contacts: contacts.length,
      settings: settings.length
    };
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    const tx = this.db.transaction('settings', 'readonly');
    const store = tx.objectStore('settings');
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all data (dangerous!)
   */
  async clearAll() {
    const stores = ['invoices', 'contacts', 'settings'];
    const tx = this.db.transaction(stores, 'readwrite');

    for (const storeName of stores) {
      tx.objectStore(storeName).clear();
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}

// Create singleton instance
const db = new InvoiceDB();

// Initialize on import
await db.init();

export default db;
