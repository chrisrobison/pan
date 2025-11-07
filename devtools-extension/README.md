# PAN Inspector - Chrome DevTools Extension

Professional debugging and inspection tool for Page Area Network (PAN) message bus.

![PAN Inspector Screenshot](screenshot.png)

## Features

### 🔍 **Real-Time Message Monitoring**
- Captures all PAN messages (publish, deliver, subscribe)
- Shows message details: topic, data, timestamp, target, size
- Color-coded message types for quick identification

### 🎯 **Powerful Filtering**
- Filter by topic, type, or data content
- Toggle message types on/off
- Search across all message properties

### 📊 **Message Inspector**
- Detailed view of message payload
- JSON formatting with syntax highlighting
- Copy message as JSON

### 🔄 **Message Replay**
- Replay any captured message
- Perfect for debugging and testing
- Works with live applications

### 💾 **Export/Import**
- Export message logs as JSON
- Import logs for analysis
- Share debugging sessions with team

### ⏸️ **Recording Control**
- Pause/resume message capture
- Clear message history
- Real-time message counter

---

## Installation

### From Source (Development)

1. **Clone the repository:**
   ```bash
   cd /Users/cdr/Projects/pan
   ```

2. **Open Chrome Extensions:**
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right)

3. **Load extension:**
   - Click "Load unpacked"
   - Select the `devtools-extension/` folder

4. **Verify installation:**
   - Open Chrome DevTools (F12)
   - Look for the "PAN" tab

### From Chrome Web Store (Coming Soon)

Once published, install directly from the Chrome Web Store.

---

## Usage

### Basic Usage

1. **Open DevTools** on any page with PAN bus:
   ```
   F12 or Right-click → Inspect
   ```

2. **Switch to PAN tab:**
   ```
   DevTools → PAN (tab)
   ```

3. **Interact with the page:**
   - Messages appear in real-time
   - Click any message to see details

### Features Walkthrough

#### Filtering Messages

**Text Search:**
```
Type in filter box: "user.login"
→ Shows only messages matching "user.login"
```

**By Type:**
```
Uncheck "Publish" → Hides all publish events
Uncheck "Subscribe" → Hides all subscribe events
```

**Combined:**
```
Search "error" + Uncheck "Deliver"
→ Shows only publish/subscribe with "error" in data
```

#### Viewing Message Details

1. Click any message row
2. Details panel opens on right
3. See:
   - Complete message structure
   - Formatted JSON payload
   - Message metadata

#### Replaying Messages

**From table:**
```
Click "Replay" button → Message sent again
```

**From details panel:**
```
1. Select message
2. Click "Replay Message"
3. Message dispatched on page
```

**Use Case:**
```
Test how components handle specific messages
without needing to trigger the action again
```

#### Export/Import

**Export:**
```
1. Click "Export" button
2. Save JSON file
3. Share with team or keep for records
```

**Import:**
```
1. Click "Import" button
2. Select JSON file
3. Messages loaded into inspector
```

**Use Case:**
```
- Reproduce bugs from production logs
- Share debugging sessions
- Compare message flows
```

---

## Examples

### Debugging a Login Flow

1. Open PAN Inspector
2. Clear messages
3. Perform login
4. Filter by "user" to see login-related messages
5. Inspect `user.login` message payload
6. Verify authentication data

### Testing Error Handling

1. Capture an error message
2. Export to JSON file
3. Modify payload to test edge cases
4. Import modified messages
5. Replay to component

### Performance Analysis

1. Monitor message frequency
2. Check message sizes
3. Identify bottlenecks
4. Look for unexpected message storms

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + K` | Focus filter input |
| `Ctrl/Cmd + L` | Clear messages |
| `Esc` | Close details panel |
| `Space` | Pause/Resume recording |

---

## Troubleshooting

### "No messages appearing"

**Check:**
1. ✅ Page uses `<pan-bus>` or `<pan-bus-enhanced>`
2. ✅ Components are publishing messages
3. ✅ Recording is not paused
4. ✅ Filters are not hiding messages

**Solution:**
```javascript
// Test in console
import { PanClient } from './pan/core/pan-client.mjs';
const client = new PanClient();
client.publish({ topic: 'test', data: { hello: 'world' } });
// Should appear in PAN Inspector
```

### "Replay not working"

**Check:**
1. ✅ Content script is injected
2. ✅ Page has PAN bus
3. ✅ Message is valid

**Debug:**
```
Check console for errors
Look for "PAN DevTools" messages
```

### "Extension not loading"

**Check:**
1. ✅ Chrome version 88+ (Manifest V3)
2. ✅ All files present in extension folder
3. ✅ No errors in `chrome://extensions/`

