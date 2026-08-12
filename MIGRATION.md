# ScratchJr TypeScript Migration Plan

**Goal:** reduce maintenance pain — hidden dependencies (globals), no type safety, hard-to-trace bugs.
**Non-goal:** visual/style restructure, framework adoption, file splitting (unless separately justified mid-flight).
**Constraint:** packaging (`npm run make` → Win MSI/zip, macOS zip, Linux deb/rpm/AppImage) must keep working on every phase. esbuild consumes `.ts` natively, so the bundle → forge pipeline is unaffected.

**How to read this file:** every phase has `Status`. Update `Status` and the progress table below as work lands. Each phase ends with a commit on branch `ts-migration`.

---

## Progress Tracker

| Phase | Name | Status | Commit |
|------:|------|--------|--------|
| 0 | Baseline & branch | ✅ done (tests 80/80, lint 0err/8warn, package works) | ba68b08 |
| 1 | TypeScript scaffolding | ✅ done (tsconfig, typecheck CI step, esbuild .ts proof) | ba68b08 |
| 2 | Leaf modules (lib, geom, small utils) | ✅ done 9 files, tests/lint/typecheck green | 34c3088 |
| 3 | Mid-size utils & entry points | ✅ done 8 files, all pages load (smoke PASS), main-process sql-validator.ts require fixed | 5de8407 |
| 4 | Lobby + iPad shim | ✅ done 6 files, persistence tests added (88 tests), smoke PASS | aaa81ef, 7c77ae5, e4c095b |
| 5 | Engine core | ✅ done 7 files (6 engine + BlockSpecs pulled forward), smoke PASS | c8954eb |
| 6 | Editor UI | ☐ not started | |
| 7 | Paint editor | ☐ in progress | |
| 8 | ScratchJr.js + globals teardown | ☐ not started | |
| 9 | Strict mode + cleanup | ☐ not started | |

**Global metrics** (fill in at each phase end):
- Files converted: `42 / 56`
- eslint `globals` entries remaining in package.json: `12` (AndroidInterface, window, WebKitCSSMatrix, webkitAudioContext, electron, require, ScratchJr, Undo, Home, loadPage, devicePixelRatio, globalThis, isTouch — count at baseline, then shrink)
- `tsc --noEmit` errors: `0`

### Phase 2 notes (worth remembering)
- **One behavior change shipped**, documented here because it's user-visible: `Rectangle.union()` no longer mutates the receiver / argument by setting `extentsw`/`extentsh`; it returns a fresh `Rectangle` instead. The old mutation was a latent bug (any subsequent read of those fields outside the call saw stale data). If any subtle layout bug shows up, this is the first suspect — but it was the right call.
- **vitest resolveDotTs plugin** added to `vitest.config.mjs`: maps `./x.js → ./x.ts` when the .js doesn't exist. Legacy import sites can keep writing `./foo.js` and still resolve to the converted file.
- **eslint resolver**: added `import/resolver` node extensions `.js`, `.ts`, `.d.ts` to package.json so `import/no-unresolved` follows converted files.
- Sound.ts auto-declares its 5 instance fields (`url`, `soundPlayId`, `name`, `time`, `playing`) — the host (Android vs iOS) decides which are live.
- `src/types/globals.d.ts` declares `AndroidInterface` + host-level window keys so typecheck passes on files still importing them via incomplete shims.

