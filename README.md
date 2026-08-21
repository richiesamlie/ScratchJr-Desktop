# ScratchJr Reborn — Desktop Edition

> A modernized desktop port of [ScratchJr](https://scratchjr.org/) for Windows, macOS, and Linux.

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

---

## Features & Improvements

- **Expanded Canvas**: 8 pages by default (configurable), scrollable page strip, and always-visible add buttons.
- **Robust Storage & Recovery**: Auto-recovery SQLite database management with atomic saves, auto-backups, and integrity checks.
- **Security & Sandboxing**: Context-isolated renderer bridge, CSP policies, and strict input validation.
- **Strict TypeScript**: 100% TypeScript across renderer and main process with comprehensive test coverage.
- **Internationalization**: Full localization support with optional `--lang=<code>` CLI flag (e.g. `--lang=fr`).
- **Native Update Checker**: Built-in update checker via `File` → `Check for Updates...`.

For complete architectural details and developer guides, visit the **[Wiki](https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/wiki)**.

---

## Building from Source

**Prerequisites:** Node.js 22+ and Git.

```bash
# Install dependencies
npm install

# Run in development mode
npm start

# Run tests and typecheck
npm test
npm run typecheck

# Package portable ZIP or MSI
npm run make:zip
npm run make
```

---

## Official Disclaimer

Scratch and ScratchJr are trademarks of Massachusetts Institute of Technology, which does not sponsor, endorse, or authorize this content. See [scratchjr.org](https://scratchjr.org) for more information.

## License

[BSD 3-Clause](LICENSE) — Copyright (c) 2016, Massachusetts Institute of Technology.
