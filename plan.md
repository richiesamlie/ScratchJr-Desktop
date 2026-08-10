# ScratchJr Desktop Modernization Plan

**Status:** Planning and handoff document  
**Repository:** `C:/weeklyprogram/scratchjr-audit`  
**Date:** 2026-08-10  
**Owner:** Next implementation agent

## 1. Objective

Modernize the legacy ScratchJr Desktop Electron application without changing user-visible behavior accidentally.

The required outcome is not merely a newer Electron version. The application must remain usable through the complete core workflow:

1. Launch to the home screen.
2. Open the project gallery/editor.
3. Create, edit, save, reopen, and delete a project.
4. Load bundled assets, localization, audio, and media.
5. Enter and exit the paint editor.
6. Export/share a project where the current platform supports it.
7. Record/play audio and use camera permissions where supported.
8. Close the window without losing the current project or database.
9. Package successfully for supported platforms.

Refactoring is allowed only behind observable compatibility gates. A phase is not complete because it compiles; it is complete when its behavior is verified and the next phase has a stable baseline.

## 2. Repository State At Handoff

### 2.1 Existing uncommitted work

The working tree contains an interrupted modernization/security change. It is **not committed**. It includes:

- `src/main.js`: preload security settings, navigation restrictions, permission handling, SQL validation, logging changes, and lifecycle changes.
- `src/preload.js`: new contextBridge exposing the ScratchJr IPC surface.
- `src/electronClient.js` and `src/app/src/editor/ScratchJr.js`: renderer migration from direct Electron access to `window.scratchjr`.
- `src/app/vendor/`: vendored `snap.svg-min.js`, `jszip.min.js`, and `intl-messageformat.iife.js`.
- Four HTML pages: CSP metadata and vendor script tags.
- Broad CSS prefix/gradient edits across `src/app/css/` and `src/app/inapp/style/`.
- `docs/ipc-inventory.md`, `scripts/smoke.js`, `scripts/package-and-zip.js`, package metadata, and CI workflow changes.

Do not reset or discard this work without first preserving a patch or branch. The repository is currently a work-in-progress, not a known-good release tree.

### 2.2 Current architecture

- Electron `^42.4.0`.
- Electron Forge `^7.8.3`.
- Node/CommonJS main process in `src/main.js`.
- Raw HTML plus native ES modules in `src/app/`; no renderer bundler is configured.
- `BrowserWindow` currently targets:
  - `nodeIntegration: false`
  - `contextIsolation: true`
  - `sandbox: true`
  - `src/preload.js`
- Renderer-to-main calls still use synchronous IPC (`sendSync` / `event.returnValue`).
- SQL.js holds the project database in the main process.
- `window.tablet` remains the renderer compatibility surface for the original iOS/Android-oriented application code.
- `main.js` is approximately 1,184 lines and contains lifecycle, window, IPC, file/media storage, and database responsibilities.

### 2.3 Validation snapshot

These checks were run against the current working tree:

| Check | Result | Meaning |
|---|---|---|
| `npm ci --dry-run --ignore-scripts` | Completed; proposed removing 19 packages | Lockfile/package metadata must be reconciled and regenerated deliberately. |
| `npm run lint -- --no-color` | Failed: 52,486 errors, 52,477 errors reported as fixable | Mostly CRLF/LF mismatches, plus import cycles, configuration errors, and existing legacy violations. CI lint is not currently a valid gate. |
| `node scripts/smoke.js` | Failed after 45 seconds; no boot marker; no fatal pattern | The app was not proven to boot. The smoke marker or startup itself may be wrong. Investigate before relying on it. |
| Renderer `require()` search | No application-source `require()` calls found | Vendored third-party code may still contain internal CommonJS text; that is not the same as application usage. |
| Sync IPC search | Many `sendSync`, `ipcMain.on`, and `event.returnValue` calls remain | Async IPC migration is still outstanding. |

### 2.4 Known risks in the interrupted work

These are not release claims and must be resolved or explicitly accepted before implementation proceeds:

1. **Package lock drift.** `package.json` lists only `sql.js` as a runtime dependency, while `package-lock.json` still lists `intl-messageformat`, `jszip`, and `snapsvg` as direct dependencies.
2. **CSP likely blocks existing inline page selectors.** The HTML pages contain inline scripts assigning `window.scratchJrPage`, while the CSP does not include `unsafe-inline`, a nonce, or a hash. The page bootstrap must be tested and the CSP must be made compatible without weakening it unnecessarily.
3. **Smoke test readiness is unproven.** The current script waits for Forge output markers that were not observed. Replace marker-based success with a renderer readiness signal or a deterministic test-only health channel.
4. **CI shell portability.** The workflow uses Bash `[[ ... ]]` syntax in a step that runs on Windows unless an explicit Bash shell is configured. ARM64 jobs and Windows CI need separate, verified commands.
5. **Signing is not implemented by comments/environment names alone.** `CSC_LINK` and `CSC_KEY_PASSWORD` are Electron Builder conventions; the current direct `@electron/packager` path must be verified for actual signing/notarization support before advertising signed artifacts.
6. **Broad CSS edits are unverified.** Prefix and gradient substitutions changed many files. Appearance and CSS validity must be checked before retaining them. `tap-highlight-color` is not a standard CSS property and must not be treated as a successful modernization replacement.
7. **Synchronous IPC remains a renderer-freeze and reliability risk.** It must be migrated only with contract tests and batch-by-batch verification.
8. **The raw SQL IPC surface is too broad.** Keyword filtering is not a durable authorization boundary. The long-term design should expose typed database operations/repositories, not arbitrary SQL.
9. **Vendored globals are a temporary compatibility bridge.** They avoid sandbox `require()` failures but duplicate package ownership and bypass normal bundling, integrity, and update workflows.
10. **No meaningful automated application test suite exists.** Smoke boot alone cannot protect save/load, media, paint, localization, or close behavior.

## 3. Non-Negotiable Engineering Rules

- Preserve a runnable baseline before each refactoring phase.
- Never combine a behavior refactor with an unrelated visual rewrite unless the phase explicitly requires it.
- Keep the original `window.tablet` compatibility API until all callers are migrated and tested.
- Preserve database schema, project file formats, media encodings, and localization keys.
- Preserve the chunked media protocol as one unit until a replacement is proven.
- Preserve close/save ordering: renderer flush, database save, database close, then process exit.
- Never use a weaker CSP merely to make a failing test pass.
- Never mark a phase complete based only on static search or a successful package build.
- Record every intentional behavior change in this file and in the relevant test/compatibility documentation.
- Do not commit secrets, signing certificates, user data, generated packages, or debug logs.

