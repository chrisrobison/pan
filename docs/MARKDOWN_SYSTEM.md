## PAN Markdown System

A complete markdown editing and file management system built with PAN components. Create, edit, and manage markdown documents with a rich editing experience and persistent storage.

## Components

### 1. `<pan-markdown-renderer>`

Renders markdown content to styled HTML.

**Features:**
- Complete GitHub-flavored markdown support
- Tables, task lists, code blocks
- Syntax highlighting
- Blockquotes, links, images
- Safe HTML sanitization
- Customizable styling via CSS variables

**Usage:**
```html
<pan-markdown-renderer content="# Hello World

This is **bold** and *italic*."></pan-markdown-renderer>
```

**Attributes:**
- `content`: Markdown content to render
- `sanitize`: Enable HTML sanitization (default: true)

**Public API:**
```javascript
const renderer = document.querySelector('pan-markdown-renderer');

// Set content
renderer.setContent('# New Content');

// Get rendered HTML
const html = renderer.getHtml();
```

**PAN Events:**
- Subscribes: `markdown.render` - Trigger render with content

**Supported Markdown:**
- Headers: `# H1` through `###### H6`
- Bold: `**bold**` or `__bold__`
- Italic: `*italic*` or `_italic_`
- Strikethrough: `~~strikethrough~~`
- Links: `[text](url)`
- Images: `![alt](url)`
- Code: `` `inline` `` or ` ``` code blocks ``` `
- Lists: `- unordered` or `1. ordered`
- Task lists: `- [ ] task` or `- [x] done`
- Blockquotes: `> quote`
- Tables: `| col1 | col2 |`
- Horizontal rules: `---`, `***`, or `___`

---

### 2. `<pan-markdown-editor>`

Rich markdown editor with formatting toolbar and live preview.

**Features:**
- Visual formatting toolbar
- Keyboard shortcuts (Ctrl+B, Ctrl+I, Ctrl+K, etc.)
- Live preview toggle
- Auto-indent for lists
- Tab support
- Word/character count
- Auto-save support
- Natural editing experience

**Usage:**
```html
<pan-markdown-editor
  value="# Start writing..."
  preview="true"
  autosave="false"
  placeholder="Your content here...">
</pan-markdown-editor>
```

**Attributes:**
- `value`: Initial markdown content
- `placeholder`: Placeholder text (default: "Start writing...")
- `preview`: Show split preview panel (default: false)
- `autosave`: Enable auto-save events (default: false)

**Toolbar Actions:**
- **Bold** (`Ctrl+B`): `**text**`
- **Italic** (`Ctrl+I`): `*text*`
- **Strikethrough**: `~~text~~`
- **H1/H2/H3**: Insert heading
- **Bullet List**: Insert `* item`
- **Numbered List**: Insert `1. item`
- **Task List**: Insert `- [ ] task`
- **Link** (`Ctrl+K`): Insert `[text](url)`
- **Image**: Insert `![alt](url)`
- **Code**: Insert `` `code` ``
- **Code Block**: Insert ` ``` block ``` `
- **Quote**: Insert `> quote`
- **Horizontal Rule**: Insert `---`
- **Table**: Insert table template
- **Preview**: Toggle preview pane

**Keyboard Shortcuts:**
- `Ctrl/Cmd + B`: Bold
- `Ctrl/Cmd + I`: Italic
- `Ctrl/Cmd + K`: Insert link
- `Ctrl/Cmd + S`: Save (if autosave enabled)
- `Tab`: Insert spaces (not lost to browser)
- `Enter`: Auto-continue lists

**Public API:**
```javascript
const editor = document.querySelector('pan-markdown-editor');

// Get/Set content
editor.setValue('# New content');
const content = editor.getValue();

// Insert text at cursor
editor.insertText('inserted text');

// Focus editor
editor.focus();
```

**PAN Events:**
- Publishes:
  - `markdown.changed`: `{ content, wordCount, charCount }`
  - `markdown.saved`: `{ content }` (when autosave triggers)
- Subscribes:
  - `markdown.set-content`: Set editor content
  - `markdown.get-content`: Request current content (responds with `markdown.content-response`)

---

### 3. `<pan-files>`

File system manager for browser's Origin Private File System (OPFS).

**Features:**
- List files and directories
- Create/rename/delete operations
- File filtering by extension
- Search functionality
- Read/write file contents
- Persistent storage (survives page refresh)
- No permission prompts (OPFS is origin-private)
- Drag-friendly interface

**Usage:**
```html
<pan-files
  path="/"
  filter=".md,.txt"
  show-hidden="false">
</pan-files>
```