**Solution:**
```
Reload extension:
chrome://extensions/ → Click reload icon
```

---

## Architecture

### Message Flow

```
Page Context (PAN Bus)
   ↓ (CustomEvent intercept)
Injected Script (src/injected.js)
   ↓ (postMessage)
Content Script (src/content-script.js)
   ↓ (chrome.runtime.sendMessage)
Background Service Worker (src/background.js)
   ↓ (port.postMessage)
DevTools Panel (panel.html/js)
   ↓ (Render)
User Interface
```

### Files Overview

```
devtools-extension/
├── manifest.json          # Extension config (Manifest V3)
├── devtools.html/js       # DevTools entry point
├── panel.html             # Main UI
├── src/
│   ├── devtools.js        # Panel creator
│   ├── background.js      # Message router
│   ├── content-script.js  # Bridge script
│   ├── injected.js        # Page context interceptor
│   └── panel.js           # UI logic
├── styles/
│   └── panel.css          # DevTools-style UI
└── icons/
    └── icon-*.png         # Extension icons
```

---

## Development

### Building

No build step required! Pure JavaScript.

### Testing

1. Make changes to source files
2. Reload extension: `chrome://extensions/` → Reload
3. Reload DevTools panel: Right-click panel → Reload
4. Test with `examples/17-enhanced-security.html`

### Debugging

**Background script:**
```
chrome://extensions/ → Inspect views: service worker
```

**Content script:**
```
DevTools → Console → Filter: [PAN DevTools]
```

**Panel:**
```
Right-click PAN tab → Inspect
```

### Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Test thoroughly
5. Submit pull request

---

## Roadmap

### v1.1
- [ ] Timeline view (visual message flow)
- [ ] Performance metrics
- [ ] Message stats dashboard
- [ ] Dark mode toggle

### v1.2
- [ ] Network waterfall view
- [ ] Message diff tool
- [ ] Breakpoints on topics
- [ ] Advanced filters (regex, JSON path)

### v1.3
- [ ] Record/replay sessions
- [ ] Test generation from recordings
- [ ] Playwright integration
- [ ] Export to HAR format

---

## Known Issues

1. **Messages before DevTools open** - Can't capture messages sent before DevTools opens (by design)
2. **Large message counts** - UI slows down with 10,000+ messages (limited to last 1,000 rendered)
3. **Cross-origin iframes** - Can't inspect messages in cross-origin iframes (security restriction)

---

## Browser Support

- ✅ Chrome 88+ (Manifest V3)
- ✅ Edge 88+ (Chromium-based)
- ⏳ Firefox (Coming soon - needs Manifest V2 version)
- ❌ Safari (Not supported - WebExtensions API differences)

---

## Privacy

This extension:
- ✅ Does **NOT** collect any data
- ✅ Does **NOT** make external network requests
- ✅ Does **NOT** track usage
- ✅ Only runs on pages you inspect
- ✅ All data stays local in DevTools

---

## License

MIT License - Same as PAN framework

---

## Credits

Built with ❤️ by the PAN team

Inspired by:
- Chrome DevTools Network panel
- Redux DevTools
- Vue DevTools

---

## Support

- 📖 [Documentation](../docs/)
- 🐛 [Report Issue](https://github.com/youruser/pan/issues)
- 💬 [Discussions](https://github.com/youruser/pan/discussions)
- 📧 [Email](mailto:support@pan.dev)

---

## Quick Start Example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>PAN Inspector Test</title>
</head>
<body>
  <script type="module" src="../src/components/pan-bus.mjs"></script>
  <script type="module" src="../src/components/pan-client.mjs"></script>

  <pan-bus></pan-bus>

  <button id="test-btn">Send Test Message</button>

  <script type="module">
    import { PanClient } from '../src/components/pan-client.mjs';

    const client = new PanClient();
    await client.ready();

    document.getElementById('test-btn').onclick = () => {
      client.publish({
        topic: 'test.click',
        data: { timestamp: Date.now() }
      });
    };

    // Subscribe to see it work
    client.subscribe('test.*', (msg) => {
      console.log('Received:', msg);
    });
  </script>
</body>
</html>
```

1. Save as `test.html`
2. Open in Chrome
3. Open DevTools → PAN tab
4. Click "Send Test Message"
5. See message appear in inspector!

---

**Enjoy debugging with PAN Inspector!** 🚀
