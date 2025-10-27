# Demo Applications

Complete, working applications built with PAN components. These demos showcase real-world usage and serve as templates for building your own apps.

## Applications

### invoice.html
**Invoice Creator** - Professional invoice creation tool for independent contractors.

**Features:**
- Contenteditable invoice fields (no forms!)
- Auto-calculating line items
- Multiple invoice management
- LocalStorage persistence
- Export to JSON
- Print-optimized layout
- Auto-save

**Components Used:**
- `app/invoice/pan-invoice-header.mjs`
- `app/invoice/pan-invoice-items.mjs`
- `app/invoice/pan-invoice-totals.mjs`
- `data/pan-invoice-store.mjs`

**Documentation:** See `INVOICE_README.md`

---

### markdown-notes.html
**Markdown Notes** - Full-featured markdown editor with file management.

**Features:**
- Rich markdown editor with toolbar
- Live preview toggle
- File browser with OPFS storage
- Create/rename/delete files
- Persistent storage
- Light/dark mode
- Keyboard shortcuts
- Export to .md files

**Components Used:**
- `components/pan-markdown-editor.mjs`
- `components/pan-markdown-renderer.mjs`
- `components/pan-files.mjs`

**Documentation:** See `docs/MARKDOWN_SYSTEM.md`

---

### data-browser.html
**Data Browser** - Browse and visualize data with tables and charts.

**Features:**
- Sortable, filterable data table
- Data visualization charts
- Export to CSV/JSON
- Responsive design

**Components Used:**
- `components/pan-data-table.mjs`
- `components/pan-chart.mjs`

---

### contact-manager.html
**Contact Manager** - Simple contact management application.

**Features:**
- Add/edit/delete contacts
- Search and filter
- Persistent storage
- Contact cards with avatars

**Components Used:**
- `ui/pan-card.mjs`
- `ui/pan-modal.mjs`
- `ui/user-avatar.mjs`

---

## Using These Demos

### As Learning Resources
- Study the code to learn PAN patterns
- See component integration in action
- Understand state management strategies

### As Templates
- Fork a demo to start your own app
- Modify to fit your use case
- Add your own components

### As Reference
- See complete, working examples
- Copy patterns into your projects
- Learn best practices

## Common Patterns

### 1. Application Structure
```html
<!-- Toolbar -->
<div class="toolbar">
  <button>Actions</button>
  <pan-theme-toggle></pan-theme-toggle>
</div>

<!-- Main Content -->
<div class="main-content">
  <pan-app-component></pan-app-component>
</div>

<!-- Infrastructure -->
<pan-bus></pan-bus>
<pan-theme-provider theme="auto"></pan-theme-provider>
```

### 2. State Management
```javascript
// Central store coordinates state
<pan-data-store></pan-data-store>

// Components communicate via PAN
bus.subscribe('data.loaded', (msg) => {
  updateUI(msg.data);
});

bus.publish('data.save', { item: {...} });
```

### 3. File Operations
```javascript
const files = document.querySelector('pan-files');

// Save
await files.writeFile('/document.md', content);

// Load
const content = await files.readFile('/document.md');

// Delete
await files.deleteFile('/document.md');
```

### 4. Theme Integration
```html
<!-- Theme provider manages state -->
<pan-theme-provider theme="auto"></pan-theme-provider>

<!-- Toggle button -->
<pan-theme-toggle variant="icon"></pan-theme-toggle>

<!-- All components automatically adapt -->
```

## Creating Your Own App

### Step 1: Choose a Template
Pick the demo closest to your needs:
- **Forms/CRUD** → invoice.html or contact-manager.html
- **Editor** → markdown-notes.html
- **Data viz** → data-browser.html

### Step 2: Customize
1. Copy the HTML file
2. Replace components with your own
3. Update styling and branding
4. Add your business logic

### Step 3: Add Components
Create app-specific components in `app/your-app/`:
```javascript
export class PanYourComponent extends HTMLElement {
  // Your component code
}
```

### Step 4: Add State Management
Create a store in `data/` if needed:
```javascript
export class PanYourStore extends HTMLElement {
  // State management code
}
```

## Deployment

All demos are static HTML/JS and can be deployed anywhere:
- GitHub Pages
- Netlify
- Vercel
- Any static host
- Or run locally with `python -m http.server`

No build step required! 🎉

## Testing

Open any `.html` file in your browser:
```bash
# From project root
python -m http.server 8000
# Then visit http://localhost:8000/apps/invoice.html
```

Or use the VS Code Live Server extension.

## Contributing

To add a new demo app:
1. Create `apps/your-app.html`
2. Create components in `app/your-app/`
3. Add data store in `data/` if needed
4. Update this README
5. Add to gallery.html

## Best Practices

✅ **Do:**
- Use semantic HTML
- Follow PAN event patterns
- Respect theme CSS variables
- Add keyboard shortcuts
- Handle errors gracefully
- Provide user feedback
- Test light/dark modes

❌ **Don't:**
- Hardcode colors (use CSS variables)
- Skip error handling
- Forget mobile responsiveness
- Mix multiple apps in one file
- Ignore accessibility

## Support

For questions or issues:
- Check component documentation in respective README files
- See main PAN documentation
- Look at other demo apps for examples
- Open an issue on GitHub
