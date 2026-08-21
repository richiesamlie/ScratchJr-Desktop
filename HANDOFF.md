# ScratchJr Desktop — Audit Handoff

> **Date:** 2026-08-21  
> **Current version:** 1.6.1 (tagged, built, pushed)  
> **Last commit:** `accb729`  
> **Build status:** MSI + ZIP built at `out/make/`  
> **Tests:** 119/119 passing (8 test files)  
> **TypeScript:** Clean (tsc --noEmit passes)

---

## 1. Project Overview

ScratchJr Desktop is an Electron app (v43) that wraps the ScratchJr tablet app for desktop use. It uses **sql.js** (in-memory SQLite) as its database, persisted to `scratchjr.sqllite` in the user's documents folder.

### Tech stack
- **Electron 43** + `@electron-forge` for packaging
- **sql.js** (SQLite compiled to WASM) — in-memory, exported to disk on save
- **TypeScript** (main process) + **JavaScript** (renderer/app)
- **Vitest** for testing
- **WiX 3.14** for MSI installer

### Build commands
```bash
npm run build:main      # TypeScript → dist/
npm run build:renderer  # Bundles src/app/ → dist/app.bundle.js
npm run make            # Full build → out/make/ (MSI + ZIP)
npm run test            # Vitest (119 tests)
npm run typecheck       # tsc --noEmit
```

---

## 2. Architecture: How Data Flows

```
┌─────────────────────────────────┐
│  Renderer Process (BrowserWindow)│
│  ipcRenderer.invoke('database_*')│
└───────────┬─────────────────────┘
            │ Electron IPC (structured clone)
            ▼
┌─────────────────────────────────┐
│  Main Process                   │
│  ipc-handlers.ts                │
│  ├── database_stmt   → db.stmt()│
│  ├── database_query  → db.query()│
│  ├── io_* handlers   → fs.*     │
│  └── saveToProjectFiles          │
│      (direct db.saveToProjectFiles)│
└───────────┬─────────────────────┘
            │
            ▼
┌─────────────────────────────────┐
│  DatabaseManager (database.ts)  │
│  sql.js in-memory database      │
│  ┌─────────────────────────────┐│
│  │  stmt()  → execute SQL      ││
│  │  query() → SELECT rows      ││
│  │  save()  → export → .tmp    ││
│  │           → rename (atomic) ││
│  │  savePending() → 100ms debounced save│
│  │  flushPendingSave() → immediate save │
│  └─────────────────────────────┘│
│  Tables: PROJECTS, USERSHAPES,  │
│          USERBKGS, PROJECTFILES │
└─────────────────────────────────┘
```

### Key files and their roles

| File | Lines | Role |
|------|-------|------|
| `src/main/database.ts` | 430 | DatabaseManager: init, open, save, backup, recovery, CRUD |
| `src/main/ipc-handlers.ts` | 255 | IPC bridge: database_stmt, database_query, io_* handlers |
| `src/main/data-store.ts` | 166 | DataStore: orchestrates initialization, restore, project lifecycle |
| `src/main/window-lifecycle.ts` | 175 | Window creation, close handshake, force-kill timeout |
| `src/main/main.ts` | 123 | App entry: whenReady, crash handlers, menu |
| `src/main/updater.ts` | 141 | GitHub release check, version compare |
| `src/main/logging.ts` | — | Debug flags, console logging |
| `src/lib/sql-validator.ts` | 49 | SQL payload validation (allowed verbs, forbidden keywords) |
| `src/preload.ts` | 65 | Electron preload bridge (ipcRenderer → renderer) |
| `src/app/src/iPad/iOS.ts` | 402 | Tablet interface abstraction (IPC wrappers) |
| `src/app/src/iPad/IO.ts` | 770 | Project file I/O, DB queries, save/create/delete |
| `src/app/src/editor/ui/Project.ts` | 693 | Editor project management: load, save, thumbnail, undo |
| `src/app/src/editor/ScratchJr.ts` | 1008 | App lifecycle: init, autosave, pause/resume, navigation |
| `src/app/src/lobby/Home.ts` | 338 | Lobby: create project, display projects, navigate to editor |
| `src/app/src/lobby/Lobby.ts` | 343 | Lobby page switching, settings, guide |
| `src/app/src/entry/home.ts` | — | Home page entry point |
| `src/app/src/entry/editor.ts` | — | Editor page entry point |

---

## 3. Changes Made (v1.5.9 → v1.6.1)

### Commits in chronological order