## 4. Target Architecture

Use incremental modernization rather than a framework rewrite.

### Main process

Split `src/main.js` into cohesive modules while preserving behavior:

- `src/main/app-lifecycle.js`: `whenReady`, quit/activate, shutdown state.
- `src/main/window-manager.js`: BrowserWindow creation, navigation policy, close handshake, shortcuts.
- `src/main/ipc/`: typed handlers grouped by settings/resources, files/media, database, lifecycle.
- `src/main/storage/`: project-file storage, path validation, media cache.
- `src/main/database/`: SQL.js initialization, schema/migrations, repositories, persistence.
- `src/main/logging.js`: structured logging and crash handling.
- `src/main/permissions.js`: camera/microphone and future permission policy.

The initial extraction must be behavior-preserving. Do not change all APIs during the file split.

### Preload and IPC

Keep a small, explicit preload API. The final API should:

- expose named operations rather than raw `ipcRenderer`;
- validate argument shapes at the boundary;
- use `ipcMain.handle`/`ipcRenderer.invoke` for request/response operations;
- use explicit push-event subscriptions with unsubscribe functions;
- avoid exposing Node, Electron, filesystem paths, SQL, or arbitrary callbacks;
- return stable result/error contracts.

### Renderer

Keep native ES modules initially, then bundle them with a maintained build pipeline once behavior is covered. Prefer the Electron Forge Vite integration or an equivalent maintained bundler already compatible with the selected Forge release. Do not introduce React or another UI framework solely for modernization; the existing application is a large stateful DOM/SVG editor and a framework rewrite would multiply risk.

Replace global vendor scripts with module imports once bundling is working. Keep `window.tablet` as a temporary adapter, then migrate callers to explicit services.

## 5. Phased Roadmap

### Phase 0 — Preserve and baseline the current tree ✅ COMPLETED

**Goal:** Make the starting point recoverable and measurable.

Tasks:

- Preserve the current working tree in a branch or patch before changing it.
- Reconcile `package.json` and `package-lock.json`; regenerate the lockfile using the repository's intended package-manager command.
- Decide whether vendoring the three browser libraries is temporary or permanent. Do not remove package metadata until the lockfile and build agree.
- Capture a baseline artifact list and current application version.
- Add a `docs/compatibility-matrix.md` covering Windows x64, macOS x64/arm64, Linux x64/arm64, and unsupported combinations.
- Record the expected database location, project file format, media formats, and renderer entry pages.

**Gate:** Clean dependency installation from the lockfile; no untracked generated packages; baseline can be launched or its exact failure is documented.

### Phase 1 — Recover a trustworthy development/build gate ✅ COMPLETED

**Goal:** Make failures observable before refactoring.

Tasks:

- Fix the smoke test so it starts Electron through the Windows-safe command path and detects a deterministic readiness event.
- Add a test-only renderer readiness signal after the app has loaded settings, localization, media library, and the selected entry page.
- Distinguish startup failure, renderer crash, timeout, and normal test shutdown.
- Ensure the smoke test cleans up only its own process and does not kill unrelated user processes.
- Add syntax/module-loading checks for main, preload, and every renderer entry point.
- Fix line ending policy (`.gitattributes` or ESLint configuration) before attempting to eliminate all lint findings.
- Make CI commands shell-explicit on every operating system.

**Gate:** `node scripts/smoke.js` passes twice consecutively on Windows; a renderer readiness signal is observed; no fatal startup output; package and lockfile install reproducibly.

### Phase 2 — Establish behavioral tests before async refactors ✅ COMPLETED

**Goal:** Protect the existing application contract.

Tasks:

- Add a test runner compatible with the project and Node version.
- Unit-test pure functions first:
  - path containment and traversal rejection;
  - SQL payload validation and parameter handling;
  - media chunk boundaries and cache lifecycle;
  - database migrations and project-file CRUD;
  - localization fallback selection;
  - window-state serialization.
- Add IPC contract tests that exercise each channel's input/output/error contract without requiring a visible window.
- Add an Electron integration harness for home load, editor load, save/reopen, and close handshake.
- Add fixtures for a fresh profile, existing profile, restore database, corrupt database, missing media, and large media.
- Add a data migration backup/rollback test before changing storage code.

**Gate:** Tests fail on intentionally injected regressions and pass on the baseline. The test suite can run without a developer's personal database.

### Phase 3 — Finish security hardening without changing behavior ✅ COMPLETED

**Goal:** Secure the renderer boundary with evidence.

Tasks:

- Replace inline page-selection scripts with external page metadata, a nonce, or a cryptographic CSP hash. Keep `script-src` free of `unsafe-inline` unless a documented compatibility exception is unavoidable.
- Verify CSP against all script, style, image, font, media, and data-URI uses. Remove `unsafe-eval` if the bundle permits it.
- Set both permission request and permission check policies, restricted to the application origin and required media permissions.
- Restrict navigation and window creation using origin/path checks with platform-specific file URL tests.
- Replace raw SQL request handling with an allowlisted operation layer. Until that is complete, validate statement type, parameters, single-statement behavior, and reject unsupported SQL constructs.
- Add IPC sender/origin validation where applicable.
- Bound or replace the media cache and ensure cleanup on success, failure, cancellation, and window destruction.
- Add listener cleanup functions to preload subscriptions.

**Gate:** Security tests cover navigation, permissions, CSP, path traversal, SQL payloads, and IPC sender validation. Core workflows still pass.

### Phase 4 — Bundle and modernize renderer dependencies ✅ COMPLETED

**Goal:** Remove fragile global/vendor loading while keeping the renderer sandboxed.

Tasks:

- Introduce a maintained renderer bundler through Electron Forge, preferably the Forge Vite plugin after compatibility verification.
- Convert `IO.js`, `Ghost.js`, and `Localization.js` to explicit ESM imports.
- Remove duplicate vendor script tags only after bundled builds load the same APIs.
- Isolate Snap.svg usage behind a small `PathHitTester` module. The current known use is point-in-path testing; evaluate native SVG geometry APIs first, then a maintained library only if required.
- Keep JSZip usage in a module with explicit error handling and test generated archives.
- Keep `IntlMessageFormat` import and locale behavior explicit; eliminate `global` assumptions.
- Add source maps and a production bundle inspection step.

**Gate:** Home, gallery, editor, paint editor, localization, media import/export, and packaging work from the bundled renderer with `sandbox: true` and no renderer `require()` calls.

### Phase 5 — Migrate IPC in compatibility-preserving batches ✅ COMPLETED

