# 📄 PAN Invoice Studio

A professional, local-first invoice creator built with PAN (Page Area Network). Create, manage, and export invoices with a beautiful contenteditable UX.

**Live Demo:** Open `index.html` in your browser (requires local server for modules)

---

## ✨ Features

### Core Functionality
- ✅ **Contenteditable UX** - Fluid editing with dotted borders (no clunky forms!)
- ✅ **Auto-calculations** - Automatic subtotals, tax, and totals
- ✅ **Auto-save** - Debounced auto-saving to IndexedDB
- ✅ **Local-first** - All data stored locally in IndexedDB
- ✅ **Offline-capable** - Works without internet connection
- ✅ **Privacy-focused** - No accounts, no servers, no tracking

### Invoice Management
- ✅ **Create invoices** - Simple, clean invoice layout
- ✅ **Edit invoices** - Load and edit past invoices
- ✅ **Browse invoices** - Visual grid view with search/filter
- ✅ **Delete invoices** - Remove invoices you no longer need

### Contact Management
- ✅ **Contact picker** - Select from saved contacts
- ✅ **Add contacts** - Quick-add new contacts inline
- ✅ **Manage contacts** - Full contact CRUD operations
- ✅ **Search contacts** - Find contacts quickly

### Export Options
- ✅ **Print** - Native browser print (Cmd/Ctrl+P)
- ✅ **Export PDF** - Generate PDF using jsPDF
- ✅ **Export JSON** - Backup all data as JSON
- ✅ **Import JSON** - Restore from backup

### Mobile Responsive
- ✅ **Works on mobile** - Fully responsive design
- ✅ **Touch-friendly** - Optimized for touch interfaces
- ✅ **Adaptive layout** - Stacks beautifully on small screens

---

## 🏗️ Architecture

Built using **PAN messaging patterns** with pure Web Components.

### Components

1. **pan-invoice-toolbar** - Action buttons (New, Save, Browse, Print, PDF, Import/Export)
2. **pan-invoice-editor** - Main invoice layout with contenteditable fields
3. **pan-invoice-line-items** - Editable line items table with auto-calculations
4. **pan-contact-manager** - Modal dialog for managing contacts
5. **pan-invoice-browser** - Modal dialog for browsing past invoices
6. **pan-toast** - Toast notifications for user feedback

### Services

1. **invoice-db.mjs** - IndexedDB wrapper for data persistence
2. **data-handler.mjs** - Import/export and PDF generation service

### PAN Message Topics

#### Invoice Operations
- `invoice.new` - Create new invoice
- `invoice.save` - Save current invoice
- `invoice.load` - Load specific invoice
- `invoice.load.latest` - Load most recent invoice
- `invoice.state` - Current invoice state (retained)
- `invoice.saved` - Invoice save confirmation
- `invoice.error` - Error occurred

#### Line Items
- `invoice.items.update` - Update line items
- `invoice.items.clear` - Clear all items
- `invoice.items.load` - Load items for invoice
- `invoice.totals.updated` - Totals recalculated

#### Contacts
- `contacts.manager.show` - Show contact manager
- `contacts.picker.show` - Show contact picker
- `contacts.selected` - Contact selected

#### Browser
- `invoice.browser.show` - Show invoice browser

#### Data Operations
- `invoice.data.export` - Export all data as JSON
- `invoice.data.import` - Import data from JSON
- `invoice.export.pdf` - Export current invoice as PDF

#### UI
- `ui.toast.show` - Show toast notification

---

## 🚀 Getting Started

### Prerequisites

- Modern web browser (Chrome, Firefox, Safari, Edge)
- Local web server (for ES modules)

### Running Locally

```bash
# From project root
cd demos/invoice-studio

# Start a local server (choose one):
python3 -m http.server 8000
# or
npx serve
# or
php -S localhost:8000

# Open in browser
open http://localhost:8000
```

---

## 💡 Usage

### Creating an Invoice

1. Click **"+ New"** to start fresh
2. Edit fields by clicking on dotted borders:
   - Invoice number and dates
   - Your business info (FROM section)
   - Client info (BILL TO section)
3. Add line items:
   - Click **"+ Add Item"**
   - Fill in description, quantity, rate
   - Amount calculates automatically
4. Adjust tax rate (default 8%)
5. Add notes (optional)
6. Click **"💾 Save"**

### Using Contacts

1. Click **"👥"** button next to "Bill To"
2. Select from existing contacts or add new
3. Contact info fills automatically

### Managing Past Invoices

1. Click **"📂 Browse"**
2. Search/filter/sort invoices
3. Click invoice card to load and edit
4. Delete unwanted invoices

### Exporting

**Print:**
- Click **"🖨️ Print"** or press Cmd/Ctrl+P
- Uses native browser print dialog

**PDF:**
- Click **"📄 PDF"**
- Downloads PDF file using jsPDF

**Backup:**
- Click **"📤 Export"**
- Downloads JSON file with all data

**Restore:**
- Click **"📥 Import"**
- Select previously exported JSON file

---

## 🎨 Design Philosophy

### ContentEditable UX

Unlike traditional form-based invoice tools, Invoice Studio uses contenteditable fields with visual cues (dotted borders) to create a fluid, natural editing experience:

- **No mode switching** - Edit inline, see results immediately
- **Visual feedback** - Dotted borders show editable areas
- **Print-ready** - What you see is what prints
- **Touch-friendly** - Works great on mobile

### Local-First Architecture

- **No accounts** - Start using immediately
- **No servers** - All data stays on your device
- **No tracking** - Complete privacy
- **Offline-capable** - Works without internet
- **Fast** - No network latency

### PAN Messaging

All components communicate via PAN messages:

- **Loose coupling** - Components don't know about each other
- **Easy testing** - Mock messages for testing
- **Composable** - Add/remove components easily
- **Debuggable** - Inspect messages in DevTools

---

## 🔧 Technical Details

### Data Storage

**IndexedDB Stores:**
1. **invoices** - Invoice documents
2. **contacts** - Contact information
3. **settings** - User preferences

**Indexes:**
- Invoice number (unique)
- Date, client name, status (non-unique)
- Contact email (unique)

### Auto-save

- Debounced 500ms after last edit
- Saves to IndexedDB automatically
- No "unsaved changes" warnings needed

### PDF Generation

Uses jsPDF to generate PDFs from invoice data:
- Clean, professional layout
- Includes all invoice details
- Properly formatted totals
- Optional notes section

### Browser Compatibility

**Tested:**
- ✅ Chrome (latest)

**Should work:**
- Firefox, Safari, Edge (untested)

**Requires:**
- ES modules support
- IndexedDB support
- CustomEvent support

---

## 📚 Code Structure

```
demos/invoice-studio/
├── index.html                 # Main entry point
├── styles.css                 # Global styles
├── README.md                  # This file
├── components/
│   ├── pan-invoice-toolbar.mjs
│   ├── pan-invoice-editor.mjs
│   ├── pan-invoice-line-items.mjs
│   ├── pan-contact-manager.mjs
│   ├── pan-invoice-browser.mjs
│   └── pan-toast.mjs
└── lib/
    ├── invoice-db.mjs         # IndexedDB wrapper
    └── data-handler.mjs       # Import/export/PDF