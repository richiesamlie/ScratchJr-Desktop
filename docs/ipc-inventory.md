# IPC Channel Inventory

Complete map of IPC between the main process (`src/main/ipc-handlers.js`) and
the renderer. The renderer never touches `ipcRenderer` directly — it goes
through the preload bridge exposed as `window.scratchjr` (`src/preload.js`,
adapter in `src/electronClient.js`).

## Transport model (current)

- **17 request/response channels** — `ipcRenderer.invoke` / `ipcMain.handle` (async, Promise-based)
- **2 push channels** — `ipcRenderer.send` / `ipcMain.on` (fire-and-forget)
- **0 `sendSync`** — the old synchronous transport is fully removed
- Renderer access is restricted to the named bridge methods; no raw `ipcRenderer` is exposed

## Main → Renderer (push)

| Channel | Direction | Payload | Notes |
|---------|-----------|---------|-------|
| `app-close` | main → renderer (`ipcMain.on` in preload) | none | Tells renderer to flush data before exit; renderer replies `app-closed-acked` |
| `databaseRestored` | main → renderer | none | DB restored from backup; renderer reloads `index.html?back=yes` |
| `keyboard-shortcut` | main → renderer | `string` (save/undo/new/redo) | Registered on `did-finish-load` |

## Renderer → Main (request/response, async invoke)

### Settings & Resources

| Channel | Args | Return | Bridge method |
|---------|------|--------|---------------|
| `io_getsettings` | `null` | `string` (csv: documentsPath,debug,soundPerm,cameraPerm) | `scratchjr.io_getsettings()` |
| `io_gettextresource` | `filename: string` | `string \| null` (file contents) | `scratchjr.io_gettextresource(filename)` |
| `io_getIsDebug` | unused | `boolean` | `scratchjr.io_getIsDebug()` |

### File I/O

| Channel | Args | Return | Bridge method |
|---------|------|--------|---------------|
| `io_setfile` | `{name, contents}` | `boolean` | `scratchjr.io_setfile(name, btoa_str)` |
| `io_getfile` | `filename: string` | `string \| null` (base64) | `scratchjr.io_getfile(str)` |
| `io_remove` | `filename: string` | `boolean` | `scratchjr.io_remove(str)` |
| `io_cleanassets` | `fileType: string` | `true` | `scratchjr.io_cleanassets(str)` |
| `io_getmd5` | `data: string` | `string \| null` (hex md5) | `scratchjr.io_getmd5(str)` |

### Media I/O

| Channel | Args | Return | Bridge method |
|---------|------|--------|---------------|
| `io_getmedia` | `filename: string` | `string \| null` (base64) | `scratchjr.io_getmedia(file)` |
| `io_getmediadata` | `key, offset, length` | `string \| null` (substring) | `scratchjr.io_getmediadata(key, offset, length)` |
| `io_getmediadone` | `key: string` | `true` | `scratchjr.io_getmediadone(key)` |
| `io_getmedialen` | `file, key` | `number` | `scratchjr.io_getmedialen(file, key)` |
| `io_setmedia` | `base64ContentStr, ext` | `string \| null` (filename) | `scratchjr.io_setmedia(str, ext)` |
| `io_setmedianame` | `encodedData, key, ext` | `string \| null` (filename) | `scratchjr.io_setmedianame(str, name, ext)` |
| `io_getAudioData` | `audioName: string` | `string \| null` (data URI) | `scratchjr.io_getAudioData(name)` |

### Database

| Channel | Args | Return | Bridge method |
|---------|------|--------|---------------|
| `database_stmt` | `{stmt, values}` | `any` (stmt result) | `scratchjr.database_stmt(json)` |
| `database_query` | `{stmt, values}` | `string` (JSON array) | `scratchjr.database_query(json)` |

## Push (renderer → main)

| Channel | Args | Notes |
|---------|------|-------|
| `debugWriteLog` | `args: any` | `scratchjr.debugWriteLog(args)` |
| `app-closed-acked` | none | `scratchjr.sendAppClosedAcked()` — renderer ack after `app-close`; main saves DB and exits |

## Adding a new channel

1. `src/main/ipc-handlers.js` — add `ipcMain.handle('name', ...)` (or `ipcMain.on` for push)
2. `src/preload.js` — expose a named bridge method
3. `src/electronClient.js` — call `window.scratchjr.<method>` (do NOT use `ipcRenderer` in renderer code — it is sandboxed away)
4. Add a vitest case in `tests/unit/preload-bridge.test.js` / `layout-bootstrap-ipc-contract.test.js`
5. Update this inventory