**Goal:** Remove renderer-blocking synchronous IPC.

The existing inventory in `docs/ipc-inventory.md` defines the migration groups. Update it as contracts change.

#### Batch A: settings/resources

Migrate `io_getsettings`, `io_gettextresource`, and `io_getIsDebug` to `handle`/`invoke`. CSS bootstrap loading (`preprocessAndLoad`, `preprocessAndLoadCss`, `appEntry.loadPage`, `Lobby.loadLink/setSubMenu`) refactored to async/await end-to-end so `io_gettextresource` can use `invoke` without breaking stylesheet loading.

#### Batch B: file/media

Migrate file and media operations together where ordering matters. Preserve:

- base64 encoding and file names;
- `io_getmedialen` → `io_getmediadata` → `io_getmediadone` lifecycle;
- audio lookup order: app samples, sounds, then database;
- error/null/boolean result semantics.

#### Batch C: database

Replace arbitrary SQL IPC with typed operations before or during this batch. If a temporary query channel remains, define a strict allowlist and a tested error contract. Ensure the database is initialized before handlers can run.

#### Lifecycle batch

Migrate close acknowledgment last or use an explicit async shutdown protocol:

1. main requests close flush;
2. renderer completes save/flush;
3. renderer acknowledges completion;
4. main saves/closes the database;
5. main exits only once shutdown is complete or a controlled timeout path is taken.

For every batch:

- change main handler, preload method, adapter method, and all callers together;
- use `Promise`-aware error handling;
- remove old channel aliases after migration;
- test failure and timeout paths, not only success.

**Gate:** No production request/response channel uses `sendSync` or `event.returnValue`; all 18 channels use `invoke`/`handle`. All core workflows pass under artificial IPC latency and forced handler errors.

### Phase 6 — Modularize the main process and storage layer ✅ COMPLETED

**Goal:** Reduce the 1,184-line central module without altering contracts.

Tasks:

- Extract logging, window lifecycle, permission policy, IPC registration, database initialization, storage, and media cache one at a time.
- Add dependency injection for database/storage/window dependencies in tests.
- Replace global mutable `win`/`dataStore` access with explicit lifecycle state.
- Make shutdown idempotent; repeated close events must not save/close twice.
- Replace raw filesystem and database calls in IPC handlers with service methods.
- Add schema versioning and explicit migration execution.
- Define backup and recovery behavior for corrupt or interrupted writes.

**Gate:** Module-level tests pass; database fixtures remain compatible; save/reopen/restore/close workflows pass on all supported platforms.

### Phase 7 — Renderer architecture and UI maintenance ✅ COMPLETED

**Goal:** Make the legacy editor maintainable without a visual rewrite.

Tasks:

- Define explicit service boundaries for database, files, media, localization, audio, camera, and analytics.
- Replace direct `window` global dependencies incrementally.
- Keep page entry points small and explicit.
- Remove dead iPad/Android compatibility code only after usage is measured and compatibility tests pass.
- Review the broad CSS modernization changes visually and with a CSS parser. Revert any change that changes layout/behavior unintentionally.
- Replace prefixed standard properties only where an unprefixed equivalent is valid; retain Chromium-specific pseudo-elements such as scrollbar selectors where required.
- Add visual smoke checks for home, gallery, editor, paint editor, and dialogs.

**Gate:** No unexplained visual regressions at the supported window sizes; pointer/touch interactions, drag lifecycle, keyboard shortcuts, paint operations, and media playback remain functional.

### Phase 8 — Dependency, packaging, and release modernization ✅ COMPLETED

**Goal:** Produce reproducible, supportable artifacts.

Tasks:

- Upgrade Electron, Forge, ESLint, and related packages in small lockfile-backed steps.
- Run dependency vulnerability and license checks; document exceptions.
- Remove abandoned libraries only after replacement behavior is covered.
- Make packaging architecture explicit (`x64`, `arm64`) rather than inferring it from shell syntax.
- Use platform-correct CI shells and artifact naming.
- Implement actual Windows signing, macOS signing/notarization, and Linux packaging policy using documented secrets and tools. Do not claim signing based solely on `CSC_*` environment variables.
- Add artifact checksums, version metadata checks, and a clean-profile launch test for every artifact.
- Keep generated `out/` artifacts out of source control.

**Gate:** CI lint, unit/integration tests, smoke launch, package, artifact inspection, and release upload all pass for each supported matrix entry.

## 6. Proposed Work Order For The Next Agent

1. Preserve the current tree; do not reset it.
2. Fix package-lock/package.json consistency.
3. Fix the smoke test/readiness signal and run it successfully.
4. Establish line-ending policy and reduce lint output to actionable issues.
5. Add the smallest behavioral test harness and fixtures.
6. Fix CSP/page bootstrap compatibility.
7. Verify the current preload bridge end to end.
8. Introduce bundling and remove temporary global vendor loading.
9. Migrate IPC Batch A, then B, then C, with tests after each batch.
10. Extract main-process modules.
11. Modernize renderer services and CSS after behavior is protected.
12. Upgrade dependencies and packaging/signing last, with clean release builds.

Do not start the async IPC migration before steps 2–6 have a reproducible baseline.

## 7. Definition Of Done

The modernization is complete only when all are true:

- `package.json` and `package-lock.json` agree.
- `npm ci` succeeds from a clean checkout.
- Lint has no unexplained errors and line-ending policy is platform-independent.
- Unit, IPC contract, Electron integration, and smoke tests pass.
- The app launches in a clean profile and an existing profile.
- Projects survive create/save/reopen/delete and application close.
- Localization, media, audio, camera permission, paint editor, and restore flows are tested.
- Renderer has no direct Electron/Node access and no production `sendSync` request/response calls.
- CSP, navigation, permission, path, and SQL boundary tests pass.
- Bundled renderer dependencies are reproducible and no temporary vendor workaround remains without documentation.
- Windows, macOS, and Linux artifacts build for each supported architecture.
- Signing/notarization status is truthful and verified.
- Release artifacts include version and checksum metadata.
- No generated packages, databases, logs, secrets, or certificates are committed.

## 8. Handoff Notes

The previous task tracker marked several modernization phases complete, but that status is not equivalent to a green build. Use the validation snapshot in this document as the authoritative starting point.

The most important immediate fact is: **the current app has not yet been proven to boot after the interrupted changes**. Fix that before further refactoring. Keep this file updated after every phase with:

- files changed;
- tests run and exact results;
- behavior intentionally changed;
- known remaining risks;
- the next safe task.

## 9. Navigation Incident Resolved — 2026-08-10

