# PAN Reorganization - Project Structure

## Overview

The PAN project has been reorganized with a clean, approachable top-level structure and a clear, layered component architecture. This document explains the new structure and migration path.

## Top-Level Structure

The project now has a simple, welcoming top-level that clearly shows what PAN is about:

```
pan/
├── pan/           # 🎯 Component library (the heart of the project)
├── site/          # 🌐 Website (homepage, gallery, demos viewer)
├── apps/          # 📱 Demo applications
├── examples/      # 📚 Example usage pages
├── docs/          # 📖 Documentation
│   ├── rfcs/      # (moved from top-level)
│   └── templates/ # (moved from top-level)
├── assets/        # 🎨 Shared resources
│   └── badges/    # (moved from top-level)
├── scripts/       # 🔧 Build and utility scripts
├── tests/         # ✅ Test suite
├── packages/      # 📦 NPM packages
└── ...            # Config files
```

**Benefits:**
- **Approachable** - New users immediately understand what's what
- **Focused** - The `pan/` folder clearly contains the component library
- **Organized** - Website, apps, examples, and docs are separate
- **Professional** - Clean structure reflects project simplicity

## Component Library Structure

Inside the `pan/` folder, components are organized by complexity and purpose:

```
pan/
├── core/          # Core infrastructure (required for PAN to work)
├── ui/            # Simple, reusable UI building blocks
├── components/    # Complex, feature-rich widgets
├── data/          # State management and data layer
└── app/           # Domain-specific application components
    ├── invoice/   # Invoice app components
    └── devtools/  # Developer tools components
```

## Component Categories

### Core (`pan/core/`) - Infrastructure

**Purpose:** Essential PAN infrastructure required for the system to function.

**Components:**
- `pan-bus.mjs` - Central message bus
- `pan-client.mjs` - Client library for PAN interaction
- `pan-autoload.mjs` - Automatic component loader

**When to use:** Always - these are the foundation of PAN.

**Import example:**
```javascript
import { PanClient } from './pan/core/pan-client.mjs';
```

---

### UI (`pan/ui/`) - Simple Building Blocks

**Purpose:** Lightweight, single-purpose UI components that are highly reusable.

**Components:**
- `pan-card.mjs` - Card container
- `pan-modal.mjs` - Modal dialog
- `pan-dropdown.mjs` - Dropdown menu
- `pan-tabs.mjs` - Tabbed interface
- `pan-link.mjs` - Navigation link
- `pan-search-bar.mjs` - Search input
- `pan-pagination.mjs` - Pagination controls
- `editable-cell.mjs` - Inline editable cell
- `file-upload.mjs` - File upload widget
- `user-avatar.mjs` - User avatar display

**Characteristics:**
- Simple, focused responsibility
- Minimal dependencies
- Highly reusable
- Works in any context

**When to use:** Building basic UI layouts and interactions.

**Import example:**
```javascript
import './pan/ui/pan-card.mjs';
import './pan/ui/pan-modal.mjs';
```

---

### Components (`pan/components/`) - Feature-Rich Widgets

**Purpose:** Complex, production-ready components with substantial functionality.

**Components:**
- `pan-markdown-editor.mjs` - Full markdown IDE
- `pan-markdown-renderer.mjs` - Markdown parser/renderer
- `pan-files.mjs` - File system manager (OPFS)
- `pan-data-table.mjs` - Sortable, filterable table
- `pan-schema-form.mjs` - Schema-driven forms
- `pan-chart.mjs` - Data visualization
- `pan-date-picker.mjs` - Date selection
- `pan-theme-provider.mjs` - Theme management
- `pan-theme-toggle.mjs` - Theme switcher
- `pan-form.mjs` - Generic forms
- `todo-list.mjs` - Todo widget
- `drag-drop-list.mjs` - Sortable list
- Plus connectors and utilities...

**Characteristics:**
- Feature-rich
- Self-contained
- Production-ready
- Complex interactions

**When to use:** Need complete, ready-to-use functionality.

**Import example:**
```javascript
import './pan/components/pan-markdown-editor.mjs';
import './pan/components/pan-files.mjs';
```

---

### Data (`pan/data/`) - State Management

**Purpose:** Components that manage application state and persistence.

**Components:**
- `pan-invoice-store.mjs` - Invoice state management

**Characteristics:**
- No UI (pure logic)
- Manages state
- Handles persistence (localStorage, IndexedDB)
- Coordinates via PAN bus

**When to use:** Need centralized state management for your application.

**Import example:**
```javascript
import './pan/data/pan-invoice-store.mjs';
```

---

### App (`pan/app/`) - Domain-Specific Components

**Purpose:** Components built for specific applications, not intended for general reuse.

**Structure:**
```
app/
├── invoice/
│   ├── pan-invoice-header.mjs
│   ├── pan-invoice-items.mjs
│   └── pan-invoice-totals.mjs
└── devtools/
    ├── pan-inspector.mjs
    ├── pan-demo-viewer.mjs
    └── pan-demo-nav.mjs
```

**Characteristics:**
- Tightly coupled to specific apps
- Contains domain logic
- Not intended for reuse
- May depend on other app components

**When to use:** Building application-specific features.

**Import example:**
```javascript
import './app/invoice/pan-invoice-header.mjs';
import './app/devtools/pan-inspector.mjs';
```

---

### Apps (`apps/`) - Demo Applications

**Purpose:** Complete, working applications that demonstrate PAN usage.

**Applications:**
- `invoice.html` - Invoice creator
- `markdown-notes.html` - Markdown editor
- `data-browser.html` - Data visualization
- `contact-manager.html` - Contact management

