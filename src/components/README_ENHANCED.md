# PAN Core: Basic vs Enhanced

This directory contains two versions of the PAN bus:

## 🔹 `pan-bus.mjs` - Basic Bus

**Best for:** Prototypes, demos, learning

**Features:**
- ✅ Lightweight (~290 LOC)
- ✅ Zero dependencies
- ✅ Simple API
- ✅ Fast (300k+ msg/sec)

**Limitations:**
- ⚠️ No memory limits
- ⚠️ No rate limiting
- ⚠️ No validation
- ⚠️ Manual cleanup required

```html
<script type="module" src="./pan-bus.mjs"></script>
<pan-bus></pan-bus>
```

---

## 🔸 `pan-bus-enhanced.mjs` - Enhanced Bus

**Best for:** Production, enterprise, security-sensitive apps

**Features:**
- ✅ Memory-bounded (LRU eviction)
- ✅ Rate limiting (per-client)
- ✅ Message validation
- ✅ Automatic cleanup
- ✅ Security policies
- ✅ Debug mode
- ✅ Statistics API
- ✅ Error reporting

```html
<script type="module" src="./pan-bus-enhanced.mjs"></script>
<pan-bus-enhanced
  max-retained="1000"
  rate-limit="1000"
  allow-global-wildcard="false">
</pan-bus-enhanced>
```

---

## Quick Comparison

| Feature | Basic | Enhanced |
|---------|-------|----------|
| Size | 290 LOC | 640 LOC |
| Memory Safe | ❌ | ✅ |
| Rate Limiting | ❌ | ✅ |
| Validation | ❌ | ✅ |
| Auto Cleanup | ❌ | ✅ |
| Security Policies | ❌ | ✅ |
| Statistics | ❌ | ✅ |
| Debug Mode | ❌ | ✅ |
| Configuration | ❌ | ✅ (attributes) |
| Performance | 300k/sec | 285k/sec |
| Drop-in Replace | - | ✅ |

---

## When to Use Each

### Use Basic Bus When:
- 🎓 Learning PAN
- 🚀 Rapid prototyping
- 📝 Simple demos
- 🏃 Maximum performance needed
- 💡 Memory usage controlled by app

### Use Enhanced Bus When:
- 🏢 Production deployment
- 🔒 Security-sensitive data
- 📊 Need monitoring/metrics
- 💾 Long-running applications
- 🛡️ Untrusted components
- 🌐 Enterprise environments

---

## Migration

**It's a drop-in replacement!**

```html
<!-- Change this: -->
<pan-bus></pan-bus>

<!-- To this: -->
<pan-bus-enhanced></pan-bus-enhanced>
```

No code changes required. See [MIGRATION_ENHANCED.md](../../docs/MIGRATION_ENHANCED.md) for details.

---

## Additional Files

- **`pan-client.mjs`** - Works with both buses
- **`pan-autoload.mjs`** - Component auto-loader
- **`pan-validation.mjs`** - Shared validation utilities
- **`pan-auth.mjs`** - Authentication helpers
- **`pan-fetch.mjs`** - Fetch utilities

---

## Documentation

- [Security Guide](../../docs/SECURITY.md)
- [Migration Guide](../../docs/MIGRATION_ENHANCED.md)
- [API Reference](../../docs/API_REFERENCE.md)
- [Performance Benchmarks](../../docs/PERFORMANCE.md)

---

## Examples

- **Basic:** `examples/01-hello.html`
- **Enhanced:** `examples/17-enhanced-security.html`

---

## Questions?

- 📖 [Full Documentation](../../docs/)
- 🐛 [Report Issues](https://github.com/youruser/pan/issues)
- 💬 [Discussions](https://github.com/youruser/pan/discussions)
