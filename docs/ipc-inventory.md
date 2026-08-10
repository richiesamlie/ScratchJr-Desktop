
# IPC Channel Inventory

Complete map of all IPC channels between main process (`src/main.js`) and renderer (`src/electronClient.js`).

Generated from codebase audit. Each channel documents: name, direction, sync/async pattern, payload, return value, and migration batch.

## Main → Renderer (push)

| Channel | Trigger | Payload | Notes |
|---------|---------|---------|-------|
| `app-close` | Window close event | none | Tells renderer to flush data before exit |
| `databaseRestored` | DB restored from backup | none | Renderer reloads `index.html?back=yes` |
| `keyboard-shortcut` | Global shortcut | `string` (save/undo/new/redo) | Registered on `did-finish-load` |

## Renderer → Main (request/response)

### Settings & Resources (Batch B1)

| Channel | Sync | Args | Return | Renderer method |
|---------|------|------|--------|-----------------|
| `io_getsettings` | `sendSync` | `null` | `string` (csv: documentsPath,debug,soundPerm,cameraPerm) | `io_getsettings()` |
| `io_gettextresource` | `sendSync` | `filename: string` | `string\|null` (file contents) | `io_gettextresource(filename)` |
| `io_getIsDebug` | `sendSync` | unused | `boolean` | (not in ElectronDesktopInterface) |

### File I/O (Batch B2)

| Channel | Sync | Args | Return | Renderer method |
|---------|------|------|--------|-----------------|
| `io_setfile` | `sendSync` | `{name, contents}` | `boolean` | `io_setfile(name, btoa_str)` |
| `io_getfile` | `sendSync` | `filename: string` | `string\|null` (base64) | `io_getfile(str)` |
| `io_remove` | `sendSync` | `filename: string` | `boolean` | `io_remove(str)` |
| `io_cleanassets` | `sendSync` | `fileType: string` | `true` (always) | `io_cleanassets(str)` |
| `io_getmd5` | `sendSync` | `data: string` | `string\|null` (hex md5) | `io_getmd5(str)` |

### Media I/O (Batch B2)

| Channel | Sync | Args | Return | Renderer method |
|---------|------|------|--------|-----------------|
| `io_getmedia` | `sendSync` | `filename: string` | `string\|null` (base64) | `io_getmedia(file)` |
| `io_getmediadata` | `sendSync` | `key, offset, length` | `string\|null` (substring) | `io_getmediadata(key, offset, length)` |
| `io_getmediadone` | `sendSync` | `key: string` | `true` | `io_getmediadone(key)` |
| `io_getmedialen` | `sendSync` | `file, key` | `number` | `io_getmedialen(file, key)` |
| `io_setmedia` | `sendSync` | `base64ContentStr, ext` | `string\|null` (filename) | `io_setmedia(str, ext)` |
| `io_setmedianame` | `sendSync` | `encodedData, key, ext` | `string\|null` (filename) | `io_setmedianame(str, name, ext)` |
| `io_getAudioData` | `sendSync` | `audioName: string` | `string\|null` (data URI) | `io_registersound(dir, name)` |

### Database (Batch B3)

| Channel | Sync | Args | Return | Renderer method |
|---------|------|------|--------|-----------------|
| `database_stmt` | `sendSync` | `{stmt, values}` | `any` (stmt result) | `database_stmt(json)` |
| `database_query` | `sendSync` | `{stmt, values}` | `string` (JSON array) | `database_query(json)` |

### Debug

| Channel | Sync | Args | Return | Renderer method |
|---------|------|------|--------|-----------------|
| `debugWriteLog` | `sendSync` | `args: any` | `true` | (called directly via ipcRenderer) |

### Lifecycle (not in ElectronDesktopInterface)

| Channel | Sync | Args | Return | Notes |
|---------|------|------|--------|-------|
| `app-closed-acked` | `sendSync` | none | none | Renderer ack after receiving `app-close`; triggers DB save + app.exit() |

## Migration batches

- **B1** (settings/resources): `io_getsettings`, `io_gettextresource`, `io_getIsDebug`
- **B2** (file/media): `io_setfile`, `io_getfile`, `io_remove`, `io_cleanassets`, `io_getmd5`, `io_getmedia`, `io_getmediadata`, `io_getmediadone`, `io_getmedialen`, `io_setmedia`, `io_setmedianame`, `io_getAudioData`
- **B3** (database): `database_stmt`, `database_query`

## Critical constraints

1. `database_stmt` accepts raw SQL — security risk when `nodeIntegration: true`.
2. `app-closed-acked` must stay synchronous until Phase C (renderer needs to ack before main exits).
3. `io_getAudioData` does multi-path lookup (samples/ → sounds/ → DB) — must preserve this logic.
4. `io_getmediadata`/`io_getmediadone`/`io_getmedialen` form a chunked-read protocol — migrate as a unit.
