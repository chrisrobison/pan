# Components

Complex, feature-rich components that provide substantial functionality. These are widgets that combine multiple features into cohesive tools.

## Components

### Markdown System

**pan-markdown-editor.mjs** - Full-featured markdown editor
- Rich formatting toolbar
- Keyboard shortcuts (Ctrl+B, Ctrl+I, etc.)
- Live preview toggle
- Auto-save support
- Word/character count
- Smart list continuation

**pan-markdown-renderer.mjs** - Markdown to HTML renderer
- GitHub-flavored markdown
- Tables, task lists, code blocks
- Syntax highlighting
- Safe HTML sanitization
- Custom styling via CSS variables

### File Management

**pan-files.mjs** - File system manager for OPFS
- File browser UI
- Create/rename/delete operations
- File filtering by extension
- Search functionality
- Read/write file contents
- Persistent browser storage (OPFS)

### Forms & Data

**pan-data-table.mjs** - Feature-rich data table
- Sorting and filtering
- Pagination
- Column customization
- Row selection
- Export functionality

**pan-schema-form.mjs** - Schema-driven form generator
- JSON Schema support
- Automatic field generation
- Validation
- Custom field types

**pan-form.mjs** - Generic form component
- Form state management
- Validation
- Submit handling
- PAN event integration

**pan-date-picker.mjs** - Date selection widget
- Calendar interface
- Date range selection
- Min/max date constraints
- Custom formatting

### Data Visualization

**pan-chart.mjs** - Charting component
- Multiple chart types (line, bar, pie)
- Responsive design
- Data updates via PAN
- Interactive tooltips

### Theme System

**pan-theme-provider.mjs** - Theme state management
- System preference detection
- Manual theme override
- PAN event broadcasting
- Light/dark mode support

**pan-theme-toggle.mjs** - Theme switcher UI
- Multiple variants (icon, button, dropdown)
- Integrates with theme provider
- Automatic state updates

### Utility Components

**todo-list.mjs** - Todo list widget
- Add/remove/edit items
- Persistence
- Complete/incomplete state

**drag-drop-list.mjs** - Sortable list with drag-drop
- Reorderable items
- Touch support
- Visual feedback

## Usage

Import components as needed:

```html
<script type="module" src="./components/pan-markdown-editor.mjs"></script>

<pan-markdown-editor
  value="# Hello World"
  preview="true"
  autosave="true">
</pan-markdown-editor>
```

## Design Philosophy

Components are:
- **Feature-rich** - Substantial functionality out of the box
- **Self-contained** - Complete solutions for specific needs
- **Configurable** - Many options and customization points
- **Integrated** - Work seamlessly with PAN bus
- **Production-ready** - Suitable for real applications

## Dependencies

- Core: pan-bus, pan-client
- UI: May use UI components internally
- Theme: Respect theme CSS variables

## When to Use

Use components from this directory when you need:
- Complete, ready-to-use functionality
- Rich feature sets
- Production-grade widgets
- Complex interactions

For simpler building blocks, see `ui/` directory.
For domain-specific tools, see `app/` directory.
