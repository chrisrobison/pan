# Invoice Creator Demo App

A modern, web-based invoice creation tool built entirely with PAN components. Create, manage, and export professional invoices with an intuitive contenteditable interface.

## Features

### 🎨 Modern UI
- Clean, professional design with automatic light/dark mode
- Contenteditable fields for natural, app-like editing
- No forms - just click and type
- Responsive layout for desktop and mobile

### 📝 Invoice Management
- Create unlimited invoices
- Auto-save as you type
- Switch between invoices instantly
- Delete unwanted invoices
- Persistent localStorage storage

### ✏️ Inline Editing
- Click-to-edit fields throughout
- No "edit mode" needed
- Natural contenteditable experience
- Tab between fields
- Enter to confirm and move to next field

### 📊 Line Items Grid
- Click "+" to add line items
- Contenteditable cells for description, hours, rate
- Auto-calculate line totals (hours × rate)
- Auto-calculate invoice subtotal
- Delete rows with × button
- Date field with placeholder format

### 💰 Automatic Calculations
- Real-time subtotal calculation
- Adjustable tax rate
- Automatic tax calculation
- Prominent total display
- Notes/payment terms section

### 💾 Data Management
- Auto-save on every change (1-second debounce)
- Manual save option
- Export single invoice to JSON
- Import invoices from JSON
- All data stored in localStorage
- No server required - fully offline capable

### 🖨️ Print & Export
- Print-optimized layout
- Clean print view (hides UI elements)
- Export to JSON for backup
- Import/Export for data portability

### ⌨️ Keyboard Shortcuts
- `Ctrl/Cmd + S`: Save invoice
- `Ctrl/Cmd + P`: Print invoice
- `Ctrl/Cmd + N`: New invoice
- `Enter`: Confirm field and move to next
- `Tab`: Navigate between fields

## Components

The app is built from 4 custom PAN components:

### 1. `<pan-invoice-header>`
Manages invoice header with from/to customer information.

**Features:**
- Contenteditable from/to sections
- Invoice number, date, due date fields
- Integration point for contact selection
- Broadcasts changes via PAN

**PAN Events:**
- Publishes: `invoice.header.changed`
- Subscribes: `invoice.load`, `invoice.clear`, `contact.selected`

### 2. `<pan-invoice-items>`
Editable grid for invoice line items.

**Features:**
- Click to add new rows
- Contenteditable cells (date, description, hours, rate)
- Auto-calculate line totals
- Delete rows
- Tab/Enter navigation

**PAN Events:**
- Publishes: `invoice.items.changed`, `invoice.totals.changed`
- Subscribes: `invoice.load`, `invoice.clear`

### 3. `<pan-invoice-totals>`
Displays and calculates invoice totals.

**Features:**
- Auto-updates from line items
- Editable tax rate
- Subtotal, tax, total calculations
- Notes/payment terms field
- Large, prominent total display

**PAN Events:**
- Publishes: `invoice.total.calculated`
- Subscribes: `invoice.totals.changed`, `invoice.load`, `invoice.clear`

### 4. `<pan-invoice-store>`
Centralized state management and persistence.

**Features:**
- localStorage persistence
- Multiple invoice management
- Auto-save with debouncing
- Import/Export JSON
- Coordinates all components via PAN

**PAN Events:**
- Publishes: `invoice.load`, `invoice.saved`, `invoice.list-updated`, `invoice.current-changed`
- Subscribes: `invoice.*` (all invoice commands)

## Architecture

### State Flow

```
User Edit → Component → PAN Event → Store → localStorage
                ↓                      ↓
             UI Update ← PAN Event ← Store
```

1. User edits a field (contenteditable)
2. Component emits change via PAN
3. Store receives change and updates state
4. Store saves to localStorage (auto-save)
5. Store broadcasts updated state
6. All components receive and sync

### Data Model

```typescript
interface Invoice {
  id: string;
  created: string; // ISO date
  modified: string; // ISO date
  header: {
    from: ContactInfo;
    to: ContactInfo;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
  };
  items: LineItem[];
  totals: {
    subtotal: number;
    tax: number;
    taxRate: number;
    total: number;
    notes: string;
  };
}

interface ContactInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  email: string;
}

interface LineItem {
  id: number;
  date: string;
  description: string;
  hours: string;
  rate: string;
  total: number;
}
```