**Attributes:**
- `path`: Current directory path (default: "/")
- `filter`: Comma-separated file extensions (e.g., ".md,.txt")
- `show-hidden`: Show files starting with "." (default: false)

**Public API:**
```javascript
const files = document.querySelector('pan-files');

// File operations
await files.writeFile('/document.md', '# Content');
const content = await files.readFile('/document.md');
await files.deleteFile('/document.md');

// Get file list
const fileList = await files.listFiles();

// Refresh display
await files.refresh();
```

**PAN Events:**
- Publishes:
  - `file.selected`: `{ path, name, isDirectory }`
  - `file.created`: `{ path, name }`
  - `file.deleted`: `{ path }`
  - `file.renamed`: `{ oldPath, newPath }`
  - `file.content-loaded`: `{ path, content }`
- Subscribes:
  - `file.save`: `{ path, content }`
  - `file.load`: `{ path }` (triggers `file.content-loaded`)
  - `file.delete`: `{ path }`
  - `file.create`: `{ path, content }`

**OPFS Details:**
- Storage: Origin Private File System (part of File System Access API)
- Permissions: No user prompts required
- Persistence: Survives browser restarts
- Isolation: Sandboxed per origin
- Quota: Subject to browser storage quotas
- Support: Chrome 86+, Edge 86+, Safari 15.2+, Firefox (partial)

---

## Demo App: Markdown Notes

A full-featured markdown note-taking application.

**Features:**
- ✍️ Rich markdown editing with toolbar
- 👁️ Live preview toggle
- 💾 Persistent file storage (OPFS)
- 📂 File browser sidebar
- 🎨 Light/dark mode support
- ⌨️ Keyboard shortcuts
- ⚡ Auto-save support
- 📤 Export to file

**File:** `demo-apps/markdown-notes.html`

**Keyboard Shortcuts:**
- `Ctrl/Cmd + S`: Save current file
- `Ctrl/Cmd + N`: Create new file
- `Ctrl/Cmd + B`: Toggle sidebar
- Editor shortcuts (Bold, Italic, etc.) also work

---

## Integration Examples

### Example 1: Simple Renderer

```html
<pan-markdown-renderer content="# Hello World"></pan-markdown-renderer>

<script type="module">
  import './components/pan-markdown-renderer.mjs';
</script>
```

### Example 2: Editor with Auto-Save

```html
<pan-markdown-editor
  value="# My Document"
  preview="true"
  autosave="true">
</pan-markdown-editor>

<script type="module">
  import './components/pan-markdown-editor.mjs';
  import './components/pan-markdown-renderer.mjs';

  const bus = document.querySelector('pan-bus');

  // Listen for auto-saves
  bus.subscribe('markdown.saved', (data) => {
    console.log('Auto-saved:', data.content.length, 'characters');
    // Save to backend, localStorage, etc.
  });
</script>
```

### Example 3: File Manager with Editor

```html
<div style="display: grid; grid-template-columns: 300px 1fr; gap: 1rem;">
  <pan-files filter=".md"></pan-files>
  <pan-markdown-editor preview="true"></pan-markdown-editor>
</div>

<script type="module">
  import './components/pan-files.mjs';
  import './components/pan-markdown-editor.mjs';

  const bus = document.querySelector('pan-bus');
  const files = document.querySelector('pan-files');
  const editor = document.querySelector('pan-markdown-editor');

  let currentFile = null;

  // Load file when selected
  bus.subscribe('file.selected', async (data) => {
    if (!data.isDirectory) {
      const content = await files.readFile(data.path);
      editor.setValue(content);
      currentFile = data.path;
    }
  });

  // Save on editor change
  bus.subscribe('markdown.changed', async (data) => {
    if (currentFile) {
      await files.writeFile(currentFile, data.content);
    }
  });
</script>
```

### Example 4: Custom Toolbar Integration

```html
<div>
  <button onclick="insertTemplate()">Insert Template</button>
  <button onclick="exportMarkdown()">Export</button>
  <pan-markdown-editor id="editor"></pan-markdown-editor>
</div>

<script>
  function insertTemplate() {
    const editor = document.getElementById('editor');
    const template = `# Project Name

## Overview

Brief description here.

## Features

- Feature 1
- Feature 2

## Installation

\`\`\`bash
npm install
\`\`\`
`;
    editor.setValue(template);
  }

  function exportMarkdown() {
    const editor = document.getElementById('editor');
    const content = editor.getValue();
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.md';
    a.click();
  }
