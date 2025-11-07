# Repository Guidelines

## Project Structure & Module Organization
- `README.md`: overview, quickstart, API, and recipes.
 - `LARC_SPEC.v0.md`: draft spec, architecture, and compliance notes.
- `examples/`: single‑file HTML demos runnable directly in a browser.
- `demo.html`: compact reference/mini‑demo of the bus and client.
- No build system; artifacts (if produced) would live under `dist/`.

## Build, Test, and Development Commands
- Run locally: open `examples/01-hello.html` or `demo.html` in a browser.
- Static server (optional): `python3 -m http.server 8080` → visit `http://localhost:8080/examples/`.
- No bundler required: use `<script type="module">` with ESM.

## Coding Style & Naming Conventions
- Indentation: 2 spaces; keep modules small and readable.
- JavaScript: modern ESM, `const`/`let`, avoid transpilers and globals.
- Custom elements: kebab‑case tags (e.g., `pan-bus`, `pan-inspector`).
- Topics: dotted lowercase with optional `@version` (e.g., `todos.change`, `user.update@2`).
- Events: dispatch PAN events with `{ bubbles:true, composed:true }` so they cross shadow DOM.

## Testing Guidelines
- Manual smoke tests via `examples/*`:
  - `02-todos-and-inspector.html`: add/remove/toggle; inspector shows traffic and retained state.
  - `03-broadcastchannel.html`: open two tabs; confirm mirrored topics sync.
 - Future automation: compliance tests (Web Test Runner/Playwright) as outlined in `LARC_SPEC.v0.md`.

## Commit & Pull Request Guidelines
- Commits: follow Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`). Keep scope focused.
- PRs: include a clear description, linked issues, and screenshots/GIFs for example UI changes. Update `README.md`/`examples/` when behavior changes.
- Checks: verify in at least one Chromium‑based browser and Firefox; ensure examples still open from `file://` and via a static server.

## Security & Configuration Tips
- Mirror only explicit topics across tabs; avoid sensitive data in mirrored channels.
- Message payloads must be JSON‑serializable; keep sizes small and use headers for schema/version when needed.