## Usage

### Basic Usage

1. Open `demo-apps/invoice.html`
2. Start typing in any field
3. Add line items by clicking "+ Click to add line item"
4. Invoice auto-saves as you type
5. Use toolbar to create new invoices, export, print, etc.

### Creating Your First Invoice

1. **Fill in "From" section** (your business info)
   - This will be remembered for future invoices
2. **Fill in "Bill To" section** (customer info)
   - Or click "Select from Contacts" (if integrated)
3. **Set invoice number and dates**
4. **Add line items**
   - Click the "+" area
   - Enter description, hours, and rate
   - Total calculates automatically
5. **Adjust tax rate** if needed
6. **Add notes** for payment terms
7. **Print or export** when ready

### Managing Multiple Invoices

- Use the dropdown to switch between invoices
- Click "New" to create a new invoice
- Previous invoice auto-saves before switching
- "Delete" removes current invoice (with confirmation)

### Importing/Exporting

**Export single invoice:**
1. Click "Export" button
2. JSON file downloads automatically

**Import invoices:**
1. Click "Import" button
2. Select JSON file
3. Invoice(s) are added to your collection

**JSON format:**
- Single invoice: `{ id, created, modified, header, items, totals }`
- Multiple invoices: `[ invoice1, invoice2, ... ]`

## Integration

### Adding Contact Selection

The invoice app is designed to integrate with a contact management system:

```javascript
// Listen for contact selector request
bus.subscribe('invoice.open-contact-selector', () => {
  // Show your contact selector UI
  showContactModal();
});

// Send selected contact
function selectContact(contact) {
  bus.publish('contact.selected', {
    name: contact.name,
    address: contact.address,
    city: contact.city,
    phone: contact.phone,
    email: contact.email
  });
}
```

### Custom Branding

Override CSS variables in your theme:

```css
:root {
  --color-primary: #your-brand-color;
}
```

### Adding PDF Export

The app currently exports to JSON. To add PDF export:

```javascript
// Using html2pdf.js or similar
document.getElementById('btn-pdf').addEventListener('click', async () => {
  const element = document.querySelector('.main-content');
  await html2pdf().from(element).save('invoice.pdf');
});
```

## Extending

### Adding New Fields

1. **Update data model** in `pan-invoice-store.mjs`
2. **Add field to component** (header, items, or totals)
3. **Handle in PAN events**

Example - Adding a "PO Number" field:

```javascript
// In pan-invoice-header.mjs
<div class="field">
  <div class="field-label">PO Number</div>
  <div class="field-value"
       contenteditable="true"
       data-field="poNumber"
       data-placeholder="PO-12345">
    ${this._data.poNumber || ''}
  </div>
</div>
```

### Custom Line Item Types

Extend `pan-invoice-items` to support different item types:

```javascript
// Add item type column
<th class="col-type">Type</th>

// Add select or contenteditable for type
<td contenteditable="true" data-field="type">
  ${item.type || 'Service'}
</td>
```

### Advanced Calculations

Add discounts, fees, or complex calculations in `pan-invoice-totals`:

```javascript
_calculate() {
  const discount = this._subtotal * (this._discountRate / 100);
  this._subtotal = this._subtotal - discount;
  this._tax = this._subtotal * (this._taxRate / 100);
  this._total = this._subtotal + this._tax + this._fees;
}
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

Requires:
- ES6 Modules
- Web Components
- localStorage
- contenteditable
- CSS Custom Properties

## Offline Usage

The app works completely offline:
- No external dependencies
- All data stored locally
- No network requests
- Can be saved as standalone HTML

## Security & Privacy

- **All data stays local** - stored only in browser localStorage
- **No server communication** - fully client-side
- **No tracking** - zero analytics or external calls
- **Export for backup** - never lose your data
- **Clear data** - clear localStorage to remove all invoices

## Performance

- **Fast** - No server round-trips
- **Instant switching** - Invoices load from localStorage
- **Auto-save** - Debounced to prevent excessive writes
- **Lightweight** - < 50KB total (all components)

## License

Part of the PAN (Page Area Network) project - MIT License

## Acknowledgments

Inspired by the classic contenteditable invoice tool, modernized with web components and the PAN architecture.