```
8e60981 fix: harden save chain and add database corruption recovery
c6fb10c release: v1.6.0 — database corruption recovery, hardened save chain
4158140 fix: architectural hardening — debounced saves, close handshake, autosave dedup
d5e42f9 test: add 16 tests for DatabaseManager save, debounce, integrity, and recovery
f4e71d4 release: v1.6.1 — update checker via menu, cleanup dead renderer code
33fb72d feat: MSI installer adds database retention option on uninstall
742002e fix: save chain — always reset saving flag, don't persist failed stmts
fcf7fec fix: save chain safety net — timeout guarantees saving flag resets
54eb063 fix: default project name fallback — prevents "undefined" in DB
d269e72 fix: detect failed INSERTs, block navigation on invalid project ID
accb729 fix: lobby display — remove blocking editor nav, fix "undefined" project name
```

### What each change does

#### v1.6.0 — Database Corruption Recovery (`8e60981`, `c6fb10c`)
- **Auto-backup** on every save: copies `scratchjr.sqllite` → `scratchjr.sqllite.bak` before writing
- **Integrity check** on DB open: runs `PRAGMA integrity_check` to detect corruption
- **Auto-recovery chain**: corrupt DB → try `.bak` → create fresh DB (last resort)
- **Atomic writes**: writes to `.tmp`, then `renameSync` (prevents partial writes)
- **Renderer notification** when auto-recovery happens

#### v1.6.0 — Architectural Hardening (`4158140`)
- **`database_stmt` now persists to disk** via `db.savePending()` — previously, project metadata writes through `database_stmt` never called `db.save()`, so data was lost on crash
- **Debounced saves**: `savePending()` coalesces rapid writes (100ms delay). `flushPendingSave()` for immediate flush
- **Close handshake fix**: flushes pending save before `win.destroy()`. Timeout increased from 5s to 10s
- **Autosave dedup**: `onResume` now clears old interval before creating new one (was creating duplicates)

#### v1.6.1 — Update Checker (`f4e71d4`)
- Added **File → Check for Updates...** menu item (main process, native dialog)
- Auto-checks 3s after window load
- **Removed** old renderer-based update system (`update-dialog.js`, `update-dialog.css`, `updateCheck`/`updateOpenUrl` from preload bridge)
- Net −144 lines of dead code removed

#### MSI Installer Customization (`33fb72d`)
- Custom WiX fragment in `src/installer/cleanup-action.wxs`
- `REMOVE_DATABASE` property: set to `1` to delete `Documents/ScratchJR` on uninstall
- Default: keep database (0)
- Usage: `msiexec /i ScratchJr.msi REMOVE_DATABASE=1`

#### Save Chain Fixes (`742002e`, `fcf7fec`, `54eb063`)
- **`database_stmt` handler** only calls `savePending()` when `stmt()` returns `>= 0`
- **`Project.save`** wraps entire async chain in try-catch with 15s safety timeout — `saving` flag always resets
- **`iOS.stmt`** catches async rejections, calls callback with `-1`
- **`IO.saveProject`** and **`IO.createProject`** have null-safe fallbacks for name/version
- **`Home.createNewProject`** defaults name to `'Project'` and version to `'1.0.0'`

#### Lobby Display Fix (`d269e72`, `accb729`)
- **`gotoEditor`** no longer blocks navigation — logs a warning instead (original code never had this check)
- **`addProjectLink`** handles null/undefined/corrupted project names (falls back to `'Project'`)
- **`displayYourProjects`** fallback version: `version || window.Settings!.scratchJrVersion`
- **Devtools always enabled** for debugging (`DEBUG_LOAD_DEVTOOLS = true`)

---

## 4. Known Issues (Still Open)

### Issue A: Save flow still unreliable
**Status:** Partially fixed, needs testing  
**Symptoms:** After creating a project and saving in the editor, going back to the lobby may not show the project.  
**What was done:**
- Removed the blocking `gotoEditor` validation
- Added null-safe name/version defaults
- Added 15s safety timeout to `Project.save`  
**What might still be wrong:**
- The `stmt()` method returns `last_insert_rowid()` for ALL operations (including UPDATE). For an UPDATE that doesn't match any rows, `stmt()` returns the previous insert ID (positive) — so the handler thinks it succeeded
- If `metadata.id` is undefined or wrong, the UPDATE silently affects 0 rows
- The `savePending()` debounce (100ms) means data might not be on disk if the user navigates away quickly (but in-memory query should still work)

### Issue B: "undefined" project names
**Status:** Partially fixed  
**What was done:** Added fallbacks in `createNewProject`, `IO.createProject`, `IO.saveProject`, `addProjectLink`, and `dataRecieved`  
**What might still be wrong:** If old corrupted projects exist in the database, they'll still show with whatever name was stored. The fallback in `addProjectLink` handles this now.

### Issue C: `stmt()` method doesn't reliably detect failures
**Status:** Open  
**Problem:** The `stmt()` method in `database.ts` returns `last_insert_rowid()` after every operation. For INSERT, this is the new row ID. For UPDATE/DELETE, this is the LAST insert's ID — not related to the current operation. This means:
- A successful UPDATE returns a stale positive number (handler thinks it succeeded)
- A failed UPDATE (WHERE clause matches nothing) also returns a stale positive number
- There's no way to tell if an UPDATE actually affected any rows  

