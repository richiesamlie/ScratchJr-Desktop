# ScratchJr Desktop

> A modernized desktop port of [ScratchJr](https://scratchjr.org/) for Windows, macOS, and Linux — maintained through **Vibe Coding**.

## Official Disclaimer

Scratch and ScratchJr are trademarks of Massachusetts Institute of Technology, which does not sponsor, endorse, or authorize this content. See [scratchjr.org](https://scratchjr.org) for more information.

## Downloads

**[Download ScratchJr for Desktop (latest release)](https://github.com/richiesamlie/ScratchJr-Desktop/releases/latest)**

| File | Platform |
|------|----------|
| `ScratchJr-win32-x64.zip` | Windows x64 |
| `ScratchJr-darwin-x64.zip` | macOS x64 |
| `ScratchJr-darwin-arm64.zip` | macOS ARM64 |
| `ScratchJr-linux-x64.zip` | Linux x64 |
| `ScratchJr-linux-arm64.zip` | Linux ARM64 |

Each release includes SHA256 checksums (`.sha256` files) for integrity verification.

---

## What's Different from the Original

This is a **complete modernization** of the original [JustSch/ScratchJr-Desktop](https://github.com/JustSch/ScratchJr-Desktop) fork. The app looks the same to users, but the internals have been rebuilt from the ground up.

### v1.4.0 — Full Modernization (8 Phases)

| Area | Before | After |
|------|--------|-------|
| **Electron** | 22 | 42.8.1 (Chromium 134) |
| **Node compatibility** | Broken on Node 22+ | Node 22/26 compatible |
| **IPC** | Synchronous `sendSync` (renderer freezes) | Async `invoke`/`handle` (all 18 channels) |
| **Security** | `nodeIntegration: true`, no CSP | `sandbox: true`, CSP on all pages, SQL validation |
| **Main process** | 1,122-line monolith | 94-line orchestrator + 5 focused modules |
| **Renderer** | Global vendor scripts, no bundler | esbuild bundler, explicit ESM imports |
| **Tests** | None | 80 tests (vitest) covering IPC, SQL, paths, layout |
| **CI** | Broken lint, no checksums | Lint + test + SHA256 checksums + version verification |
| **Vulnerabilities** | 26 known | 0 |
| **CSS** | WebKit-only prefixes | Standard CSS with `-webkit-` only where required |

### Security Hardening

- **Content Security Policy** on all HTML pages
- **Sandboxed renderer** — `nodeIntegration: false`, `contextIsolation: true`, `sandbox: true`
- **Preload bridge** — only named IPC operations exposed, no raw `ipcRenderer`
- **SQL validation** — allowlisted verbs, parameterized queries, no multi-statement payloads
- **Navigation restrictions** — file:// only within app root
- **Permission policy** — camera/microphone only, all other requests blocked
- **Window open handler** — all new window creation denied

### Architecture

```
src/main.js (94 lines)  ← orchestrator: crash handlers, dependency wiring, app lifecycle
  ├── src/main/logging.js        — structured logging, debug flags
  ├── src/main/database.js       — SQL.js DatabaseManager class
  ├── src/main/data-store.js     — project storage, media cache, path validation
  ├── src/main/window-lifecycle.js — BrowserWindow, security, close handshake
  └── src/main/ipc-handlers.js   — all 19 IPC channels

src/preload.js            — contextBridge API (invoke-based)
src/electronClient.js     — renderer adapter (async methods)
src/app/                  — bundled renderer (esbuild)
  ├── appEntry.js         — async page bootstrap
  ├── src/utils/lib.js    — async CSS preprocessing
  └── src/iPad/iOS.js     — tabletInterface bridge (async)
```

### Bug Fixes (v1.3.x)

19 bugs fixed across the main process, renderer engine, and UI:

- Fixed `isTablet` always returning `true` on desktop (broke mouse interaction)
- Fixed async IPC `event.returnValue` returning `undefined`
- Fixed save-on-close data loss (ack sent before save completes)
- Fixed `delete this.mediaStrings.key` → `[key]` (memory leak)
- Parameterized 5 SQL injection vulnerabilities
- Fixed `for...in` on arrays in Runtime and DrawPath
- Replaced deprecated `new Buffer()` with `Buffer.from()`
- Fixed sql.js prepared statements never freed (memory leak)
- Fixed HTML injection via `innerHTML` in camera picker
- Added 5s window close timeout fallback
- Fixed DB init race condition with promise guard
- Added `statement.free()` in finally blocks for database queries
- And more — see commit history for full details

---

## What is Vibe Coding?

This project is maintained using **Vibe Coding** — a development approach where an AI agent handles the heavy lifting of code analysis, refactoring, testing, and verification, while a human developer directs the work at a higher level.

In practice, this means:

- **The AI reads, analyzes, and modifies the codebase** — tracing execution paths, identifying bugs, refactoring modules, and writing tests
- **The human sets the goals and reviews the results** — defining what "done" looks like, verifying behavior, and making architectural decisions
- **Iterative and evidence-driven** — every change is verified with tests, smoke checks, and live UI screenshots before moving on
- **Fast modernization** — the entire 8-phase modernization (security, async IPC, modularization, CSS audit, CI hardening) was completed in a single session

The result is a codebase that's been thoroughly audited, tested, and modernized — without the weeks of manual effort that would normally require.

---

## Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/en/) 22+ (26 also supported)
- [Git](https://git-scm.com/)

### Development

```bash
npm install
npm start
```

### Packaging

```bash
# Platform-specific (must run on target OS)
npm run make:zip

# Output: out/ScratchJr-<platform>-<arch>.zip
```

### Testing

```bash
npm test          # 88 tests via vitest
npm run typecheck # tsc --noEmit over the TS renderer
npm run lint      # ESLint (airbnb-base config)
```

The renderer is TypeScript (all 56 source files migrated). `tsc` uses
`moduleResolution: bundler` and esbuild consumes `.ts` natively in
`npm run build:renderer` / `npm start`, so no build step is required
between editing and running.

### Debugging

```bash
npm start           # Launches with Chrome DevTools
npm run debugMain   # Debug main process (open chrome://inspect)
```

---

## Architecture Notes

### ElectronDesktopInterface

The original ScratchJr calls a `tabletInterface` for OS operations (filesystem, audio, video). On desktop, `ElectronDesktopInterface` implements this interface — handling some calls in HTML5 (e.g., WebRTC for recording) and forwarding others to the main process via IPC.

### SQL.js

The project database uses [sql.js](https://github.com/sql-js/sql.js/) (SQLite compiled to JavaScript). The schema is largely the same as the original iOS/Android version, with an added `PROJECTFILES` table that stores SVG, audio, and video files inline — enabling project bundles as starter kits.

### CSS Preprocessing

CSS files use JavaScript template literals (e.g., `${css_vh(10)}`) for responsive sizing. These are preprocessed at load time via `preprocessAndLoadCss()` — now fully async to support the sandboxed preload bridge.

---

## Directory Structure

```
package.json          — dependencies, scripts, ESLint config
forge.config.js       — Electron Forge packaging config
vitest.config.mjs     — test runner config
src/
  main.js             — entry point (orchestrator)
  main/               — modular main process components
  preload.js          — contextBridge API
  electronClient.js   — renderer adapter
  app/                — renderer (HTML, CSS, JS, assets)
    appEntry.js       — page bootstrap
    src/              — application source modules
    css/              — stylesheets (template literal preprocessing)
    dist/             — bundled output (generated)
  lib/                — shared utilities (path-utils, sql-validator)
  icons/              — platform icons
scripts/
  build-renderer.js   — esbuild bundler
  package-and-zip.js  — packaging script
  smoke.js            — boot verification test
tests/
  unit/               — vitest test suite
docs/                 — developer documentation
```

---

## Credits

**Original port:** [JustSch/ScratchJr-Desktop](https://github.com/JustSch/ScratchJr-Desktop)

**ScratchJr:** [LLK/ScratchJr](https://github.com/LLK/scratchjr) by MIT

**Modernization:** [richiesamlie/ScratchJr-Desktop](https://github.com/richiesamlie/ScratchJr-Desktop) — maintained through Vibe Coding

### Acknowledgments

Thank you to the official Scratch team and their supporters: https://github.com/LLK/scratchjr

Thank you to the teams behind [Electron](https://electronjs.org/), [Electron Forge](https://electronforge.io/), [sql.js](https://github.com/sql-js/sql.js/), and [esbuild](https://esbuild.github.io/).

---

## License

MIT

## Disclaimer

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
