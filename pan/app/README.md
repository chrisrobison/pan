# Application Components

Domain-specific components built for particular applications. These components are tightly coupled to specific use cases and business logic.

## Structure

Application components are organized by application:

```
app/
├── invoice/         # Invoice application components
├── devtools/        # Developer tools components
└── ...              # Other application-specific components
```

## Invoice Application

**Location:** `app/invoice/`

Components for the invoice creator demo app:

### pan-invoice-header.mjs
Invoice header with from/to customer information.
- Contenteditable fields
- Customer selection integration
- Invoice metadata (number, dates)

### pan-invoice-items.mjs
Line items grid with automatic calculations.
- Contenteditable cells
- Auto-calculate totals (hours × rate)
- Click to add rows
- Delete items

### pan-invoice-totals.mjs
Invoice totals and calculations.
- Auto-updates from line items
- Editable tax rate
- Subtotal, tax, total calculations
- Notes/payment terms

**Data Management:** See `data/pan-invoice-store.mjs`

## DevTools Application

**Location:** `app/devtools/`

Components for developer tools and debugging:

### pan-inspector.mjs
Real-time PAN message inspector.
- Monitor all PAN messages
- Filter by topic
- View payload details
- Message history

### pan-demo-viewer.mjs
Component demo viewer with live code.
- Display component examples
- Live code editing
- Preview window

### pan-demo-nav.mjs
Navigation for demo pages.
- Example navigation
- Category filtering

## Design Philosophy

App components are:
- **Domain-specific** - Built for particular use cases
- **Tightly coupled** - May depend on other app components
- **Feature-complete** - Solve specific problems end-to-end
- **Not reusable** - Not intended for general use outside their app
- **Business logic** - Contain domain rules and workflows

## When to Create App Components

Create application-specific components when:
- Building a complete application/demo
- Need domain-specific functionality
- Components are tightly coupled to business logic
- Not intended for reuse across multiple apps
- Implementing specific workflows

## Difference from Other Components

| Directory | Purpose | Reusability | Complexity |
|-----------|---------|-------------|------------|
| `core/` | Infrastructure | Required | Low |
| `ui/` | Building blocks | High | Low |
| `components/` | Widgets | High | Medium-High |
| `data/` | State management | Medium | Medium |
| `app/` | Domain-specific | Low | Variable |

## Creating a New App

To create a new application:

1. Create a directory: `app/my-app/`
2. Add components specific to that app
3. Create corresponding demo in `apps/my-app.html`
4. Add data component in `data/` if needed

Example structure:
```
app/my-app/
├── pan-my-app-header.mjs
├── pan-my-app-sidebar.mjs
├── pan-my-app-content.mjs
└── pan-my-app-footer.mjs

data/
└── pan-my-app-store.mjs

apps/
└── my-app.html
```

## Dependencies

App components may depend on:
- Core: pan-bus, pan-client
- UI: Simple building blocks
- Components: Complex widgets
- Data: State management components
- Other app components in same directory

## Examples

See the full applications:
- `apps/invoice.html` - Invoice creator demo
- `apps/markdown-notes.html` - Markdown editor demo (uses components from `components/`)
- `demos.html` - Component gallery (uses devtools components)

## Guidelines

When creating app components:
- ✅ Use clear, descriptive names with app prefix
- ✅ Keep related components together in app directory
- ✅ Document dependencies and integration points
- ✅ Consider extracting reusable parts to `components/`
- ✅ Use PAN bus for component communication
- ❌ Don't try to make them generic (that's what `components/` is for)
- ❌ Don't mix multiple apps in one directory