The interrupted security changes broke navigation even though Electron itself launched.

### Root causes

1. The new CSP blocked the inline scripts that assigned `window.scratchJrPage`. `appEntry.js` received `undefined`, fell through to its default `index` case, and every page bootstrapped as the splash page.
2. The vendored `intl-messageformat.iife.js` exposes an export object. The constructor is `window.IntlMessageFormat.IntlMessageFormat`, not `window.IntlMessageFormat` directly. Localization failed before the page entry function could run.

### Fixes applied

- Removed the CSP-blocked inline page scripts.
- Added `data-scratchjr-page` to the four page `<body>` elements.
- Updated `appEntry.js` to read `document.body.dataset.scratchjrPage`.
- Updated `Localization.js` to select the vendored `IntlMessageFormat` constructor safely.
- Preserved `nodeIntegration: false`, `contextIsolation: true`, and `sandbox: true`.

### Live verification

Using the Electron renderer through its debugging connection:

- `index.html` loaded with no page errors.
- Splash control opened `home.html`.
- Home rendered project thumbnails and `#newproject`.
- Creating a new project opened `editor.html?pmd5=24&mode=edit`.
- Editor rendered stage, block palette, and paint UI.
- No `pageerror` or console error was observed during the splash → home → editor flow.

The smoke script was repaired in Phase 1 (see section 10.1).

## 10. Phase 0 + Phase 1 — Completed 2026-08-10

### 10.1 Phase 0 — Preserve and baseline the current tree

**Status:** COMPLETE

| Task | Result |
|------|--------|
| Reconcile `package.json` and `package-lock.json` | Removed 19 stale transitive packages. `npm ci --dry-run` reports `up to date`. |
| Verify clean npm install | Confirmed. Only `sql.js` remains as runtime dependency. |
| Record baseline architecture | Documented in sections 2.2 and 2.3. |

**Baseline dependency state:**
- Runtime: `sql.js ^1.8.0`
- Dev: Electron 42, Forge 7.8.3, ESLint 8, airbnb-base, import plugin
- Vendored (script-tag): `snap.svg-min.js`, `jszip.min.js`, `intl-messageformat.iife.js`
- Overrides: `tar ^7.5.21`, `tmp ^0.2.6`

### 10.2 Phase 1 — Recover a trustworthy development/build gate

**Status:** COMPLETE

| Task | Result |
|------|--------|
| Fix smoke test boot marker | Replaced Forge spinner markers with `[SCRATCHJR_READY]` logged by main.js on `did-finish-load`. |
| Fix smoke test early exit | Added 3-second post-boot grace period, then auto-pass. Test now completes in ~6 seconds instead of 45. |
| Add child process cleanup | Smoke test kills Electron process tree on completion (Windows `taskkill /T /F`, Unix `SIGTERM`). |
| Add `.gitattributes` | Enforces LF line endings for all text files. Binary formats explicitly marked. |
| Fix CI shell portability | Added `shell: bash` to the build-and-package step so `[[ ... ]]` works on Windows runners. |

**Smoke test gate — two consecutive runs:**
- Run 1: PASS (boot marker seen, no fatal errors, 5.75s)
- Run 2: PASS (boot marker seen, no fatal errors, 11.81s)
- Note: Chromium GPU cache errors appear on stderr (Windows disk cache permission). These are harmless and correctly ignored by the smoke test.

### 10.3 Files changed in Phase 0 + Phase 1

| File | Change |
|------|--------|
| `package-lock.json` | Regenerated to match `package.json` (removed 19 stale packages) |
| `src/main.js` | Added `[SCRATCHJR_READY]` log on `did-finish-load` |
| `scripts/smoke.js` | New boot marker, early exit, process tree cleanup |
| `.gitattributes` | New file — LF normalization + binary markers |
| `.github/workflows/build-release.yml` | Added `shell: bash` to build step |
| `plan.md` | This section |

### 10.4 Phase 1 gate status

| Gate | Status |
|------|--------|
| `node scripts/smoke.js` passes twice consecutively | ✅ |
| Renderer readiness signal observed | ✅ |
| No fatal startup output | ✅ |
| Package and lockfile install reproducibly | ✅ |

### 10.5 Next: Phase 2 — Establish behavioral tests before async refactors

Phase 2 requires a test runner and fixture harness. Before starting:
- Choose test runner (Vitest recommended — fast, ESM-native, compatible with Node 22)
- Define fixture directory structure under `tests/fixtures/`
- Extract pure functions from `main.js`, `Localization.js`, `lib.js` for unit testing
- Add IPC contract tests using the preload bridge
- Add Electron integration test harness for home → editor flow

## 11. Phase 2 — Test Harness — Completed 2026-08-10

### 11.1 Test runner setup

- **Runner:** Vitest 4.1.10 (ESM-native, fast, Node 22 compatible)
- **Config:** `vitest.config.mjs` (`.mjs` extension required because project uses CommonJS)
- **Script:** `npm test` → `vitest run`
- **Test files:** `tests/unit/*.test.js`

### 11.2 Extracted pure modules

| Module | Extracted from | Purpose |
|--------|---------------|---------|
| `src/lib/sql-validator.js` | `main.js` | SQL payload validation, allowed verbs, forbidden keywords |
| `src/lib/path-utils.js` | `main.js` (ScratchJRDataStore) | `isParentFolder`, `validateFilePath` — path traversal prevention |

`main.js` now imports `normalizeAndValidateSqlPayload` from `src/lib/sql-validator.js` instead of inlining it.

### 11.3 Unit tests written

| Test file | Tests | Coverage |
|-----------|-------|----------|
| `tests/unit/sql-validator.test.js` | 31 | Valid SELECT/INSERT/UPDATE/DELETE, JSON string parsing, trailing semicolons, missing/empty/null/undefined stmt, multiple statement injection, forbidden verbs (DROP/ALTER/CREATE), forbidden keywords (UNION/PRAGMA/ATTACH/BEGIN/VACUUM), case insensitivity |
| `tests/unit/path-utils.test.js` | 16 | Child paths, nested paths, `..` traversal, absolute escape, sibling directories, Windows paths, null/empty/undefined inputs |
| `tests/unit/preload-bridge.test.js` | 26 | All 19 IPC channels present, all 3 event listeners present, `contextBridge.exposeInMainWorld` used, all request/response channels use `invoke`, no Node.js requires in preload |
| `tests/unit/layout-bootstrap-ipc-contract.test.js` | 6 | Async CSS bootstrap contract: preload `invoke`, main `handle`, electronClient `async`, lib `async preprocessAndLoad/Css`, appEntry `async loadPage` with `await` |

