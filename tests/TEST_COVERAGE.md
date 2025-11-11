# LARC Test Coverage Report

Comprehensive automated coverage now spans every published PAN component.

## Test Statistics

- **Total Components**: 51
- **Components with Tests**: 51
- **Test Files Created**: 120+
- **Coverage**: **100%** (up from 56%)
- **Playwright Suites**: 90+ browser-driven specs exercising production builds

## Coverage Highlights

### 🔁 Core & Bus Infrastructure
- ✅ `pan-bus`, `pan-bus-enhanced`, and **new** `pan-bus-legacy` suites confirm wildcard delivery, retained snapshots, and legacy compatibility.
- ✅ `pan-client` request/reply flows and helper utilities validated end-to-end.
- ✅ `pan-autoload` verified for lazy-loading and module resolution.

### 🔐 Authentication & Security
- ✅ **New** suites for `pan-auth` and `pan-jwt` cover login, logout, refresh, and retained state publishing.
- ✅ **New** `pan-fetch` tests assert automatic credential inclusion and Authorization header injection when tokens are present.
- ✅ **New** security utility coverage for `pan-security` (HTTPS enforcement, DOMPurify integration, URL validation) and `pan-validation` (topic, pattern, and payload guards).
- ✅ Markdown rendering hardening with `_sanitizeUrl` verified to block `javascript:` and `data:` protocols for both links and images.

### 🧰 Inspector & Developer Tooling
- ✅ **New** `pan-inspector` suite exercises message streaming, filtering, pause/resume, and replay features inside the shadow DOM.
- ✅ Developer-focused helpers (`drag-drop-list`, `pan-forwarder`, `pan-store-pan`, etc.) remain fully covered.

### 📊 Feature & UI Components
- ✅ All data providers, query orchestration, tables, forms, pagination, charts, date pickers, markdown editor/renderer, and theme utilities maintain passing coverage.
- ✅ Connectors (`pan-graphql-connector`, `pan-websocket`, `pan-sse`, `pan-worker`, `pan-php-connector`, `pan-forwarder`) continue to run through simulated transport scenarios.

## Recent Additions

| Component / Module            | Focus Areas Tested                                 |
| ----------------------------- | -------------------------------------------------- |
| `pan-auth`                    | login, logout, retained `auth.state` publishing    |
| `pan-jwt`                     | credential storage, manual refresh, logout events  |
| `pan-fetch`                   | credential propagation, Authorization header guard |
| `pan-inspector`               | message rendering, filtering, replay               |
| `pan-bus-legacy`             | ready event, wildcard routing, retained delivery   |
| `pan-security`                | HTTPS enforcement, DOMPurify fallback, safe URLs   |
| `pan-validation`              | topic/pattern limits, payload validation, redaction|

## Running the Suite

```bash
# start the local test server and run every Playwright suite
npm test

# run a single spec
node tests/lib/run-tests-with-server.mjs tests/components/pan-auth.test.mjs
```

## Next Steps

- Monitor CI duration as full coverage now exercises 90+ browser contexts; parallelize when necessary.
- Expand multi-browser runs (Firefox/Safari) for parity with Chrome coverage.
- Continue to surface security regressions via targeted negative tests in authentication modules.

All new suites are part of the default Playwright runner and execute against the same zero-build artifacts shipped in `dist/`.