</script>
```

---

## Styling & Customization

### CSS Variables

All components respect theme CSS variables:

```css
:root {
  /* Text colors */
  --color-text: #1e293b;
  --color-text-muted: #64748b;

  /* Background colors */
  --color-surface: #ffffff;
  --color-bg-alt: #f8fafc;

  /* Primary color */
  --color-primary: #006699;
  --color-primary-soft: #e0f2fe;

  /* Code blocks */
  --color-code-bg: #1e293b;
  --color-code-text: #e2e8f0;

  /* Borders */
  --color-border: #e2e8f0;

  /* Typography */
  --font-mono: 'Courier New', monospace;
  --font-sans: system-ui, sans-serif;
}
```

### Custom Renderer Styles

Override markdown rendering styles in your CSS:

```css
pan-markdown-renderer::part(markdown-body) {
  font-size: 1.1rem;
  line-height: 1.8;
}

/* Note: Shadow DOM styles are encapsulated.
   Use CSS variables instead for theming. */
```

---

## Architecture

### Component Communication

```
User Action → Editor → PAN Event → File Manager → OPFS
                 ↓                        ↓
            UI Update ← PAN Event ← Save Complete
```

### Data Flow Example

1. User edits markdown in editor
2. Editor emits `markdown.changed` via PAN
3. App saves content via `file.save` PAN event
4. Files component writes to OPFS
5. Files component emits `file.content-loaded`
6. App updates UI state

### Event-Driven Architecture

All components are loosely coupled via PAN:

```javascript
// Component A (Editor)
bus.publish('markdown.changed', { content });

// Component B (Auto-saver)
bus.subscribe('markdown.changed', (data) => {
  localStorage.setItem('backup', data.content);
});

// Component C (Analytics)
bus.subscribe('markdown.changed', (data) => {
  trackUsage({ words: data.wordCount });
});
```

---

## Browser Support

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Markdown Renderer | ✅ 90+ | ✅ 88+ | ✅ 14+ | ✅ 90+ |
| Markdown Editor | ✅ 90+ | ✅ 88+ | ✅ 14+ | ✅ 90+ |
| OPFS (pan-files) | ✅ 86+ | ⚠️ Partial | ✅ 15.2+ | ✅ 86+ |

**Requirements:**
- ES6 Modules
- Web Components (Custom Elements, Shadow DOM)
- File System Access API (for pan-files)
- CSS Custom Properties

---

## Performance

### Renderer
- Fast parsing (pure JS, no dependencies)
- Efficient re-renders (only updates changed content)
- < 5KB gzipped

### Editor
- Lightweight (< 8KB gzipped)
- Debounced auto-save prevents excessive writes
- Efficient shadow DOM updates

### Files
- OPFS is fast (direct file system access)
- Lazy loading (files loaded on demand)
- Efficient directory traversal

---

## Security

### Markdown Rendering
- HTML sanitization enabled by default
- No script execution from user content
- Safe rendering in shadow DOM

### File System
- OPFS is origin-isolated (sandboxed)
- No access to user's actual file system
- No permission prompts needed
- Quota-limited (prevents abuse)

### XSS Protection
- Content is sanitized before rendering
- Event handlers stripped from markdown
- Shadow DOM isolation

---

## Troubleshooting

### "OPFS not supported"
- Check browser version (need Chrome 86+, Safari 15.2+)
- Ensure HTTPS (required for OPFS)
- Check Feature Policy headers

### Files not persisting
- Check available storage quota
- Verify OPFS is enabled in browser
- Clear site data if corrupted

### Editor lag with large files
- Files > 100KB may cause slowdown
- Consider pagination or virtual scrolling
- Disable live preview for very large documents

### Markdown not rendering correctly
- Check console for errors
- Verify markdown syntax
- Test with simple content first

---

## Examples

See `examples/markdown-components.html` for interactive demonstrations of:
- Basic rendering
- Editor with toolbar
- File management
- Integrated editor + files
- Programmatic control

---

## Future Enhancements

Potential additions:

1. **Collaborative editing** - Real-time multi-user editing via WebRTC
2. **Version history** - Track document changes over time
3. **Plugin system** - Custom markdown extensions
4. **Cloud sync** - Optional backend synchronization
5. **PDF export** - Export to PDF directly from browser
6. **Image upload** - Drag-drop image support
7. **Vim/Emacs modes** - Advanced editing modes
8. **Folder navigation** - Multi-level directory support
9. **Git integration** - Commit changes to Git
10. **Search & replace** - Advanced find/replace

---

## Resources

- [Markdown Guide](https://www.markdownguide.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API)
- [Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components)
- [PAN Documentation](../README.md)

---

## License

Part of the PAN (Page Area Network) project - MIT License
