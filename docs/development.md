# Development Guide

Practical knowledge for working on ScratchJr Reborn. Covers the build pipeline,
the editor layout/limits map, the project file format, testing, and releasing.

## Build pipeline — read this first

The renderer is bundled into **one file**: `src/app/dist/app.bundle.js` (esbuild,
entry `src/app/renderer-entry.js`). Every HTML page loads **only** that bundle.

- **The bundle is gitignored** — it is generated, never committed. A fresh
  checkout has no bundle, so `npm start` shows a blank app until you run
  `npm run build:renderer` once.
- **`npm run make:zip` builds the bundle automatically** before packaging
  (`scripts/package-and-zip.js` runs `build-renderer.js` first). Do not remove
  that step — a release built without it ships an app that cannot load its UI
  (this actually happened in v1.5.0/v1.5.1 pre-fix).
- After editing any renderer `.ts`, rebuild with `npm run build:renderer` before
  packaging or boot-verifying.
- Recommended follow-up: run `build:renderer` from `postinstall` so fresh clones
  work out of the box.

**Verifying a packaged build:**

```bash
node scripts/smoke.js   # boots the packaged app, expects [SCRATCHJR_READY]
# or check the bundle made it into the asar:
node -e "const a=require('@electron/asar');const p='out/ScratchJr-win32-x64/resources/app.asar';console.log(a.extractFile(p,'src\\\\app\\\\dist\\\\app.bundle.js').length)"
```

## CSS preprocessing

CSS files are JS template literals (e.g. `${css_vh(10)}`), evaluated at **load
time** by `preprocessAndLoadCss()` (`src/app/src/utils/lib.ts`). Consequences:

- `css_vh(N)` → `N% of innerHeight` **in pixels, baked when the page loads**.
  It is not a live `vh` unit.
- `calc(100% - …)` percentages resolve **live** against the containing block —
  the pattern used to adapt panels to the dynamic layout.
- The editor layout is dynamic: `UI.resize()` sets panel heights to
  `clamp(0.57, 0.60) × docHeight` on wide windows (aspect > 1.45). Do not assume
  the CSS `61.2vh` panels are their final size.

## Editor layout & limits map

| Limit / area | Where | Current value |
|---|---|---|
| Pages per project | `window.Settings.maxPages` read in `Thumbs.updatePages` | 8 (`src/app/settings.json`) |
| Character sidebar height | `#library .spritethumbs` `max-height` | `calc(100% - 10.29vh-px)` — leaves room for the **+ button** |
| Add-character (+) button | `.addsprite` sibling below `.spritethumbs` | always visible by construction (see below) |
| Add-page (+) button | `#emptypage`, `position: sticky; bottom: 0` in `#pagecc` | pinned while the page list scrolls |

**Hard boundary:** the bottom block palette (`#blockspalette`, z-index 10)
starts exactly at the left panel's bottom and covers everything below it in the
left column. Any left-column UI must end above that line — the character list is
sized as `panel − 9.38vh (top) − 10.29vh (button)` so the + button always fits.

**Character strip scrolling:** native `scrollTop` on `.spritethumbs` is the
single source of truth. Drag scrolling (`UI.spriteScolling`), `spriteInView`,
and the reset in `Thumbs.updateSprites` all write `scrollTop`; the custom
scrollbar (`#sbthumb`) is synced from a `scroll` listener (`UI.updateSpriteScroll`).
Do not reintroduce `style.top` scrolling — it broke wheel input and desynced the
scrollbar.

## Project file format (typed contract)

Defined in `src/app/src/editor/ui/Project.ts` and shared across the engine:

- `ProjectData` — the project bag: `pages: string[]`, `currentPage`, one `PageData` per page id, plus merged undo-action fields
- `PageData` — `lastSprite`, `sprites: string[]`, one `SpriteData` per sprite id
- `SpriteData` — `id`, `type`, `scripts: EncodedStrip[]`, `sounds`, plus attribute passthrough
- `EncodedStrip` — recursive `[blocktype, arg, dx, dy, (nested strips)?]` encoding

Facts that matter:

- A strip's blocks are linked via `.next`; `encodeStrip` walks the chain from the
  head — **one strip per script**, not per block.
- `'null'` as an arg means "use the spec default" (e.g. `hop` re-encodes its
  default `2`). Encode with the *current* value for round-trip identity.
- Undo snapshots are `Project.getUndo()` + the action descriptor — the bags are
  the file format; keep `Undo.ts` consumers on the shared types.

## Renderer testing (jsdom)

`tests/unit/renderer-*.test.js` run in jsdom (`// @vitest-environment jsdom`)
and must **import `./renderer-harness.js` first**. The harness stubs the jsdom
gaps: `SVGMatrix`/`WebKitCSSMatrix`, canvas 2d context (fixed-width
`measureText`), `img.complete`, `window.Settings`, and the preload/tablet
bridges.

Per-test setup:

- `resetDom()` — fresh `#scriptscontainer`, `#pagesdiv`, stub `ScratchJr.stage`
- `stubMedia()` — stub `iOS.getmedia` (sprite construction kicks off async media loads)
- `BlockSpecs.initBlocks()` — populates block defs (module load does not)
- Construct `Page` with data (`{ lastSprite: '', sprites: [], layers: [], num: 1 }`)
  — an empty constructor triggers `emptyPage()` → `createCat()` → `MediaLib` (unavailable in tests)

Covered contracts: script-strip decode/re-encode identity, page-bag
encode/decode, runtime primitives (`Prims.Home`/`SetSpeed`/`Show`/`Hide`), and
`Thumbs.getPagePos` scroll math.

## Releasing

```bash
npm version X.Y.Z --no-git-tag-version   # bumps package.json + lockfile
git commit -m "release: vX.Y.Z"
git push origin master
git tag vX.Y.Z && git push origin vX.Y.Z  # CI builds all 6 targets + MSI + release
```

- The workflow matrix is **include-only** (5 build jobs). Do not switch back to
  an `os:` axis + `include` — multiple include entries sharing an os value
  silently collapse (x64 Linux/macOS jobs vanished when it was written that way).
- `build:renderer` runs in the workflow before packaging — keep it.
- Late fixes after a release: amend, push, then **delete + re-create the tag**
  (`git tag -d vX.Y.Z && git push origin :refs/tags/vX.Y.Z && git tag vX.Y.Z && git push origin vX.Y.Z`).
  The release step updates the existing release in place.
- Cancelling a bad release: `gh run cancel <run-id>` (repo-owner auth).

## Known quirks & follow-ups

- `UI.scrollContents` is dead code (no callers) — safe to remove or repurpose.
- `src/types/globals.d.ts` expando declarations must stay mutually consistent
  (the `HTMLElement.next` vs `ChildNode.next` clash broke element assignability).
- The character picker attaches both `tb.onmouseup` and `window.onmouseup` in
  `Library.selectAsset`; `clickMe` nulls them after the first call, but the
  pattern is fragile — prefer a single delegated handler.
- CI does not boot-verify packaged artifacts (`scripts/smoke.js` is local-only).
  A smoke step in the workflow would catch packaging regressions like the
  missing-bundle one.
- `MediaLib.keys` is populated asynchronously at runtime — tests must not depend
  on it (use the `Page`-with-data construction above).