### Phase 3 notes (worth remembering)
- **`allowJs` infers types for `.js` imports** — converting a `.js` file to `.ts` immediately re-types its consumers (e.g. `gn()` became `HTMLElement | null`, `getUrlVars()` became `any[]` once lib.ts landed). Expect cascade fixes in the same phase.
- **`getUrlVars` returns a hybrid bag** (array + named query props). `string[] & Record<string, string>` is *not* expressible (TS arrays lack a string index signature), so the return is typed `Record<string, string>` with a single `as unknown as` cast inside lib.ts; all callers read named props only.
- **`Number.prototype.mod`** needed a `declare global { interface Number { mod(n: number): number } }` augmentation before the assignment.
- **IE-era DOM paths** (`style.styleSheet.cssText`, `CSSRule.styleSheet.rules`, `CSSRule.WEBKIT_KEYFRAMES_RULE`) are absent from TS lib.dom — guarded with `'prop' in obj` runtime narrowing per repo rule (no inline cast-access). `findKeyframesRule` previously *crashed* on these in Chromium; it now returns null gracefully.
- **Main process cannot require extensionless `.ts`**: `src/main/ipc-handlers.js` broke at boot (`Cannot find module '../lib/sql-validator'`) after Phase 2's rename. Fix: explicit `require('../lib/sql-validator.ts')` — Electron 42's Node 24.18.1 strips types natively. This is why the Phase 3 smoke gate matters: `npm test`/lint/typecheck were all green while the app failed to boot.
- `WebKitCSSMatrix` is declared as a concrete class in `src/types/globals.d.ts` (m41/m42/m11/m22 used by Events/lib).
- `window.Settings` typed as `ScratchJrSettings` (full shape from settings.json), `window.tablet` as `TabletBridge` (all ElectronDesktopInterface methods), `window.ScratchAudio` as `ScratchAudioGlobal` (read via `window.parent` by in-app help pages).



---

## Rules for every phase (read once, apply always)

1. **Convert, don't refactor.** Rename `.js` → `.ts`, fix only what `tsc` flags, stop. Behavioral fixes are separate commits.
2. **After each file:** `npm test` (vitest), `npm run lint`, `npm run typecheck`. After each phase: `npm run build:renderer` + `npm start` smoke check (app opens, editor loads, paint editor opens, project saves/loads).
3. **Globals rule:** any file you touch must *import* what it uses instead of reading `window.ScratchJr` etc. The global shim stays until Phase 8; don't delete early.
4. **Commit per file or per small directory**, message: `migrate(ts): <path>`.
5. **Never touch:** `src/app/src/snap/snap.svg-min.js`, anything under `src/app/dist/`, vendored assets. Explicitly excluded in tsconfig.
6. If a phase stalls on a hard typing problem > 30 min, suppress with `// @ts-expect-error TODO(phase-9)` and move on — Phase 9 tightens everything.

---

## Phase 0 — Baseline & branch
**Status:** ☐ not started
**Effort:** ~1 hr

- [ ] `git checkout -b ts-migration`
- [ ] Record green state: `npm test`, `npm run lint`, `npm run build:renderer`, `npm start` (manual: open editor, open paint, save+reload project)
- [ ] Record `npm run make64` produces an MSI on this machine (confirms packaging works *before* we touch anything)
- [ ] Paste metric numbers into Global metrics above

**Done when:** all checks green on a clean branch, numbers recorded.

---

## Phase 1 — TypeScript scaffolding
**Status:** ☐ not started
**Effort:** ~2–4 hr

- [ ] `npm i -D typescript` (also `@types/node` — sql.js and esbuild need node typings server-side)
- [ ] Create `tsconfig.json`:
  ```jsonc
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "bundler",
      "allowJs": true,        // JS keeps compiling untouched
      "checkJs": false,       // no type errors on existing JS
      "strict": false,        // flipped per-area later, globally in Phase 9
      "noEmit": true,
      "esModuleInterop": true,
      "skipLibCheck": true,
      "lib": ["ES2022", "DOM"],
      "types": ["node"]
    },
    "include": ["src/**/*.ts", "src/**/*.js"],
    "exclude": [
      "src/app/src/snap/**",
      "src/app/dist/**",
      "src/app/pnglibrary/**", "src/app/svglibrary/**",
      "node_modules"
    ]
  }
  ```
- [ ] Add script: `"typecheck": "tsc --noEmit"`
- [ ] Add `npm run typecheck` to the CI workflow (`.github/workflows/`) next to lint/test
- [ ] Sanity: create a throwaway `src/app/src/utils/tscheck.ts` exporting one typed function, `import` it from an existing JS file, run `npm run build:renderer` — bundle builds → esbuild picks up `.ts` with zero config. Then delete the throwaway.
- [ ] Commit: `migrate(ts): scaffolding (tsconfig, typecheck script, CI)`

**Done when:** `npm run typecheck` exits 0 on the untouched JS codebase, esbuild proved to ingest `.ts`.

---

