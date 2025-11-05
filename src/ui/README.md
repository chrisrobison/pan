# UI Components

Simple, reusable UI building blocks. These are lightweight components that provide basic UI functionality.

## Components

### pan-card.mjs
Container component with header, body, footer, and variants.
- Multiple elevation levels
- Color variants (primary, secondary, danger, success)
- Hoverable option
- Slot-based content

### pan-modal.mjs
Modal dialog component with backdrop and animations.
- Open/close API
- Customizable header and footer
- Backdrop click to close
- ESC key support

### pan-dropdown.mjs
Dropdown menu component with positioning.
- Auto-positioning (bottom, top, left, right)
- Keyboard navigation
- Click-outside to close
- Dividers and disabled items

### pan-tabs.mjs
Tabbed interface component.
- Multiple tab styles
- Slot-based content
- Active tab tracking
- PAN event integration

### pan-link.mjs
Navigation link component with routing support.
- Active state management
- Router integration via PAN
- Custom styling support

### pan-search-bar.mjs
Search input with debouncing and clear button.
- Debounced input events
- Clear button
- PAN event integration
- Configurable placeholder

### pan-pagination.mjs
Pagination control component.
- Page navigation
- First/last buttons
- Configurable page size
- PAN event broadcasting

### editable-cell.mjs
Inline editable cell for tables.
- Click to edit
- ESC to cancel
- Enter to save
- Auto-save option

### file-upload.mjs
File upload component with drag-drop support.
- Drag and drop
- Multiple file support
- File type filtering
- Progress indication

### user-avatar.mjs
User avatar display with fallback initials.
- Image support
- Fallback to initials
- Size variants
- Online status indicator

## Usage

Import and use directly in your HTML:

```html
<script type="module" src="./ui/pan-card.mjs"></script>

<pan-card header="Card Title" elevation="2">
  <p>Card content goes here</p>
  <div slot="footer">Footer content</div>
</pan-card>
```

## Design Philosophy

UI components are:
- **Simple** - Single, focused responsibility
- **Reusable** - Work in any context
- **Lightweight** - Minimal dependencies
- **Themeable** - Respect CSS variables
- **Composable** - Can be combined to build complex UIs

## Dependencies

- Core: pan-bus (optional, for PAN event integration)
- Theme: CSS variables from `assets/theme.css`
