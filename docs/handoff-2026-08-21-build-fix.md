# Handoff — 2026-08-21: Electron upgrade + `npm run make` fix

Context for the next agent picking up this repo. Verified working state as of commit `e6c8f96` on `master`.

## What happened

- Version bumped **1.5.7 → 1.5.8** (`package.json` + `src/app/settings.json` `desktop-v1.5.8`), tagged `v1.5.8`, pushed. Commits: `322a50a`, `b2482f7`, `e6c8f96`.
- Upgraded **Electron 42.8.1 → 43.4.1** and **@electron/packager 20.2.0 → 20.3.0** (`b2482f7`).
- Fixed `npm run make` silently producing nothing on Node 26 (`e6c8f96`).

## The `npm run make` bug — root cause

`@electron-forge/core@7.11.2` depends on `@electron/packager@^18.3.5` → installed a **nested 18.4.4**. Its `promisifyHooks` calls `util.promisify` on Promise-returning hooks (`DEP0174` warning under Node 26). Forge finished packaging, then made **no artifacts** and exited 0. The top-level `@electron/packager@20.3.0` uses plain `runHooks` (no promisify) — that is why the `scripts/package-and-zip.js` path always worked.

### The fix (one line, in `package.json` `overrides`)

```json
"@electron/packager": "$@electron/packager"
```

The `$` reference forces every nested copy (under `@electron-forge/core` and `@electron-forge/shared-types`) to match the direct dependency spec `^20.3.0`. npm dedupes them away entirely; the lockfile dropped ~947 lines of nested 18.4.4 subtree.

Rejected alternatives (don't retry):
- `"@electron/packager": "20.3.0"` → `EOVERRIDE` (conflicts with the direct dep, must use `$` reference)
- `"@electron-forge/core > @electron/packager"` / `"@electron-forge/core>@electron/packager"` → `EINVALIDPACKAGENAME` (npm 12 rejects these key forms)
- nested object form `"@electron-forge/core": { "@electron/packager": "..." }` → silently ignored by npm 12

## Verification (run on this machine)

- Env: Node **v26.6.0**, npm **12.0.2**, Windows, PowerShell. Commands go through `rtk`; its output mangles identifiers (`core_utils_1.n` etc.) and eats `rg` output — use the Grep tool or `node -e` for grep-like checks.
- **Stale env var trap**: the shell inherits `npm_config_user_agent=npm/undefined node/v24.3.0` from the opencode/rtk host. Forge's system check then fails with *"Could not check npm version 'undefined'"*. Set it before any forge run:

```powershell
$env:npm_config_user_agent='npm/12.0.2 node/v26.6.0 win32 x64 workspaces/false'
```

- **npm 12 git-dep trap**: any clean `npm install` fails with `EALLOWGIT` because `@electron/node-gyp` is a git dependency. Use:

```powershell
npm install --allow-git=all
```

  Install scripts are also blocked by default (esbuild, electron-winstaller, exe-icon-extractor) — warnings are expected; `patch-for-node26.js` runs via postinstall and reports its patches.

### Commands that pass

- `npm test` → 103/103 tests pass (vitest)
- `npm run make -- --targets @electron-forge/maker-zip` → `out/make/zip/win32/x64/ScratchJr-win32-x64-1.5.8.zip` (182 MB, complete)
- `node scripts/smoke-packaged.js out/ScratchJr-win32-x64` → PASS
- `node check-asar.cjs` → maxPages 8, CSS scrollable true

## Known open items (not bugs)

- **`npm run make` (full, all makers) fails only at the wix maker**: needs WiX toolkit (`candle.exe`/`light.exe`) on PATH. Same external requirement as `scripts/build-msi.js` (looks for WiX in `out/wix3/`). Install WiX to get the MSI target; otherwise use `--targets @electron-forge/maker-zip`.
- **`make32`/`makeAll` scripts still reference win32-ia32**: Electron 43.4.1 is the last series shipping ia32. Flagged, non-blocking; update or drop those scripts when convenient.
- npm audit reports 19 high-severity vulnerabilities (pre-existing, not acted on).
- CI (`.github/workflows/build-release.yml`) runs Node 22 LTS + `npm ci` on tag push — unaffected by the Node 26 fixes, but if it ever moves to npm 12 it needs `--allow-git=all` and the `allowScripts` list.

## Key files

- `package.json` — the `@electron/packager` `$` override; electron `^43.4.1`, packager `^20.3.0`
- `node_modules/@electron-forge/core/node_modules/@electron/packager/dist/hooks.js` — was the buggy `promisifyHooks` (now deduped away)
- `node_modules/@electron/packager/dist/hooks.js` — v20.3.0 `runHooks` (the working semantics)
- `scripts/patch-for-node26.js` — postinstall patcher for forge core + cross-zip under Node 26
- `scripts/package-and-zip.js` — working Windows build path (calls top-level packager directly); `npm run make:zip`
- `scripts/build-msi.js` — MSI build, requires WiX in `out/wix3/`
- `scripts/smoke-packaged.js`, `check-asar.cjs` — verification scripts
- `forge.config.js` — makers: wix (win32), zip (all), deb/rpm (linux), appimage

## Repo layout reminder

- Renderer: `src/app/src/**/*.ts` (strict TS)
- Main process: `src/main.js` + `src/main/*.js`
- `out/` and `ScratchJr-*.zip` are gitignored; artifacts are regenerated locally or by CI