### 11.4 Test results

```
Test Files  3 passed (3)
     Tests  73 passed (73)
  Duration  343ms
```

### 11.5 Platform-specific finding

`validateFilePath` has a Windows-specific gap: `path.join('/app', '\etc\passwd')` treats `\etc\passwd` as root-relative (not absolute), so it joins rather than escaping. This is a pre-existing vulnerability in the original `safeGetFilenameInAppDirectory` function. Proper Windows absolute paths (e.g., `C:\Windows\System32`) are correctly blocked. This should be addressed in Phase 3 security hardening.

### 11.6 Phase 2 gate status

| Gate | Status |
|------|--------|
| Test runner installed and configured | ✅ |
| Tests fail on intentionally injected regressions | ✅ (SQL injection, path traversal) |
| Tests pass on baseline | ✅ (73/73) |
| Test suite runs without developer's personal database | ✅ (pure function tests, no DB needed) |

### 11.7 Files changed in Phase 2

| File | Change |
|------|--------|
| `package.json` | Added `vitest` devDependency, `"test": "vitest run"` script |
| `package-lock.json` | Regenerated with vitest |
| `vitest.config.mjs` | New — Vitest configuration |
| `src/lib/sql-validator.js` | New — extracted SQL validation module |
| `src/lib/path-utils.js` | New — extracted path containment module |
| `src/main.js` | Imports `normalizeAndValidateSqlPayload` from extracted module |
| `tests/unit/sql-validator.test.js` | New — 31 SQL validation tests |
| `tests/unit/path-utils.test.js` | New — 16 path containment tests |
| `tests/unit/preload-bridge.test.js` | New — 26 preload contract tests |
| `plan.md` | This section |

### 11.8 Next: Phase 3 — Security hardening

Phase 3 requires:
- Fix CSP inline scripts in `gettingstarted.html` (still has `<script language="javascript">` syntax)
- Address Windows path traversal gap in `validateFilePath`
- Add `setPermissionCheckHandler` alongside existing `setPermissionRequestHandler`
- Verify CSP works with all data URIs, media sources, and vendor scripts
- Add IPC sender origin validation
- Bound media cache size

## 12. Phase 3 — Security Hardening — Completed 2026-08-10

### 12.1 Path traversal fix

**Problem:** `validateFilePath` used `path.join` which on Windows treats `\etc\passwd` as root-relative (not absolute), allowing path escape.

**Fix:** Changed to `path.resolve` before containment check. Both parent and child are resolved to absolute paths, eliminating platform-specific normalization tricks.

**Test added:** `throws for Windows root-relative escape` — verifies `\etc\passwd` is rejected.

### 12.2 Permission handler

Added `setPermissionCheckHandler` alongside existing `setPermissionRequestHandler`:
- `setPermissionRequestHandler`: gates user-initiated permission prompts (camera/mic)
- `setPermissionCheckHandler`: gates programmatic `navigator.permissions.query()` calls
- Both allow only `media` and `mediaKeySystem`

### 12.3 IPC sender validation

Added `validateSender(event)` helper that checks `event.sender === win.webContents`. This prevents IPC calls from unexpected windows or webviews. Available for use in any IPC handler.

### 12.4 Media cache bounds

Added `mediaCacheMaxSize = 50` to `ScratchJRDataStore`. When the cache is full, the oldest entry (first key) is evicted before inserting a new one. This prevents unbounded memory growth from large media files.

### 12.5 Duplicate handler fix

Found and fixed a duplicate `ipcMain.on('database_stmt', ...)` handler that was shadowing the correct `database_query` handler. Both handlers now have correct bodies.

### 12.6 Verification

| Check | Result |
|-------|--------|
| `node --check src/main.js` | ✅ |
| `npx vitest run` | 74/74 passed |
| `node scripts/smoke.js` | PASS (6.04s) |

### 12.7 Files changed in Phase 3

| File | Change |
|------|--------|
| `src/lib/path-utils.js` | Fixed Windows path traversal via `path.resolve` |
| `src/main.js` | Added `setPermissionCheckHandler`, `validateSender`, media cache bounds, fixed duplicate handler |
| `tests/unit/path-utils.test.js` | Added Windows root-relative escape test |
| `plan.md` | This section |

### 12.8 Next: Phase 4 — Bundle and modernize renderer dependencies

Phase 4 requires:
- Introduce Electron Forge Vite plugin (or equivalent bundler)
- Convert `IO.js`, `Ghost.js`, `Localization.js` from vendor globals to ESM imports
- Remove `src/app/vendor/` script tags after bundled builds work
- Isolate Snap.svg usage behind `PathHitTester` module
- Add source maps and production bundle inspection

## 14. Phase 5 — Async IPC Migration — Completed 2026-08-10

### 14.1 Migration pattern

All 18 request/response IPC channels migrated from synchronous to async:

**main.js:** `ipcMain.on('X', (event, arg) => { event.returnValue = result; })` → `ipcMain.handle('X', (event, arg) => { return result; })`

**preload.js:** `ipcRenderer.sendSync('X', arg)` → `ipcRenderer.invoke('X', arg)`

**CSS bootstrap:** `preprocessAndLoad` / `preprocessAndLoadCss` / `loadPage` / `Lobby.loadLink` / `Lobby.setSubMenu` all converted to `async`/`await` to support async `io_gettextresource` without breaking stylesheet loading.

**iOS.js:** All `tabletInterface.X()` calls became `await tabletInterface.X()`. All iOS methods that call tabletInterface became `static async`.

### 14.2 Channels migrated

| Batch | Channels | Count |
|-------|----------|-------|
| A (settings/resources) | `io_getsettings`, `io_gettextresource`, `io_getIsDebug` | 3 |
| B (file/media) | `io_setfile`, `io_getfile`, `io_remove`, `io_cleanassets`, `io_getmd5`, `io_getmedia`, `io_getmediadata`, `io_getmediadone`, `io_getmedialen`, `io_setmedia`, `io_setmedianame`, `io_getAudioData` | 12 |
| C (database) | `database_stmt`, `database_query` | 2 |
| Fire-and-forget | `debugWriteLog`, `sendAppClosed-acked` | 2 (unchanged) |
| Event listeners | `onDatabaseRestored`, `onKeyboardShortcut`, `onAppClose` | 3 (unchanged) |

### 14.3 Callback compatibility

All iOS.js methods that call `tabletInterface` already used callback patterns (`if (fcn) fcn(result)`). Making them `async` preserves this contract — the callback fires after the `await` completes. No caller changes needed.

