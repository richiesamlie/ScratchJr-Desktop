# ScratchJr Reborn — Desktop Edition

> **ScratchJr, reborn.** A modernized desktop port of [ScratchJr](https://scratchjr.org/) for Windows, macOS, and Linux — faster to build with, safer to run, and built on a codebase you can trust.

## Official Disclaimer

Scratch and ScratchJr are trademarks of Massachusetts Institute of Technology, which does not sponsor, endorse, or authorize this content. See [scratchjr.org](https://scratchjr.org) for more information.

## Downloads

**[Download ScratchJr Reborn (latest release)](https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/releases/latest)**

| File | Platform |
|------|----------|
| `ScratchJr-win32-x64.msi` | Windows x64 (installer) |
| `ScratchJr-win32-x64.zip` | Windows x64 (portable) |
| `ScratchJr-darwin-x64.zip` | macOS x64 |
| `ScratchJr-darwin-arm64.zip` | macOS ARM64 |
| `ScratchJr-linux-x64.zip` | Linux x64 |
| `ScratchJr-linux-arm64.zip` | Linux ARM64 |

Each release includes SHA256 checksums for integrity verification.

---

## Changes in this fork

### 🎨 More room to create

| In the original | Now |
|---|---|
| 4 pages max, hardcoded | **8 pages by default**, configurable via `maxPages` in `settings.json` |
| Page strip truncated, no scrolling | **Scrollable page strip** that keeps the current page in view |
| ~4 characters visible in the sidebar | **Bigger character sidebar** — scrolls freely, characters per page unlimited |
| "+" buttons disappear as you add | **Always visible** — add-character and add-page buttons stay on screen at any window size |
| Strip only scrolls by dragging | **Native mouse-wheel scrolling** with a scrollbar that matches your position |

### 🛡️ Safe by design

- **Sandboxed renderer** — no Node in the UI, only a narrow preload bridge
- **Content Security Policy** on every page, SQL injection guards, navigation locked to the app root
- Upgraded **Electron 43** — modern Chromium, Node 22/26 compatible

### 🌍 Locale & language

- **`--lang` CLI flag** — set the language at launch (e.g. `./ScratchJr --lang=fr`), ideal for fleet deployments

### ⚡ Built on a codebase you can trust

- **All 56 renderer files** migrated to TypeScript — full `strict` mode, **zero errors, zero `any`**
- **103 tests** — including a jsdom harness covering the project file format (save/load round-trips), runtime primitives, and editor math

### 📋 v1.6.1

- **Check for Updates menu** — File → Check for Updates now works from the main process with native OS dialogs (no renderer dependency)
- **Auto-check on launch** — update check runs 3 seconds after startup via the main process
- **MSI installer: database retention option** — the MSI now supports `REMOVE_DATABASE=1` to delete `Documents/ScratchJR` on uninstall (`msiexec /i ScratchJr.msi REMOVE_DATABASE=1`). By default the database is kept.
- **Architectural save fixes** — debounced `database_stmt` persistence, close handshake flushes pending save, autosave interval dedup
- **16 new database tests** — debouncing, atomic writes, integrity checks, auto-recovery from backup

### 📋 v1.6.0

- **Database corruption recovery** — auto-backup on every save, PRAGMA integrity_check on open, automatic restore from `.bak` when corruption is detected
- **Atomic database writes** — writes to a temp file then renames, preventing partial-write corruption on crash
- **Save chain hardened** — the `saving` flag now resets on every exit path (null metadata, null md5, async errors), so a failed save no longer permanently blocks all future saves
- **Null-safety throughout** — guarded against undefined `currentProject`, null `md5` from `getmd5`, and null `db` references in all database methods

### 📋 v1.5.9

- Removed dead `make32`/`makeAll` ia32 scripts (Electron 43.4.1 is the last ia32 series)
- Fixed lint warnings in error handlers (appEntry.js, update-dialog.js)
- npm audit: 0 vulnerabilities (resolved via lockfile cleanup)
- **Reliable releases** — the renderer bundle is built before every package (a CI bug once shipped apps without it), all six platforms built natively with checksums

Maintained through **Vibe Coding** — AI-assisted development where an agent does the analysis and implementation, a human sets the goals and reviews the results.

---

## Building from Source

**Prerequisites:** Node.js 22+ (26 supported), Git.

```bash
npm install
npm start          # run the app
npm run make:zip   # package for your platform (builds the renderer first)
npm test           # 103 tests
npm run typecheck  # tsc --noEmit (strict)
```

Cross-build Linux from any OS: `npm_config_platform=linux npm_config_arch=arm64 npm run make:zip`
Windows MSI: `node scripts/build-msi.js`. macOS must be built on macOS — CI handles all six targets on tag pushes.

---

## Credits

**Original port:** [JustSch/ScratchJr-Desktop](https://github.com/JustSch/ScratchJr-Desktop) · **ScratchJr:** [LLK/ScratchJr](https://github.com/LLK/scratchjr) by MIT · **Reborn:** [richiesamlie/ScratchJr-Desktop-Reborn](https://github.com/richiesamlie/ScratchJr-Desktop-Reborn)

## License

**BSD 3-Clause** — Copyright (c) 2016, Massachusetts Institute of Technology.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
