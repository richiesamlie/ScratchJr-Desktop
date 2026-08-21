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

### 🎨 Expanded Workspace & Desktop Ergonomics
- **8 Pages per Project**: Increased from the original 4-page limit to 8 pages by default (configurable via `maxPages` in `settings.json`).
- **Scrollable Page & Character Strips**: Native mouse-wheel scrolling and responsive layout keep pages and characters easily accessible.
- **Always-Visible Action Buttons**: "+" add-page and add-character buttons stay pinned on screen at any window size.
- **Responsive Layout**: Stage, scripts workspace, and block palette scale smoothly across varying desktop display heights.

### 💾 Robust Storage & Data Integrity
- **Atomic Database Writes**: Saves to a temporary file before renaming, preventing corruption if the app is abruptly closed.
- **Automatic Backup & Recovery**: Creates rolling `.bak` snapshots on every save and runs `PRAGMA integrity_check` on launch, auto-recovering from backup if needed.
- **Debounced Persistence**: Rapid changes are coalesced safely and flushed immediately during app shutdown to prevent data loss.

### 🛡️ Security & Modern Architecture
- **Sandboxed Renderer**: Built on **Electron 43** with strict `contextIsolation`, preventing direct Node.js execution in the browser process.
- **Content Security Policy & Sanitization**: Restrictive CSP on all pages, SQL parameterization, and strict file path boundaries.

### ⚡ Strict TypeScript & Testing
- **100% Strict TypeScript**: Entire codebase migrated to TypeScript with strict type checking (`strict: true`, zero `any`).
- **Comprehensive Test Suite**: 121 automated tests covering database persistence, project serialization, IPC contracts, and editor logic.

### 🌍 Classroom & Fleet Deployment
- **`--lang` CLI Flag**: Launch with explicit language overrides (e.g., `ScratchJr.exe --lang=fr`), ideal for school environments.
- **Native Update Checker**: Check for new releases directly from `File` → `Check for Updates...`.
- **Configurable MSI Installer**: Supports silent deployment and uninstallation options (`REMOVE_DATABASE=1`).

For architecture diagrams, IPC documentation, and developer guides, visit the **[Wiki](https://github.com/richiesamlie/ScratchJr-Desktop-Reborn/wiki)**.

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
