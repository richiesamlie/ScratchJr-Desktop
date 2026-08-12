# Changelog

All notable changes to **ScratchJr Reborn**. The repo is developed on
`master`; releases are tagged `vX.Y.Z` and built by CI.

## [v1.5.2] — 2026-08-12

**Fixes the character-flood bug.** Clicking the character picker could keep
adding characters after the picker closed (a closed picker retained its
selection and mouse handlers, and adds could re-enter while a sprite was
still loading). Fixes:

- Picker close now resets selection state and detaches mouse handlers; adds are
  guarded against re-entry while a sprite is loading
- Sprite registration in `page.sprites` is now idempotent — a sprite re-created
  with the same id (reload, undo replay) can no longer accumulate duplicate
  entries
- Regression tests for both (102 → 103 tests)

**Developer experience:**

- `npm install` now builds the renderer bundle (fresh clones boot immediately)
- Removed dead `UI.scrollContents`
- New engine tests: Hop / Repeat / Say primitives, Undo page-order chain
- CI boot-smokes the packaged Windows build before release (catches packaging
  regressions like the missing-bundle one from v1.5.0/v1.5.1)

## [v1.5.1] — 2026-08-12

**Fully strict, zero-`any` renderer.** `tsc --noEmit` is clean under
`strict: true` (noImplicitAny, strictNullChecks, strictFunctionTypes,
strictPropertyInitialization, …). All remaining `any` annotations and
`Record<string, any>` bags were replaced with real types: the project file
format is typed (`ProjectData`/`PageData`/`SpriteData`/`EncodedStrip`), the
drag system uses a typed `DragElement`, and the `HTMLElement.next` vs
`ChildNode.next` declaration clash (which broke element assignability under
TS 7) was resolved.

**Renderer test coverage** (new jsdom harness, 98 tests total):

- Script-strip decode/re-encode round-trip (the project file format, incl. loop nesting and arg encoding)
- Page-bag encode/decode round-trip
- Runtime primitive execution (Home / SetSpeed / Show / Hide)
- Scroll-aware page-strip caret math

**Editor polish:**

- The "+ add character" button can no longer be hidden — the character sidebar is sized to fit it at any window size
- The "+ page" button stays pinned at the bottom of the page strip while pages scroll beneath it
- The character strip scrolls natively — mouse wheel works without clicking the list first, and the custom scrollbar tracks the real position (previously drag-only, with a stale indicator)

**Release pipeline fixes:**

- The renderer bundle is now built before packaging (locally and in CI). The bundle is gitignored, so earlier CI releases shipped apps **without** it — they could not load their UI. Every release is now boot-verified.
- CI matrix now produces all five build jobs (an `include` collision had silently dropped the x64 Linux/macOS targets).

## [v1.5.0] — 2026-08-12

**Editor freedom:**

- Pages per project: hardcoded 4 → **8 by default**, configurable via `maxPages` in `settings.json`
- Scrollable page strip (auto-scrolls to the current page)
- Larger character sidebar (~5–6 visible; characters per page were never capped)
- Lobby thumbnails clamp the page-count badge cleanly for multi-page projects

**Full TypeScript migration** — all 56 renderer files `.js` → `.ts`, every
class declares its fields, `tsc --noEmit` clean (noImplicitThis +
useUnknownInCatchVariables; full strict shipped in v1.5.1). Migration-surfaced
bug fixes: sql-validator boot failure, `Record.saveSoundandClose` typo,
`currentProject` getter-only static, paint close-button render, guarded
`findKeyframesRule`.

## [v1.4.0] — 2026-08-11

Full modernization (8 phases):

- **Electron 22 → 42.8.1** (Chromium 134), Node 22/26 compatible
- **IPC**: synchronous `sendSync` (renderer-freezing) → async `invoke`/`handle` (19 channels)
- **Security**: `nodeIntegration: true` → `sandbox: true`, CSP on all pages, SQL validation, navigation/permission restrictions, window-open denied
- **Main process**: 1,122-line monolith → 94-line orchestrator + 5 focused modules
- **Renderer**: global vendor scripts → esbuild bundler, explicit ESM imports
- **Tests**: 0 → 80 (vitest: IPC, SQL, paths, layout)
- **CI**: lint + test + SHA256 checksums + version verification; 26 known vulnerabilities → 0

## [v1.3.x] — original port fixes

19 bug fixes across the main process, renderer engine, and UI (see git history
for details): desktop mouse interaction, async IPC `event.returnValue`, save-on-close
data loss, memory leaks, 5 SQL injection parameters, deprecated APIs, and more.

[Unreleased]: https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/compare/v1.5.2...master
[v1.5.2]: https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/releases/tag/v1.5.2
[v1.5.1]: https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/releases/tag/v1.5.1
[v1.5.0]: https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/releases/tag/v1.5.0
[v1.4.0]: https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/releases/tag/v1.4.0
