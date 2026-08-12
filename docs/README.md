# Documentation

- **[ipc-inventory.md](./ipc-inventory.md)** — the IPC channel map: all 19 channels, async transport model, bridge API, and how to add a channel
- **[development.md](./development.md)** — how the project is built, tested, and released, plus the editor layout/limits map and known quirks

## Quick orientation

- Renderer sources: `src/app/src/**/*.ts` (TypeScript, full strict mode)
- Main process: `src/main.js` + `src/main/*.js`
- Tests: `npm test` (vitest; `tests/unit/` — main-process + jsdom renderer harness)
- Package: `npm run make:zip` (builds the renderer bundle first — never skip that)
- Release: bump version → commit → tag `v*.*.*` → CI builds all six targets