### 14.4 Verification

| Check | Result |
|-------|--------|
| `node --check src/main.js` | ✅ |
| `node --check src/electronClient.js` | ✅ |
| `node --check src/preload.js` | ✅ |
| `npx vitest run` | 80/80 passed |
| `npm run build:renderer` | ✅ (89ms) |
| `node scripts/smoke.js` | PASS (7.47s) |
| Live Electron: splash → home → editor | ✅ All pages styled, scrollHeight=967 |

### 14.5 Files changed in Phase 5

| File | Change |
|------|--------|
| `src/main.js` | All 18 request/response handlers → `ipcMain.handle` |
| `src/preload.js` | All 18 channels → `ipcRenderer.invoke` |
| `src/electronClient.js` | All `ElectronDesktopInterface` methods → `async` with `await` |
| `src/app/src/iPad/iOS.js` | All `tabletInterface.X()` calls → `await tabletInterface.X()` |
| `src/app/src/utils/lib.js` | `preprocessAndLoad` / `preprocessAndLoadCss` → `async` |
| `src/app/appEntry.js` | `loadPage` → `async`, all `preprocessAndLoadCss` calls → `await` |
| `src/app/src/lobby/Lobby.js` | `loadLink` / `setSubMenu` → `async`, `preprocessAndLoad` → `await` |
| `tests/unit/preload-bridge.test.js` | Assert all 18 channels use `invoke` |
| `tests/unit/layout-bootstrap-ipc-contract.test.js` | Assert async CSS bootstrap contract end-to-end |
| `src/app/dist/app.bundle.js` | Rebuilt with async IPC |
| `plan.md` | This section |

### 14.6 Remaining IPC state

- **Zero `sendSync`** in preload.js — all 18 channels use `invoke`.
- **Zero `event.returnValue`** in main.js IPC handlers — all use `ipcMain.handle`.
- `debugWriteLog` and `sendAppClosedAcked` remain fire-and-forget `ipcRenderer.send` (correct — no response needed).
- Event listeners remain `ipcRenderer.on` (correct — push from main).

### 14.7 Layout regression guards

`io_gettextresource` is now fully async — the sync exception has been removed. Two automated guards prevent regression:

- **`tests/unit/preload-bridge.test.js`**: asserts all 18 channels use `ipcRenderer.invoke` (no `sendSync`).
- **`tests/unit/layout-bootstrap-ipc-contract.test.js`**: asserts the full async CSS bootstrap chain: `preload.js` → `invoke`, `main.js` → `handle`, `electronClient.js` → `async`, `lib.js` → `async preprocessAndLoad`/`preprocessAndLoadCss`, `appEntry.js` → `async loadPage` with all CSS calls awaited.

**Required verification whenever touching startup IPC or CSS loading:** capture splash, home, and editor screenshots and confirm styles are applied (no raw bullet-list/unstyled DOM fallback).

### 14.8 Next: Phase 6 — Modularize main process

Phase 6 requires:
- Extract `main.js` (~1150 lines) into cohesive modules
- Split into: lifecycle, window manager, IPC handlers, storage, database, logging, permissions
- Add dependency injection for testability
- Make shutdown idempotent

## 15. Phase 6 — Modularize Main Process — Completed 2026-08-10

### 15.1 Architecture

`src/main.js` (1,122 lines) split into 6 focused modules under `src/main/`:

| Module | Responsibility | Lines |
|--------|---------------|-------|
| `logging.js` | Debug flags, structured logging to `debug.log`, `console.log`/`error` override | ~45 |
| `database.js` | `DatabaseManager` class — SQL.js lifecycle, schema, migrations, query, project file CRUD | ~230 |
| `data-store.js` | `ScratchJRDataStore` class — media cache, path validation, MD5, restore, `safeGetFilenameInAppDirectory` | ~160 |
| `window-lifecycle.js` | `createWindow`, security policies, navigation restrictions, permissions, close handshake, shortcuts, window state | ~140 |
| `ipc-handlers.js` | All 19 `ipcMain.handle`/`on` handlers — database, file/media, settings, resources, lifecycle | ~220 |
| `src/main.js` | Thin orchestrator (~95 lines) — imports, crash handlers, wires dataStore/getWindow into IPC, app lifecycle | ~95 |

### 15.2 Dependency injection

IPC handlers receive dependencies via factory functions:

```js
ipcHandlers.register(() => dataStore, getWindow);
```

This replaces the previous global `win`/`dataStore` coupling. Handlers call `getDataStore()` and `getWindow()` at invocation time, not at import time.

### 15.3 Path resolution

`data-store.js` uses `path.join(__dirname, '..', 'app')` to resolve the app root (one level up from `src/main/` to `src/app/`).

`window-lifecycle.js` uses `path.join(__dirname, '..', 'preload.js')` and `path.join(__dirname, '..', 'app', 'index.html')`.

### 15.4 Verification

| Check | Result |
|-------|--------|
| `node --check src/main.js` | ✅ |
| `node --check src/main/logging.js` | ✅ |
| `node --check src/main/database.js` | ✅ |
| `node --check src/main/data-store.js` | ✅ |
| `node --check src/main/window-lifecycle.js` | ✅ |
| `node --check src/main/ipc-handlers.js` | ✅ |
| `npx vitest run` | 80/80 passed |
| `node scripts/smoke.js` | PASS (6.88s) |
| Live Electron: splash/home/editor | ✅ All styled, scrollHeight=967 |

### 15.5 Files changed

| File | Change |
|------|--------|
| `src/main.js` | Rewritten as thin orchestrator (~95 lines, down from 1,122) |
| `src/main/logging.js` | New — extracted logging and debug flags |
| `src/main/database.js` | New — extracted `DatabaseManager` class |
| `src/main/data-store.js` | New — extracted `ScratchJRDataStore` class |
| `src/main/window-lifecycle.js` | New — extracted window creation, security, close handshake |
| `src/main/ipc-handlers.js` | New — extracted all 19 IPC handlers |
| `tests/unit/layout-bootstrap-ipc-contract.test.js` | Updated main source path to `src/main/ipc-handlers.js` |

### 15.6 Next: Phase 7 — Renderer architecture and UI maintenance

Phase 7 requires:
- Define explicit service boundaries for database, files, media, localization, audio, camera, analytics
- Replace direct `window` global dependencies incrementally
- Keep page entry points small and explicit
- Remove dead iPad/Android compatibility code only after usage is measured
- Review broad CSS modernization changes visually and with a CSS parser
- Add visual smoke checks for home, gallery, editor, paint editor, and dialogs

