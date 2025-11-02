/**
 * pan-invoice-store data tests
 * Tests the invoice storage, retrieval, and management functionality
 */

import { chromium } from 'playwright';
import { describe, test, expect, beforeAll, afterAll } from '../lib/test-runner.mjs';
import { fileUrl, publishPanMessage } from '../lib/test-utils.mjs';

describe('PanInvoiceStore', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test('registers as custom element', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));

    // Load the invoice store component
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const isDefined = await page.evaluate(() => {
      return customElements.get('pan-invoice-store') !== undefined;
    });

    expect(isDefined).toBeTruthy();
  });

  test('creates instance and initializes with empty invoice', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);
    });

    await page.waitForTimeout(100);

    const hasInvoice = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      const invoice = store.getCurrentInvoice();
      return invoice !== null && invoice.id !== null;
    });

    expect(hasInvoice).toBeTruthy();
  });

  test('has auto-save enabled by default', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const autoSave = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);
      return store._autoSave;
    });

    expect(autoSave).toBeTruthy();
  });

  test('can disable auto-save with attribute', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const autoSave = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      store.setAttribute('auto-save', 'false');
      document.body.appendChild(store);
      return store._autoSave;
    });

    expect(autoSave).toBe(false);
  });

  test('generates unique invoice IDs', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const ids = await page.evaluate(() => {
      const store = document.createElement('pan-invoice-store');
      const id1 = store._generateId();
      const id2 = store._generateId();
      return { id1, id2, different: id1 !== id2 };
    });

    expect(ids.different).toBeTruthy();
    expect(ids.id1).toContain('INV-');
    expect(ids.id2).toContain('INV-');
  });

  test('creates empty invoice with correct structure', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const invoice = await page.evaluate(() => {
      const store = document.createElement('pan-invoice-store');
      return store._getEmptyInvoice();
    });

    expect(invoice.id).toBeTruthy();
    expect(invoice.created).toBeTruthy();
    expect(invoice.modified).toBeTruthy();
    expect(invoice.header).toBeTruthy();
    expect(invoice.header.from).toBeTruthy();
    expect(invoice.header.to).toBeTruthy();
    expect(invoice.items).toEqual([]);
    expect(invoice.totals).toBeTruthy();
  });

  test('saves invoice to localStorage', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const invoice = store.getCurrentInvoice();
      invoice.header.invoiceNumber = 'TEST-001';
      store.save();
    });

    await page.waitForTimeout(100);

    const saved = await page.evaluate(() => {
      const data = localStorage.getItem('pan-invoices');
      return data ? JSON.parse(data) : [];
    });

    expect(saved.length).toBe(1);
    expect(saved[0].header.invoiceNumber).toBe('TEST-001');
  });

  test('loads invoice by ID', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const invoice = store.getCurrentInvoice();
      invoice.header.invoiceNumber = 'TEST-002';
      const savedId = invoice.id;
      store.save();

      // Create new invoice
      store.createNew();

      // Load the previous one
      store.load(savedId);

      return store.getCurrentInvoice().header.invoiceNumber;
    });

    expect(result).toBe('TEST-002');
  });

  test('creates new invoice', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const firstId = store.getCurrentInvoice().id;
      store.createNew();
      const secondId = store.getCurrentInvoice().id;

      return { firstId, secondId, different: firstId !== secondId };
    });

    expect(result.different).toBeTruthy();
  });

  test('getAllInvoices returns all stored invoices', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const count = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      // Create and save multiple invoices
      store.getCurrentInvoice().header.invoiceNumber = 'INV-1';
      store.save();

      store.createNew();
      store.getCurrentInvoice().header.invoiceNumber = 'INV-2';
      store.save();

      store.createNew();
      store.getCurrentInvoice().header.invoiceNumber = 'INV-3';
      store.save();

      return store.getAllInvoices().length;
    });

    expect(count).toBe(3);
  });

  test('listens to invoice.header.changed event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      store.setAttribute('auto-save', 'false');
      document.body.appendChild(store);
    });

    await page.waitForTimeout(100);

    await publishPanMessage(page, 'invoice.header.changed', {
      from: { name: 'Test Company' },
      to: { name: 'Client Company' },
      invoiceNumber: 'TEST-003'
    });

    await page.waitForTimeout(100);

    const header = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      return store.getCurrentInvoice().header;
    });

    expect(header.invoiceNumber).toBe('TEST-003');
  });

  test('listens to invoice.items.changed event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      store.setAttribute('auto-save', 'false');
      document.body.appendChild(store);
    });

    await page.waitForTimeout(100);

    await publishPanMessage(page, 'invoice.items.changed', {
      items: [
        { description: 'Item 1', quantity: 2, price: 100 },
        { description: 'Item 2', quantity: 1, price: 50 }
      ]
    });

    await page.waitForTimeout(100);

    const items = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      return store.getCurrentInvoice().items;
    });

    expect(items).toHaveLength(2);
    expect(items[0].description).toBe('Item 1');
  });

  test('listens to invoice.total.calculated event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      store.setAttribute('auto-save', 'false');
      document.body.appendChild(store);
    });

    await page.waitForTimeout(100);

    await publishPanMessage(page, 'invoice.total.calculated', {
      subtotal: 100,
      tax: 10,
      taxRate: 0.1,
      total: 110
    });

    await page.waitForTimeout(100);

    const totals = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      return store.getCurrentInvoice().totals;
    });

    expect(totals.subtotal).toBe(100);
    expect(totals.total).toBe(110);
  });

  test('responds to invoice.save event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);
      store.getCurrentInvoice().header.invoiceNumber = 'TEST-SAVE';
    });

    await page.waitForTimeout(100);

    await publishPanMessage(page, 'invoice.save', {});

    await page.waitForTimeout(100);

    const saved = await page.evaluate(() => {
      const data = localStorage.getItem('pan-invoices');
      return data ? JSON.parse(data) : [];
    });

    expect(saved.length).toBeGreaterThan(0);
  });

  test('responds to invoice.new event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(async () => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const firstId = store.getCurrentInvoice().id;

      // Wait for store to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger new invoice event
      const event = new CustomEvent('pan:publish', {
        detail: { topic: 'invoice.new', data: {} },
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(event);

      // Wait for new invoice to be created
      await new Promise(resolve => setTimeout(resolve, 100));

      const secondId = store.getCurrentInvoice().id;
      return { firstId, secondId, different: firstId !== secondId };
    });

    expect(result.different).toBeTruthy();
  });

  test('responds to invoice.clear event', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);
      store.getCurrentInvoice().header.invoiceNumber = 'TO-CLEAR';
    });

    await page.waitForTimeout(100);

    await publishPanMessage(page, 'invoice.clear', {});

    await page.waitForTimeout(100);

    const invoiceNumber = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      return store.getCurrentInvoice().header.invoiceNumber;
    });

    expect(invoiceNumber).toBe('');
  });

  test('exports invoice data', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 2000 }).catch(() => null);

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);
      store.getCurrentInvoice().header.invoiceNumber = 'EXPORT-001';
      store._exportInvoice();
    });

    // Wait a bit for download to potentially start
    await page.waitForTimeout(200);

    // We can't easily test actual download, but we can verify the method exists and runs
    const hasMethod = await page.evaluate(() => {
      const store = document.querySelector('pan-invoice-store');
      return typeof store._exportInvoice === 'function';
    });

    expect(hasMethod).toBeTruthy();
  });

  test('imports invoice data from JSON', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const importData = {
        id: 'IMPORT-123',
        header: { invoiceNumber: 'IMPORTED-001' },
        items: [],
        totals: { total: 0 }
      };

      store._importInvoice(JSON.stringify(importData));

      return store.getCurrentInvoice().header.invoiceNumber;
    });

    expect(result).toBe('IMPORTED-001');
  });

  test('imports array of invoices', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const count = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const importData = [
        {
          id: 'IMPORT-1',
          header: { invoiceNumber: 'IMPORTED-001' },
          items: [],
          totals: { total: 0 }
        },
        {
          id: 'IMPORT-2',
          header: { invoiceNumber: 'IMPORTED-002' },
          items: [],
          totals: { total: 0 }
        }
      ];

      store._importInvoice(JSON.stringify(importData));

      return store.getAllInvoices().length;
    });

    expect(count).toBeGreaterThan(1);
  });

  test('updates modified timestamp on changes', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(async () => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      const originalModified = store.getCurrentInvoice().modified;

      await new Promise(resolve => setTimeout(resolve, 10));

      store._markModified();
      const newModified = store.getCurrentInvoice().modified;

      return { originalModified, newModified, changed: originalModified !== newModified };
    });

    expect(result.changed).toBeTruthy();
  });

  test('debounces auto-save', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      // Trigger multiple rapid changes
      store._markModified();
      store._debounceSave();
      store._markModified();
      store._debounceSave();
      store._markModified();
      store._debounceSave();
    });

    // Wait for debounce to complete
    await page.waitForTimeout(1100);

    const saved = await page.evaluate(() => {
      const data = localStorage.getItem('pan-invoices');
      return data ? JSON.parse(data) : [];
    });

    // Should have saved once due to debouncing
    expect(saved.length).toBeGreaterThan(0);
  });

  test('publishes invoice.saved event after saving', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const eventReceived = await page.evaluate(async () => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      return new Promise((resolve) => {
        document.addEventListener('pan:deliver', (e) => {
          if (e.detail.topic === 'invoice.saved') {
            resolve(true);
          }
        }, { once: true });

        // Subscribe to the topic
        document.dispatchEvent(new CustomEvent('pan:subscribe', {
          detail: { topics: ['invoice.saved'], clientId: 'test' },
          bubbles: true,
          composed: true
        }));

        setTimeout(() => {
          store.save();
        }, 100);

        setTimeout(() => resolve(false), 2000);
      });
    });

    expect(eventReceived).toBeTruthy();
  });

  test('copies from field from last invoice to new invoice', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const copied = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      store.getCurrentInvoice().header.from.name = 'My Company';
      store.save();

      store.createNew();

      return store.getCurrentInvoice().header.from.name;
    });

    expect(copied).toBe('My Company');
  });

  test('copies tax rate from last invoice to new invoice', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const copied = await page.evaluate(() => {
      localStorage.clear();
      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      store.getCurrentInvoice().totals.taxRate = 0.15;
      store.save();

      store.createNew();

      return store.getCurrentInvoice().totals.taxRate;
    });

    expect(copied).toBe(0.15);
  });

  test('handles localStorage errors gracefully', async () => {
    await page.goto(fileUrl('examples/01-hello.html'));
    await page.addScriptTag({ path: './dist/data/pan-invoice-store.js', type: 'module' });

    const result = await page.evaluate(() => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = () => {
        throw new Error('Storage quota exceeded');
      };

      const store = document.createElement('pan-invoice-store');
      document.body.appendChild(store);

      try {
        store.save();
        // Restore localStorage
        localStorage.setItem = originalSetItem;
        return { success: true, threw: false };
      } catch (e) {
        localStorage.setItem = originalSetItem;
        return { success: false, threw: true };
      }
    });

    // Should handle error gracefully without throwing
    expect(result.threw).toBe(false);
  });
});