**Fix needed:** Use `this.db.getRowsModified()` or check `changes()` after the statement.

### Issue D: SQL validator blocks `INSERT OR REPLACE`
**Status:** Known, not blocking current flow  
**Problem:** `SQL_FORBIDDEN_KEYWORDS` includes `'replace'`. The `saveToProjectFiles` method uses `INSERT OR REPLACE INTO PROJECTFILES` but calls `this.stmt()` directly (bypassing IPC/validator). If anyone routes a `REPLACE` statement through `database_stmt`, it will be blocked.  
**Fix needed:** Either remove `'replace'` from forbidden list (risky) or allow it for specific tables.

### Issue E: Close handshake still fragile
**Status:** Partially fixed  
**What was done:** `flushPendingSave()` before `win.destroy()`, timeout increased to 10s  
**What might still be wrong:** If the renderer save takes >10s (very large project), `win.destroy()` still kills the process without the main process save completing. The `save()` call in `window-lifecycle.ts` is synchronous but `flushPendingSave()` cancels the debounce then calls `save()` — this should work, but the 10s timeout is the hard limit.

### Issue F: Auto-recovery creates empty DB as last resort
**Status:** By design, but destructive  
**Problem:** If both the main DB and `.bak` are corrupted, `freshDatabase()` creates a brand new empty database. All project data is lost.  
**Fix needed:** Consider copying corrupted DB to a `.corrupted` timestamped file before overwriting.

---

## 5. Test Coverage

### Test files

| File | Tests | What it covers |
|------|-------|---------------|
| `tests/unit/preload-bridge.test.js` | 26 | Preload bridge methods, IPC contract |
| `tests/unit/sql-validator.test.js` | 31 | SQL validation, forbidden keywords, edge cases |
| `tests/unit/database-save.test.js` | 16 | DatabaseManager: save, savePending, flushPending, integrity check, auto-recovery |
| `tests/unit/io-persistence.test.js` | 8 | IO layer save/load persistence |
| `tests/unit/renderer-probe.test.js` | 1 | Renderer modules load without crashing |
| `tests/unit/renderer-editor.test.js` | 14 | Editor module structure validation |
| `tests/unit/layout-bootstrap-ipc-contract.test.js` | 6 | IPC contract between main/renderer |
| `tests/unit/path-utils.test.js` | 17 | Path utilities |

### What's NOT tested
- End-to-end save flow (renderer → IPC → database → disk)
- Lobby display with corrupted project data
- Auto-save interval and pause/resume behavior
- Close handshake and crash recovery
- MSI installer custom actions
- Update checker

---

## 6. Database Schema

```sql
CREATE TABLE PROJECTS (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CTIME DATETIME DEFAULT CURRENT_TIMESTAMP,
    MTIME DATETIME,
    ALTMD5 TEXT,
    POS INTEGER,
    NAME TEXT,
    JSON TEXT,
    THUMBNAIL TEXT,
    OWNER TEXT,
    GALLERY TEXT,
    DELETED TEXT,
    VERSION TEXT,
    ISGIFT INTEGER DEFAULT 0  -- added by migration
);

CREATE TABLE USERSHAPES (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CTIME DATETIME DEFAULT CURRENT_TIMESTAMP,
    MD5 TEXT,
    ALTMD5 TEXT,
    WIDTH TEXT,
    HEIGHT TEXT,
    EXT TEXT,
    NAME TEXT,
    OWNER TEXT,
    SCALE TEXT,
    VERSION TEXT
);

CREATE TABLE USERBKGS (
    ID INTEGER PRIMARY KEY AUTOINCREMENT,
    CTIME DATETIME DEFAULT CURRENT_TIMESTAMP,
    MD5 TEXT,
    ALTMD5 TEXT,
    WIDTH TEXT,
    HEIGHT TEXT,
    EXT TEXT,
    OWNER TEXT,
    VERSION TEXT
);

CREATE TABLE PROJECTFILES (
    MD5 TEXT PRIMARY KEY,
    CONTENTS TEXT
);
```

---

## 7. Key Design Decisions and Constraints

### sql.js is in-memory
- The database lives in WASM memory. `db.export()` serializes the entire DB to a `Uint8Array`.
- `save()` writes the full export to disk. This is called on every meaningful change.
- `savePending()` debounces saves (100ms). Only one save happens per debounce window.
- **Risk:** If the process crashes between `db.stmt()` (in-memory write) and `db.save()` (disk write), the in-memory change is lost.