## Phase 2 — Leaf modules
**Status:** ☐ not started
**Effort:** ~1 day
**Why first:** no globals, pure logic, fewest importers — validates the workflow before touching anything risky.

- [ ] `src/lib/path-utils.js` (25 ln) — already has tests (`d5f39b9`), convert + keep them green
- [ ] `src/lib/sql-validator.js` (41 ln)
- [ ] `src/app/src/geom/Matrix.js` (83 ln)
- [ ] `src/app/src/geom/Vector.js` (86 ln)
- [ ] `src/app/src/geom/Rectangle.js` (133 ln)
- [ ] `src/app/src/utils/Cookie.js` (28 ln)
- [ ] `src/app/src/utils/AppUsage.js` (39 ln)
- [ ] `src/app/src/utils/Sound.js` (53 ln)
- [ ] `src/app/src/utils/DrawPath.js` (59 ln)
- [ ] Update import sites of each (grep before converting)
- [ ] Smoke: build renderer, launch

**Done when:** 9 files `.ts`, checks green, phase smoke passes.

---

## Phase 3 — Mid-size utils & entry points
**Status:** ✅ done
**Effort:** ~1–2 days

- [ ] `src/app/src/utils/Localization.js` (80 ln)
- [ ] `src/app/src/utils/ScratchAudio.js` (90 ln)
- [ ] `src/app/src/entry/editor.js` (18 ln)
- [ ] `src/app/src/entry/home.js` (23 ln)
- [ ] `src/app/src/entry/gettingstarted.js` (26 ln) — entry points last within phase, they're thin bootstraps
- [ ] `src/app/src/entry/inapp.js` (183 ln)
- [ ] `src/app/src/entry/index.js` (185 ln)
- [ ] `src/app/src/utils/Events.js` (301 ln) — event plumbing, likely touches globals: imports must be explicit here
- [ ] `src/app/src/utils/lib.js` (655 ln) —misc grab-bag; if two unrelated halves emerge, note for later split, don't split now

**Done when:** 8 more files `.ts`, all pages (home/editor/gettingstarted/inapp) load in the app.

---

## Phase 4 — Lobby + iPad shim
**Status:** ✅ done
**Effort:** ~1 day

- [ ] `src/app/src/iPad/MediaLib.js` (61 ln)
- [ ] `src/app/src/iPad/iOS.js` (325 ln)
- [ ] `src/app/src/iPad/IO.js` (641 ln) — persistence layer, highest care: save/load correctness. Add a round-trip test if none exists.
- [ ] `src/app/src/lobby/Samples.js` (105 ln)
- [ ] `src/app/src/lobby/Home.js` (299 ln) — conversion removes the `Home` global consumer path
- [ ] `src/app/src/lobby/Lobby.js` (315 ln)

**Done when:** 6 more files `.ts`, project open/save/thumbnail flow verified manually, `Home` no longer read as a bare global anywhere (verify with grep).

---

## Phase 5 — Engine core
**Status:** ✅ done
**Effort:** ~2 days
**Note:** runtime execution correctness — convert with extra save/run tests in hand.

- [ ] `src/app/src/editor/engine/Thread.js` (161 ln)
- [ ] `src/app/src/editor/engine/Runtime.js` (174 ln)
- [ ] `src/app/src/editor/engine/Page.js` (503 ln)
- [ ] `src/app/src/editor/engine/Prims.js` (597 ln)
- [ ] `src/app/src/editor/engine/Stage.js` (676 ln)
- [ ] `src/app/src/editor/engine/Sprite.js` (1101 ln) — largest engine file; convert alone, own commit
- [ ] Manual check: sample project runs, blocks animate, sounds play

**Done when:** engine `.ts`, sample project runs end-to-end.

---

## Phase 6 — Editor blocks & UI
**Status:** ✅ done
**Effort:** ~2–3 days

