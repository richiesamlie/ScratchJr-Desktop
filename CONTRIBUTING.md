# Contributing

Thanks for your interest in **ScratchJr Reborn** — a modernized desktop port of
ScratchJr for Windows, macOS, and Linux.

## How to contribute

- **Report bugs** — open an issue on this repository
  ([richiesamlie/ScratchJr-Desktop-Reborn](https://github.com/richiesamlie/ScratchJr-Desktop-Reborn)).
  Be descriptive: what you did, what you expected, and what happened
  (screenshots help).
- **Fix bugs / add features** — fork, make your changes on a branch, and open a
  pull request with an explanation of what changed and why.

## Before opening a PR

All code must pass the project gates:

```bash
npm run lint      # ESLint (airbnb-base)
npm run typecheck # tsc --noEmit over the strict TypeScript renderer
npm test          # vitest suite (main-process + jsdom renderer harness)
```

Additional guidance:

- Renderer changes: keep TypeScript strict (no new `any`), reuse the typed
  project-format bags in `src/app/src/editor/ui/Project.ts`, and cover new
  logic with a jsdom test in `tests/unit/` (see
  [docs/development.md](docs/development.md) for conventions).
- The renderer bundle is gitignored and rebuilt by `make:zip` — no need to
  commit it, but do run `npm run build:renderer` after renderer changes before
  packaging or boot-verifying.
- See [docs/](docs/README.md) for the architecture and development guides.

## License

This port retains the original project's **BSD 3-Clause** license (MIT, 2016).
By contributing you agree to license your contribution under the same terms.

## Acknowledgements

The original ScratchJr: [LLK/ScratchJr](https://github.com/LLK/scratchjr) by MIT.
The original desktop port: [JustSch/ScratchJr-Desktop](https://github.com/JustSch/ScratchJr-Desktop).