**When to use:** Reference implementations, learning, templates.

---

## Migration from Old Structure

### Old vs New Paths

| Old Path | New Path | Category |
|----------|----------|----------|
| `components/pan-bus.mjs` | `pan/core/pan-bus.mjs` | Core |
| `components/pan-client.mjs` | `pan/core/pan-client.mjs` | Core |
| `components/pan-autoload.mjs` | `pan/core/pan-autoload.mjs` | Core |
| `components/pan-card.mjs` | `pan/ui/pan-card.mjs` | UI |
| `components/pan-modal.mjs` | `pan/ui/pan-modal.mjs` | UI |
| `components/pan-markdown-editor.mjs` | `pan/components/pan-markdown-editor.mjs` | Components |
| `components/pan-files.mjs` | `pan/components/pan-files.mjs` | Components |
| `components/pan-invoice-store.mjs` | `pan/data/pan-invoice-store.mjs` | Data |
| `components/pan-invoice-header.mjs` | `pan/app/invoice/pan-invoice-header.mjs` | App |
| `components/pan-inspector.mjs` | `pan/app/devtools/pan-inspector.mjs` | App |
| `demo-apps/` | `apps/` | Apps |

### Automated Migration

All import paths have been automatically updated in:
- HTML files in `apps/`, `examples/`, and root
- JavaScript/module files throughout the project
- Documentation and README files

**No action needed** - your existing code will work with the new structure.

### Manual Migration (if needed)

If you have external projects using PAN:

```javascript
// Old
import { PanClient } from './components/pan-client.mjs';
import './components/pan-card.mjs';

// New
import { PanClient } from './pan/core/pan-client.mjs';
import './pan/ui/pan-card.mjs';
```

---

## Decision Criteria

**When creating a new component, where does it go?**

### Core
- Required for PAN to function
- No dependencies
- Used by everything

### UI
- Single, focused purpose
- Reusable across many projects
- Simple, lightweight
- Few or no dependencies

### Components
- Complex functionality
- Multiple features
- Production-ready widget
- May have dependencies

### Data
- No UI
- Manages state
- Handles persistence
- Coordinates via PAN

### App
- Built for specific application
- Tightly coupled to domain
- Not intended for reuse
- Contains business logic

---

## Benefits

### For Users
✅ **Easier to find** - Know where to look by complexity level
✅ **Clear purpose** - Each directory has a specific role
✅ **Better learning** - Progress from simple to complex
✅ **Faster onboarding** - Structure makes sense immediately

### For Contributors
✅ **Clear guidelines** - Know where to put new components
✅ **Organized codebase** - Easy to navigate
✅ **Separation of concerns** - Components have clear boundaries
✅ **Scalable** - Easy to add new categories

### For the Project
✅ **Better documentation** - Each layer documented separately
✅ **Dependency clarity** - Layers depend on lower layers only
✅ **Bundle optimization** - Import only what you need
✅ **Version management** - Can version layers independently

---

## Component Dependency Graph

```
Apps (apps/)
  ↓ uses
App Components (app/)
  ↓ uses
Data Layer (data/)
  ↓ uses
Complex Components (components/)
  ↓ uses
UI Building Blocks (ui/)
  ↓ uses
Core Infrastructure (core/)
```

---

## Best Practices

### Creating New Components

1. **Start simple** - Begin in `pan/ui/` if possible
2. **Promote when needed** - Move to `pan/components/` when complexity grows
3. **Keep app-specific separate** - Don't try to make everything reusable
4. **Document dependencies** - Be clear about what layer you depend on
5. **Use README** - Each directory has a README explaining its purpose

### Naming Conventions

- **Keep `pan-*` prefix** - All components maintain consistent naming
- **Organize by folder** - Structure shows purpose, not name
- **Use descriptive names** - Clear about functionality

### Import Patterns

```javascript
// Good - Import from appropriate layer
import { PanClient } from './pan/core/pan-client.mjs';
import './pan/ui/pan-card.mjs';
import './pan/components/pan-markdown-editor.mjs';

// Bad - Reaching across layers inappropriately
// (app component importing from another app)
import './pan/app/invoice/pan-invoice-header.mjs'; // from app/devtools/
```

---

## FAQ

**Q: Why not just keep everything in `pan/components/`?**

A: It was getting too large and hard to navigate. The layered structure makes it clear what's infrastructure vs. building blocks vs. complete widgets.

**Q: Can UI components use other UI components?**

A: Yes, UI components can compose other UI components. They should not depend on complex components though.

**Q: Can I put connectors (REST, GraphQL, etc.) in components/?**

A: Yes, connectors are feature-rich components even though they may not have UI.

**Q: What if a component could fit in multiple categories?**

A: Use these guidelines:
- Does it have UI? If no → `pan/data/`
- Is it simple and single-purpose? → `pan/ui/`
- Is it complex or feature-rich? → `pan/components/`
- Is it app-specific? → `pan/app/`

**Q: Will this break my existing code?**

A: No - all import paths have been automatically updated throughout the repository.

---

## Future Considerations

As the project grows, we may add:
- `integrations/` - Third-party integrations
- `adapters/` - Protocol adapters
- `providers/` - Data providers
- `layouts/` - Layout components
- `utilities/` - Shared utilities

---

## Resources

- Core README: `pan/core/README.md`
- UI README: `pan/ui/README.md`
- Components README: `pan/components/README.md`
- Data README: `pan/data/README.md`
- App README: `pan/app/README.md`
- Apps README: `apps/README.md`
- Main README: `README.md`

---

**Version:** 1.0.0 (October 2024)