Blocks first (smaller), then UI:
- [ ] `editor/blocks/Menu.js` (98 ln)
- [ ] `editor/blocks/BlockSpecs.js` (289 ln)
- [ ] `editor/blocks/BlockArg.js` (421 ln)
- [ ] `editor/blocks/Block.js` (473 ln)
- [ ] `editor/ui/Alert.js` (69 ln)
- [ ] `editor/ui/Grid.js` (246 ln)
- [ ] `editor/ui/ScriptsPane.js` (293 ln)
- [ ] `editor/ui/Record.js` (318 ln)
- [ ] `editor/ui/Undo.js` (398 ln) — removes the `Undo` global consumer
- [ ] `editor/ui/Scroll.js` (437 ln)
- [ ] `editor/ui/Library.js` (499 ln)
- [ ] `editor/ui/Palette.js` (556 ln)
- [ ] `editor/ui/Project.js` (558 ln)
- [ ] `editor/ui/Thumbs.js` (610 ln)
- [ ] `editor/ui/Scripts.js` (660 ln)
- [ ] `editor/ui/UI.js` (1096 ln)

**Done when:** blocks+ui `.ts`, editor fully usable; `Undo` gone from eslint globals.

---

## Phase 7 — Paint editor
**Status:** ☐ not started
**Effort:** ~2 days

- [ ] `painteditor/PaintUndo.js` (148 ln)
- [ ] `painteditor/Camera.js` (189 ln)
- [ ] `painteditor/SVGImage.js` (299 ln)
- [ ] `painteditor/Layer.js` (423 ln)
- [ ] `painteditor/Transform.js` (476 ln)
- [ ] `painteditor/Ghost.js` (481 ln)
- [ ] `utils/SVG2Canvas.js` (963 ln) — lives in utils but only used here; convert with this phase
- [ ] `painteditor/SVGTools.js` (898 ln)
- [ ] `painteditor/PaintAction.js` (1104 ln)
- [ ] `painteditor/Paint.js` (1361 ln)
- [ ] `painteditor/Path.js` (1969 ln) — biggest file in the repo; own day, own commit, extra `@ts-expect-error` acceptable here

**Done when:** paint editor `.ts`, draw/erase/undo/save flow works.

---

## Phase 8 — ScratchJr.js + globals teardown
**Status:** ☐ not started
**Effort:** ~1 day

- [ ] `editor/ScratchJr.js` (885 ln) — converts now that every consumer is typed
- [ ] Delete the global shim assignments (`window.ScratchJr = …` etc.)
- [ ] Remove the remaining entries from `eslintConfig.globals` in package.json: `ScratchJr`, `Undo`, `Home`, `loadPage`, `isTouch`, `devicePixelRatio` as each disappears. Keep browser-provided ones (`window`, `WebKitCSSMatrix`, `webkitAudioContext`, `devicePixelRatio` if still browser APIs).
- [ ] `grep -rn "window\.ScratchJr\|[^.]Undo\.\|[^.]Home\." src/app/src` → should return nothing

**Done when:** global namespace gone, lint passes with a near-empty `globals` map.

---

## Phase 9 — Strict mode + cleanup
**Status:** ☐ not started
**Effort:** ~2–3 days (unbounded if old typing debt surfaces; timebox and file follow-ups)

- [ ] tsconfig: `strict: true` (or step through `noImplicitAny` → `strictNullChecks` individually if the all-at-once error count is scary)
- [ ] Burn down errors; every `// @ts-expect-error TODO(phase-9)` from earlier phases resolved or filed as issue
- [ ] Delete dead code the compiler now flags (`noUnusedLocals` if desired)
- [ ] Update README/CONTRIBUTING: TS build/test/typecheck commands
- [ ] Final full validation: `npm test && npm run lint && npm run typecheck && npm run build:renderer`
- [ ] Final packaging validation: `npm run make64` (Win MSI+zip) on Windows; CI matrix builds deb/rpm/AppImage/darwin-zip
- [ ] Merge `ts-migration` → main

**Done when:** strict on, all artifact makers still produce identical installables, docs updated.

---

## Deferred / explicitly out of scope
- Splitting Path.js / Paint.js / UI.js / Sprite.js — only if a concrete editing pain emerges post-migration
- Prettier / mass reformat — destroys blame mid-migration
- Framework adoption — no
- Touching `snap.svg-min.js` / vendored libraries

## Rollback
Every phase is a commit set on `ts-migration`. Any phase that can't go green → revert that phase's commits; earlier phases still stand because each was independently validated.