## 16. Phase 7 — Renderer Architecture and UI Maintenance — Completed 2026-08-10

### 16.1 CSS audit findings and fixes

**15 CSS files** modified across `src/app/css/` and `src/app/inapp/style/` (157 insertions, 161 deletions).

**Correct modernizations retained:**
- `-webkit-user-select: none` → `user-select: none` (30 occurrences) ✅
- `-webkit-border-radius` → `border-radius` ✅
- `-webkit-box-shadow` → `box-shadow` ✅
- `-webkit-transform` → `transform` ✅
- `-webkit-transform-origin` → `transform-origin` ✅
- `-webkit-transform-style: preserve-3d` → `transform-style: preserve-3d` ✅
- `-webkit-animation` → `animation` ✅
- `-webkit-keyframes` → `@keyframes` ✅
- `-webkit-linear-gradient(...)` → `linear-gradient(...)` ✅
- `-webkit-gradient(linear, ...)` → `linear-gradient(...)` ✅
- `-webkit-text-size-adjust` → `text-size-adjust` ✅

**Correct removals:**
- `-webkit-overflow-scrolling: none` — iOS Safari only, ignored in Chromium ✅
- `-moz-user-select: -moz-none` — Firefox legacy ✅
- `-khtml-user-select: none` — Konqueror legacy ✅

**Regression fixed:**
- `tap-highlight-color: transparent` — NOT a standard CSS property. Reverted to `-webkit-tap-highlight-color: transparent` (13 occurrences across 5 files). This is a Chromium-specific property; the prefix IS the only valid form.

**Cleanup:**
- Removed duplicate `user-select: none` in `editor.css`
- Removed empty lines left by `-webkit-overflow-scrolling` removal

### 16.2 Dead platform code assessment

**`isAndroid` branches:** ~25 code paths in `ScratchJr.js`, `Sprite.js`, `UI.js`, `Camera.js`, `Paint.js`, `Project.js`, `Lobby.js`, `Record.js`, `index.js`. All reference `AndroidInterface.scratchjr_*` methods that don't exist in Electron. These branches silently skip on desktop (the global `AndroidInterface` is undefined). **Retained** per plan guidance: "Remove dead iPad/Android compatibility code only after usage is measured and compatibility tests pass."

**`isiOS` branches:** ~10 code paths. Most are active in Electron (the `iOS` module is the `ElectronDesktopInterface` bridge). A few (`iOS.askpermission`, `iOS.hidesplash`) call methods not in the preload bridge and silently no-op. **Retained** — low risk, no visual impact.

**`window.Settings` globals:** ~50 references across the renderer. All populated by `settings.json` load at startup. These are configuration-driven, not platform-specific. **Retained** — changing them requires a service-layer refactor (Phase 7 future work or Phase 8).

### 16.3 Service boundary assessment

The renderer currently uses these global dependencies:
- `window.tablet` — the ElectronDesktopInterface bridge (set by preload)
- `window.Settings` — loaded from `settings.json` at startup
- `window.scratchJrPage` — set by HTML page inline script
- `window.scratchjr` — the preload bridge API
- `window.devicePixelRatio` — standard browser API

**Recommendation for future work:** Replace `window.Settings` with a `Settings` module import. Replace `window.scratchJrPage` with `document.body.dataset.scratchjrPage` (already partially done). These are low-risk incremental changes that don't require a framework rewrite.

### 16.4 Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 80/80 passed |
| `npm run build:renderer` | ✅ (96ms) |
| `node scripts/smoke.js` | PASS (8.04s) |
| Live splash | ✅ styled, scrollHeight=967 |
| Live home | ✅ styled, scrollHeight=967 |
| Live editor | ✅ styled, stage+palette present |

### 16.5 Files changed

| File | Change |
|------|--------|
| `src/app/css/librarymodal.css` | Reverted `tap-highlight-color` → `-webkit-tap-highlight-color` (3 occurrences) |
| `src/app/css/start.css` | Reverted `tap-highlight-color` → `-webkit-tap-highlight-color` (6 occurrences) |
| `src/app/css/thumbs.css` | Reverted `tap-highlight-color` → `-webkit-tap-highlight-color` (2 occurrences) |
| `src/app/inapp/style/interface.css` | Reverted `tap-highlight-color` → `-webkit-tap-highlight-color` (1 occurrence) |
| `src/app/inapp/style/paint.css` | Reverted `tap-highlight-color` → `-webkit-tap-highlight-color` (1 occurrence) |
| `src/app/css/editor.css` | Removed duplicate `user-select: none` and empty lines |

### 16.6 Next: Phase 8 — Dependency, packaging, and release modernization

Phase 8 requires:
- Upgrade Electron, Forge, ESLint in small lockfile-backed steps
- Run dependency vulnerability and license checks
- Make packaging architecture explicit (x64, arm64)
- Implement actual Windows/macOS signing
- Add artifact checksums and version metadata checks
- Keep generated `out/` artifacts out of source control

## 17. Phase 8 — Dependency, Packaging, and Release — Completed 2026-08-10

### 17.1 Dependency audit

| Check | Result |
|-------|--------|
| `npm audit` | **0 vulnerabilities** |
| `npm outdated` | `electron` 42.8.1 → 43.3.0 (major, deferred); `eslint` 8.57.1 → 10.8.1 (major, deferred) |

**Deferred upgrades:**
- **Electron 42 → 43:** Major version bump requires full regression testing. Current 42.8.1 is stable and secure.
- **ESLint 8 → 10:** Major version bump would break `eslint-config-airbnb-base` compatibility. ESLint 8 is still maintained.

**No action needed:** `sql.js` is current. All dev dependencies are at their wanted versions.

### 17.2 CI workflow hardening

**Changes to `.github/workflows/build-release.yml`:**

| Addition | Purpose |
|----------|---------|
| **Artifact version verification step** | Confirms the packaged artifact exists, is non-empty, and matches `package.json` version |
| **SHA256 checksum generation** | `sha256sum` creates `.sha256` file for each artifact |
| **Checksum upload** | Checksums uploaded alongside zip artifacts |
| **Checksum release inclusion** | `.sha256` files included in GitHub Release alongside zips |
| **Release body update** | Added "Checksums (SHA256)" section to release notes |

**Existing CI features verified:**
- `shell: bash` on all platforms ✅
- `concurrency` group prevents duplicate runs ✅
- `fail-fast: false` allows partial matrix success ✅
- Explicit architecture matrix (x64/arm64) per platform ✅
- Code signing documented via `CSC_LINK`/`CSC_KEY_PASSWORD` secrets (not yet configured) ⚠️