### IPC is async, callbacks are required
- All database operations go through `ipcRenderer.invoke()` → `ipcMain.handle()` → response
- The renderer code uses callback-style (not async/await) for most flows
- `iOS.stmt()` is async but the callbacks around it are not — this creates subtle timing issues

### The `saving` flag is critical
- `Project.ts` uses a module-level `saving` boolean to prevent concurrent saves
- If `saving` gets stuck at `true`, no more saves can happen until page reload
- The 15s safety timeout was added to prevent this

### SQL validation is restrictive
- Only `SELECT`, `INSERT`, `UPDATE`, `DELETE` are allowed
- `REPLACE` is forbidden (breaks `INSERT OR REPLACE` in `saveToProjectFiles`, but that bypasses the validator)
- `CREATE`, `ALTER`, `DROP`, `PRAGMA` are all forbidden through IPC

---

## 8. What to Do Next

### Priority 1: Verify save flow works end-to-end
The biggest open question is whether the save chain actually persists data correctly. Test by:
1. Create a new project (should show "Project 1")
2. Add content, save (Ctrl+S or auto-save)
3. Return to lobby → project should appear with correct name
4. Reopen the project → data should be there
5. Check DevTools console for any errors

### Priority 2: Fix `stmt()` return value for UPDATE/DELETE
The `stmt()` method should distinguish between INSERT (return row ID) and UPDATE/DELETE (return affected row count). Use `this.db.getRowsModified()` or `changes()`.

### Priority 3: Add error reporting from `database_stmt` back to renderer
Currently, if `database_stmt` fails, the renderer gets `-1` but has no error message. Add error details to the IPC response.

### Priority 4: Remove devtools from production builds
`DEBUG_LOAD_DEVTOOLS` is currently always `true` for debugging. Change back to `DEBUG && true` before release.

### Priority 5: Test MSI installer
The custom WiX fragment with `REMOVE_DATABASE` property needs testing on a clean machine.

### Priority 6: Consider adding transaction support
Multiple related writes (INSERT project + INSERT default JSON + INSERT thumbnail) should be wrapped in a transaction to prevent partial state.

---

## 9. File Locations

```
C:\weeklyprogram\scratchjr-audit\          # Project root
├── src/
│   ├── main/                              # Main process (Electron)
│   │   ├── database.ts                    # DatabaseManager (430 lines)
│   │   ├── ipc-handlers.ts                # IPC bridge (255 lines)
│   │   ├── data-store.ts                  # DataStore orchestrator (166 lines)
│   │   ├── window-lifecycle.ts            # Window management (175 lines)
│   │   ├── main.ts                        # App entry (123 lines)
│   │   ├── updater.ts                     # Update checker (141 lines)
│   │   └── logging.ts                     # Debug flags
│   ├── app/                               # Renderer (ScratchJr app)
│   │   ├── src/
│   │   │   ├── editor/
│   │   │   │   ├── ScratchJr.ts           # App lifecycle (1008 lines)
│   │   │   │   └── ui/Project.ts          # Project save/load (693 lines)
│   │   │   ├── iPad/
│   │   │   │   ├── iOS.ts                 # Tablet interface (402 lines)
│   │   │   │   └── IO.ts                  # File/DB I/O (770 lines)
│   │   │   ├── lobby/
│   │   │   │   ├── Home.ts                # Lobby UI (338 lines)
│   │   │   │   └── Lobby.ts              # Lobby page management (343 lines)
│   │   │   ├── entry/                     # Page entry points
│   │   │   └── utils/
│   │   └── settings.json                  # App settings
│   ├── installer/
│   │   └── cleanup-action.wxs             # MSI custom action
│   └── lib/
│       └── sql-validator.ts               # SQL validation (49 lines)
├── tests/unit/                            # 119 tests
│   ├── database-save.test.js              # DB save/recovery tests (16)
│   ├── sql-validator.test.js              # SQL validation tests (31)
│   └── ... (8 test files total)
├── forge.config.js                        # Electron Forge config
├── package.json                           # Version 1.6.1
└── out/make/                              # Built artifacts
    ├── wix/x64/ScratchJr.msi             # MSI installer
    └── zip/win32/x64/ScratchJr-*.zip     # ZIP distribution
```

---

## 10. Quick Reference: How to Build and Test

```bash
# Full rebuild (typecheck + build + test)
npm run typecheck && npm test && npm run build:main && npm run build:renderer

# Package only (faster, skips build)
export PATH="/c/wix/bin:$PATH" && npm run make

# Run specific test
npx vitest run tests/unit/database-save.test.js

# Enable debug logging (set in logging.ts)
# DEBUG_DATABASE, DEBUG_CLEANASSETS, etc.

# Open devtools in packaged app
# Currently always enabled (DEBUG_LOAD_DEVTOOLS = true)
# Ctrl+Shift+I in the app window
```
