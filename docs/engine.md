# Editor Engine Architecture

How the ScratchJr editor works under the hood — the module graph, the runtime
execution model, and the UI coordination. Read this before touching editor logic.

## Module graph (high level)

```
ScratchJr (static orchestrator: story state, autosave, focus, statics)
  ├── Stage          — pages[], current page, sprite/page operations
  │     └── Page     — sprites list, backgrounds, current sprite, encode/decode
  │           └── Sprite — DOM div + image/svg asset, sounds, scripts (code)
  │                 └── Scripts — block containers, strip decode (recreateStrip)
  │                       └── Block / BlockArg — visual blocks, .next/.prev/.inside chains
  ├── Runtime        — thread scheduler (setInterval-driven state machine)
  │     └── Thread   — per-running-script execution state (thisblock, waitTimer, stack…)
  │           └── Prims — the primitives themselves (Home, Say, Move, Repeat…)
  ├── Thumbs         — sprite strip + page strip UI, thumbnails, drag math
  ├── Palette / ScriptsPane / UI — block palette, script editing, chrome
  ├── Undo           — snapshot-based undo (Project.getUndo + action)
  ├── Library        — the character/background picker (media.json-backed)
  └── Events         — global drag/scroll/gesture machinery
```

## The runtime execution model

Scripts are block chains. When the green flag (or a touch) starts a script:

1. `ScratchJr.startCurrentPageStrips(['onflag', 'ontouch'])` finds matching
   top blocks and calls `Runtime.addRunScript(spr, block)`.
2. `Runtime` owns a `setInterval` tick loop (`Runtime.ts:25`) that calls
   `stepAll()` → `step(n)` per running thread.
3. `step(n)` is the state machine (`Runtime.ts:73`):
   - `waitTimer > 0` → decrement and return (primitives may span multiple ticks)
   - `yield` set by a primitive → return (e.g. a running animation)
   - `thisblock == null` → `endCase()` (thread finished)
   - otherwise → `runPrim()` — dispatch to `Prims[blocktype]`
4. Primitives advance the thread by setting `strip.thisblock = strip.thisblock.next!`
   (or pushing onto `stack` for `repeat`, or setting `waitTimer`/`yield` for
   multi-tick behavior like motion easing and `wait`).

`Thread` state that matters: `firstBlock`, `thisblock`, `oldblock`, `stack`
(repeat nesting), `waitTimer`, `count`, `vector`, `distance`, `isRunning`,
`called` (spawned sub-threads).

## The project file format

See [development.md](./development.md) — typed as `ProjectData` / `PageData` /
`SpriteData` / `EncodedStrip` in `src/app/src/editor/ui/Project.ts`. Key flow:

- **Save**: `Project.getProject(pageId)` → per page `Page.encodePage()` → per
  sprite `Sprite.getData()` → per script `Project.encodeStrip(headBlock)`
  (walks the `.next` chain — one strip per script).
- **Load**: `Project.recreatePage(id, data)` → `Page.loadPageData` →
  `Project.recreateObject` per sprite → `Scripts.recreateStrip(strip)` per strip.
- **Undo**: `Undo.record(action)` snapshots `Project.getUndo()` and merges the
  action descriptor; `Undo.smartRecreate` replays. The snapshots are the file
  format — keep `Undo.ts` on the shared types.

## UI coordination

- **Sprite strip** (`Thumbs.updateSprites`) rebuilds from
  `page.sprites` (JSON list of sprite ids). The strip scrolls natively —
  `scrollTop` on `.spritethumbs` is the single source of truth (drag scroll,
  `spriteInView`, and the reset in `updateSprites` all write it; the custom
  scrollbar is synced by a `scroll` listener).
- **Page strip** (`Thumbs.updatePages`) rebuilds page thumbs; `#emptypage`
  (the + page button) is `position: sticky; bottom: 0` inside the scroller.
- **Selection**: `Page.setCurrentSprite` drives the scripts panel
  (`gn('<spriteId>_scripts')`), the palette, and highlights.
- **Undo hooks**: `Page.update(spr)` records a `modify` undo entry; mutations
  go through `Stage`/`Page` methods that record before the change.

## Limits & layout constraints

| Limit / area | Where | Current value |
|---|---|---|
| Pages per project | `window.Settings.maxPages` in `Thumbs.updatePages` | 8 (`src/app/settings.json`) |
| Character sidebar height | `#library .spritethumbs` `max-height` | `calc(100% - 10.29vh-px)` |
| + button visibility | `.addsprite` / `#emptypage` | always visible (sized/pinned to fit) |

**Hard boundary:** `#blockspalette` (z-index 10) starts exactly at the left
panel's bottom and covers everything below it in the left column. Left-column
UI must end above that line.

## Extending the editor

- **New primitive**: add the method to `Prims` (dispatch is by `blocktype`),
  register the block in `BlockSpecs.setupBlocksSpecs()`, and cover it with a
  jsdom test in `tests/unit/renderer-editor.test.js` (see development.md for the
  harness conventions).
- **New project data field**: add it to the typed bags in `Project.ts`
  (`ProjectData`/`PageData`/`SpriteData`), write it in
  `Sprite.getSpriteData()`/`Page.encodePage()`, read it in
  `Page.loadPageData()`/`Project.recreateObject()`, and extend the round-trip
  tests.
- **New IPC channel**: follow the checklist in [ipc-inventory.md](./ipc-inventory.md).