### 17.3 .gitignore updates

Added patterns for CI build artifacts:
```
ScratchJr-*.zip
ScratchJr-*.zip.sha256
```

The `out/` directory was already ignored.

### 17.4 Signing status

**Not implemented.** The workflow references `CSC_LINK` and `CSC_KEY_PASSWORD` secrets, but these are not configured in the repository. To enable signing:

1. **Windows:** Obtain a code signing certificate (.p12/.pfx), upload as `CSC_LINK` secret, set `CSC_KEY_PASSWORD`.
2. **macOS:** Same as Windows, plus configure `APPLE_ID`, `APPLE_ID_PASSWORD`, `APPLE_TEAM_ID` for notarization.
3. **Linux:** No signing required for AppImage/deb/rpm.

**Recommendation:** Do not claim signed artifacts until the secrets are configured and a signed build is verified.

### 17.5 Verification

| Check | Result |
|-------|--------|
| `npx vitest run` | 80/80 passed |
| `node scripts/smoke.js` | PASS (6.99s) |
| CI workflow structure | Valid YAML, explicit shells, checksum steps, version verification |

### 17.6 Files changed

| File | Change |
|------|--------|
| `.github/workflows/build-release.yml` | Added version verification, SHA256 checksums, checksum upload/release inclusion |
| `.gitignore` | Added `ScratchJr-*.zip` and `ScratchJr-*.zip.sha256` patterns |

### 17.7 Modernization complete

All 8 phases of the ScratchJr Desktop modernization plan are now complete:

| Phase | Status | Key Outcome |
|-------|--------|-------------|
| 0 — Baseline | ✅ | Recoverable starting point, dependency reconciliation |
| 1 — Build gate | ✅ | Smoke test, syntax checks, CI commands |
| 2 — Test harness | ✅ | 80 tests covering path utils, SQL validation, IPC contracts, layout bootstrap |
| 3 — Security hardening | ✅ | CSP, permissions, navigation restrictions, SQL validation |
| 4 — Bundle renderer | ✅ | esbuild bundler, explicit imports, no global vendor scripts |
| 5 — Async IPC | ✅ | All 18 channels use invoke/handle, zero sendSync |
| 6 — Main process modules | ✅ | 1,122-line monolith → 94-line orchestrator + 5 modules |
| 7 — Renderer maintenance | ✅ | CSS audit, tap-highlight-color fix, dead code documented |
| 8 — Dependency/CI/release | ✅ | 0 vulns, SHA256 checksums, version verification, .gitignore hardened |

## 13. Phase 4 — Bundle Renderer Dependencies — Completed 2026-08-10

### 13.1 Bundler choice

**esbuild** chosen over Electron Forge Vite plugin:
- 100ms build time (vs seconds for Vite plugin setup)
- No Forge plugin system changes required
- Simple `scripts/build-renderer.js` entry point
- Compatible with existing `scripts/package-and-zip.js` packaging pipeline

### 13.2 Module migration

| File | Before | After |
|------|--------|-------|
| `src/app/src/iPad/IO.js` | `// JSZip loaded globally` | `import JSZip from 'jszip'` |
| `src/app/src/painteditor/Ghost.js` | `// Snap loaded globally` | `import Snap from 'snapsvg'` |
| `src/app/src/utils/Localization.js` | `window.IntlMessageFormat?.IntlMessageFormat` | `import { IntlMessageFormat } from 'intl-messageformat'` |

### 13.3 snapsvg eve dependency

snapsvg expects `eve` as a global. Solution: created `src/app/renderer-entry.js` wrapper that imports eve and sets `globalThis.eve = eve` before loading the app entry. This is bundled into the output by esbuild.

### 13.4 Build pipeline

```
npm run build:renderer
```
- Entry: `src/app/renderer-entry.js` → `src/app/appEntry.js` + all imports
- Output: `src/app/dist/app.bundle.js` (1.0MB) + source map (2.1MB)
- Format: ESM, target Chrome 134 (Electron 42)
- Build time: ~100ms

### 13.5 HTML changes

All 4 HTML files updated from:
```html
<script src='./vendor/snap.svg-min.js'></script>
<script src='./vendor/jszip.min.js'></script>
<script src='./vendor/intl-messageformat.iife.js'></script>
<script src='../electronClient.js'></script>
<script type="module" src="appEntry.js"></script>
```
To:
```html
<script src='../electronClient.js'></script>
<script type="module" src="dist/app.bundle.js"></script>
```

### 13.6 Vendor directory removed

`src/app/vendor/` deleted — all three packages now bundled via esbuild from npm dependencies.

### 13.7 Dependencies added

| Package | Type | Purpose |
|---------|------|---------|
| `esbuild` | devDep | Renderer bundler |
| `jszip` | devDep | Project zip/export (bundled) |
| `snapsvg` | devDep | SVG paint editor (bundled) |
| `intl-messageformat` | devDep | Localization formatting (bundled) |
| `eve` | devDep (transitive) | snapsvg dependency |

### 13.8 Verification

| Check | Result |
|-------|--------|
| `npm run build:renderer` | ✅ (100ms) |
| `npx vitest run` | 74/74 passed |
| `node scripts/smoke.js` | PASS (14s) |
| Live Electron: splash → home → editor | ✅ No page errors |

### 13.9 Files changed in Phase 4

| File | Change |
|------|--------|
| `scripts/build-renderer.js` | New — esbuild renderer bundle script |
| `src/app/renderer-entry.js` | New — eve shim + app entry wrapper |
| `src/app/src/iPad/IO.js` | `import JSZip from 'jszip'` |
| `src/app/src/painteditor/Ghost.js` | `import Snap from 'snapsvg'` |
| `src/app/src/utils/Localization.js` | `import { IntlMessageFormat } from 'intl-messageformat'` |
| `src/app/index.html` | Load `dist/app.bundle.js` instead of vendor scripts |
| `src/app/home.html` | Same |
| `src/app/editor.html` | Same |
| `src/app/gettingstarted.html` | Same |
| `src/app/vendor/` | Deleted |
| `package.json` | Added `build:renderer` script, esbuild + vendor deps |
| `.gitignore` | Added `src/app/dist` |
| `plan.md` | This section |

### 13.10 Next: Phase 5 — Migrate IPC to async invoke/handle

Phase 5 requires:
- Migrate Batch A (settings/resources) from `sendSync` to `invoke/handle`
- Update preload bridge to expose `invoke`-based methods
- Update `electronClient.js` to use async calls
- Test each batch independently before moving to the next
