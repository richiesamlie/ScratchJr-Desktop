# Handoff: Save Flow Still Broken

> **Date:** 2026-08-21  
> **Last commit:** `accb729`  
> **Status:** Save and lobby display do not work. Project names show "undefined".

---

## 1. What the user reports

1. Create a new project → editor opens with project name **"undefined"**
2. Save in editor → appears to complete (alert closes)
3. Go back to lobby → the project **does not appear**
4. The app was freshly compiled from source

---

## 2. The save chain (complete trace)

```
User clicks "+"
  → Home.createNewProject()
    → obj.name = Home.getNextName(prefix || 'Project')     // e.g. "Project 1"
    → obj.version = version || '1.0.0'                      // e.g. "desktop-v1.5.9"
    → IO.createProject(obj, Home.gotoEditor)
      → iOS.stmt({ stmt: 'INSERT INTO projects (...) VALUES (?,?,?,?,?)', values: [...] }, gotoEditor)
        → tabletInterface.database_stmt(JSON.stringify(json))   [IPC to main process]
          → normalizeAndValidateSqlPayload(json)
          → db.stmt({ stmt, values })                          [sql.js execute]
          → returns last_insert_rowid()                        [e.g. 1]
          → if (result >= 0) db.savePending()                  [debounced disk save]
          → return result                                       [back to renderer]
        → fcn(result)                                          [callback fires]
          → Home.gotoEditor(1)
            → iOS.setfile('homescroll.sjr', scrollTop, ...)
              → doNext(1)
                → window.location.href = 'editor.html?pmd5=1&mode=edit'
```

Editor loads:
```
  → ScratchJr.appinit()
    → currentProject = urlvars.pmd5   // "1"
    → Project.load("1")
      → IO.getObject("1", Project.dataRecieved)
        → IO.getObjectinDB("projects", "1", callback)
          → iOS.query({ stmt: 'SELECT * FROM projects WHERE id = ?', values: ["1"] })
            → tabletInterface.database_query(...)
              → db.query(safeQuery) → [{ID:1, NAME:"Project 1", ...}]
            → callback('[{"ID":1,"NAME":"Project 1",...}]')
      → Project.dataRecieved(str)
        → data = JSON.parse(str)[0]
        → metadata = IO.parseProjectData(data)    // {id:1, name:"Project 1", ...}
        → Project.loadData(metadata.json, doneProjectLoad)
```

Save:
```
  → Project.save("1", whenDone)
    → metadata.id = "1"
    → metadata.json = Project.getProject(...)
    → Project.getThumbnailPNG(...) → getMD5(dataurl)
      → iOS.getmd5(pngBase64, callback)
        → iOS.setmedianame(pngBase64, filename, 'png', doNext)
          → tabletInterface.io_setmedianame(...)
            → io_setmedianame handler
              → db.saveToProjectFiles(md5, content)    [stores thumbnail in PROJECTFILES]
              → callback
        → doNext(md5)
          → metadata.thumbnail = { pagecount: N, md5: "..." }
          → IO.saveProject(metadata, resetSaving)
            → iOS.stmt({
                stmt: 'UPDATE projects SET version=?, deleted=?, name=?, json=?, thumbnail=?, mtime=? WHERE id=?',
                values: [version, 'NO', name, json, thumbnail, mtime, "1"]
              }, resetSaving)
              → tabletInterface.database_stmt(...)
                → db.stmt(safeQuery)
                → returns last_insert_rowid()   ← THIS IS THE PROBLEM (see below)
                → resetSaving()
```

Lobby reload (going back):
```
  → Home.init()
    → version = Lobby.version
    → Home.displayYourProjects()
      → iOS.getfile('homescroll.sjr', gotScrollsState)
        → gotScrollsState(str)
          → IO.query(iOS.database, {
              cond: 'deleted = ? AND version = ? AND gallery IS NULL',
              items: ['name', 'thumbnail', 'id', 'isgift'],
              values: ['NO', version]
            }, Home.displayProjects)
            → SELECT name, thumbnail, id, isgift FROM projects WHERE deleted='NO' AND version='...' AND gallery IS NULL ORDER BY ctime DESC
            → Home.displayProjects(str)
              → data = JSON.parse(str)
              → for each project: Home.addProjectLink(div, data[i])
                → txt.textContent = data.name || 'Project'
```

---

## 3. What changed from v1.5.9 (and what could break it)

### Change A: `database_stmt` handler now calls `db.savePending()` ( ipc-handlers.ts line 207)

```typescript
// OLD: just returned result, never saved to disk
return result;

// NEW: saves to disk if statement "succeeded"
if (result >= 0) {
    db.savePending();
}
return result;
```

**Why this is problematic:** `db.stmt()` returns `last_insert_rowid()` for ALL operations — INSERT, UPDATE, DELETE. For an UPDATE, `last_insert_rowid()` returns the ID of the **last INSERT ever executed**, not the current UPDATE. So:

- If the DB already has projects (IDs 1-5), and you UPDATE project #3, `stmt()` returns `5` (the last insert ID)
- `result >= 0` is true → `savePending()` runs
- The caller thinks the UPDATE succeeded, but it might have affected 0 rows

**This is likely fine** — the UPDATE probably does work. The issue is elsewhere.

### Change B: `stmt()` now has early `db` null check (database.ts line 371)

```typescript
stmt(jsonStrOrJsonObj: string | QueryJson): number {
    if (!this.db) {
        debugLog('stmt() called but database is not open');
        return -1;    // ← NEW: returns -1 if DB not open
    }
    // ... rest of method
```

**If `this.db` is null**, every INSERT/UPDATE returns `-1`. The IPC handler returns `-1` to the renderer. But the user still gets to the editor (because `gotoEditor` no longer blocks).

**Hypothesis: `this.db` is null when the renderer sends its first IPC message.**

Check: is the database opened by the time the lobby's first `database_stmt` runs?

### Change C: `save()` now has null check and backup logic (database.ts line 202)

```typescript
save(): void {
    if (!this.db) {
        debugLog('save() called but database is not open');
        return;        // ← NEW: silently returns, old code would crash
    }
    // ... backup + atomic write
```

**If `this.db` is null**, `save()` silently does nothing. Data stays in memory only. If the app crashes, everything is lost.

### Change D: `open()` now wraps `new SQL.Database()` in try-catch (database.ts line 90)

```typescript
try {
    this.db = new SQL.Database(filebuffer);
    this.db.handleError = this.handleError;
} catch (e) {
    debugLog('Failed to open database file — attempting auto-recovery:', e);
    this.db = null;    // ← DB stays null if open fails
}
```

**If the DB file is corrupted**, `this.db` stays null. Auto-recovery runs, but if the `.bak` file is also corrupted, `freshDatabase()` creates a new empty DB. But does `freshDatabase()` properly set `this.db`? Let me check:

```typescript
freshDatabase(SQL: SqlJsStatic): void {
    this.db = new SQL.Database();    // ← Creates empty in-memory DB
    this.db.handleError = this.handleError;
    this.initTables(SQL);
    this.runMigrations();
    this.save();                     // ← Saves to disk
}
```

This should work — `this.db` is set to a new empty DB. The old corrupted file is overwritten.

### Change E: `gotoEditor` no longer blocks (Home.ts line 181)

```typescript
// OLD:
if (!md5 || md5 === -1 || md5 === 0 || md5 === '0') {
    return;    // ← blocked navigation
}

// NEW:
if (!md5 || md5 === -1 || md5 === 0 || md5 === '0') {
    console.warn('gotoEditor: md5 looks invalid:', md5, '— navigating anyway');
    // ← navigates anyway
}
```

**This means:** If the INSERT failed (returns -1 or 0), the user is taken to `editor.html?pmd5=-1` or `editor.html?pmd5=0`. The editor loads, queries for project ID -1 or 0, gets nothing, and `metadata = {}`.

Then when the user saves, `metadata.id = "-1"` or `"0"`. The UPDATE runs `WHERE id = '-1'` — which matches no rows. **Silent failure.** No error shown, but data is lost.

**This is the most likely root cause of the "save doesn't work" issue.**

---

## 4. Root cause theories (ranked by likelihood)

### Theory 1: INSERT is failing, but `gotoEditor` navigates anyway (MOST LIKELY)

**Evidence:**
- Project name shows "undefined" in editor → `metadata.name` is undefined → `metadata = {}` → project not found in DB
- After saving, project doesn't appear in lobby → UPDATE matched no rows → data never persisted

**Why INSERT fails:**
- `this.db` might be null (database not opened yet, or corrupted)
- `getDataStore().databaseManager` might be null (data store not initialized)
- The `normalizeAndValidateSqlPayload` validator might reject the INSERT for an unknown reason

**How to verify:**
1. Enable `DEBUG_DATABASE = true` in `logging.ts`
2. Check the console for `database_stmt blocked:` messages
3. Check for `stmt() called but database is not open` messages
4. Check for `WARNING: INSERT returned rowid 0` messages

### Theory 2: `metadata` is null when `Project.save()` runs

**Evidence:** `Project.save` has `if (!metadata) { resetSaving(); return; }`. If `metadata` was never set (because `dataRecieved` didn't fire, or the project query returned empty), the save silently returns.

**How to verify:** Add a `console.log` in `Project.save` to check `metadata` state.

### Theory 3: `IO.saveProject` UPDATE doesn't match any rows

**Evidence:** `IO.saveProject` uses `WHERE id = ?` with `obj.id`. If `obj.id` is undefined, null, or wrong, the UPDATE affects 0 rows. No error is thrown — sql.js treats it as a successful UPDATE.

**How to verify:** After `IO.saveProject`, query the database to check if the row was actually updated.

### Theory 4: Database auto-recovery creates empty DB, destroying existing data

**Evidence:** If the DB file is corrupted on startup, `open()` sets `this.db = null`, then `autoRecover()` tries the `.bak` file. If both fail, `freshDatabase()` creates a new empty DB. All existing projects are gone.

**How to verify:** Check if `scratchjr.sqllite.bak` exists and is valid. Check the console for `Auto-recovery` messages.

---

## 5. What to check (debugging steps)

### Step 1: Enable full database logging

In `src/main/logging.ts`, change:
```typescript
const DEBUG_DATABASE = DEBUG && false;
```
to:
```typescript
const DEBUG_DATABASE = true;
```

Then rebuild (`npm run build:main`) and test. Check the DevTools console (Ctrl+Shift+I) for:

- `database_stmt` — the full SQL being executed
- `database_stmt result:` — the return value from `db.stmt()`
- `database_stmt blocked:` — if the validator rejected the SQL
- `stmt() called but database is not open` — if DB is null
- `stmt failed:` — if sql.js threw an error
- `WARNING: INSERT returned rowid 0` — if INSERT didn't create a row

### Step 2: Check if DB is initialized before first IPC

In `src/main/ipc-handlers.ts`, add at the top of the `database_stmt` handler:
```typescript
ipcMain.handle('database_stmt', (_event: any, json: string) => {
    const db = getDataStore().databaseManager;
    if (!db || !db.isOpen()) {
        console.error('[CRITICAL] database_stmt called but DB is not open!',
            'databaseManager:', !!db, 'isOpen:', db?.isOpen());
        return -1;
    }
    // ... rest of handler
```

### Step 3: Check if INSERT actually creates a row

In `src/main/database.ts`, after the INSERT in `stmt()`, add:
```typescript
if (stmtStr.trim().toLowerCase().startsWith('insert')) {
    const checkResult = this.db.exec('SELECT changes()');
    const changes = checkResult[0]?.values[0][0];
    if (changes === 0) {
        debugLog('CRITICAL: INSERT affected 0 rows:', stmtStr, values);
    }
}
```

### Step 4: Check if UPDATE matches any rows

In `src/app/src/iPad/IO.ts`, in `saveProject`, after the `iOS.stmt` call, add a verification query:
```typescript
iOS.stmt(json, function(result) {
    if (result <= 0) {
        console.error('[SAVE] UPDATE returned bad result:', result, 'for id:', obj.id);
    }
    if (fcn) fcn(result);
});
```

### Step 5: Check `gotoEditor` md5 value

In `src/app/src/lobby/Home.ts`, add logging:
```typescript
static gotoEditor (md5: unknown) {
    console.log('[GOTO] gotoEditor called with md5:', md5, typeof md5);
    // ...
```

---

## 6. The fix (not yet implemented)

The core problem is that `gotoEditor` navigates even when the INSERT fails. The fix should:

1. **Make `gotoEditor` actually block on failure**, but with a user-visible error (not silent)
2. **Ensure the INSERT succeeds** before navigating
3. **Report errors** from `database_stmt` back to the renderer

### Recommended approach

**Option A: Restore blocking, but show alert**

```typescript
static gotoEditor (md5: unknown) {
    if (!md5 || md5 === -1 || md5 === 0 || md5 === '0') {
        Alert.open(frame, gn('flip')!, 'Error creating project', '#D62222');
        return;
    }
    // ... navigate
}
```

**Option B: Add error reporting from `database_stmt`**

Make `database_stmt` return `{ result: number, error?: string }` instead of just a number. Then check the error in `iOS.stmt` callback.

**Option C: Verify before navigating**

After the INSERT callback, query the database to confirm the row exists before navigating:
```typescript
static gotoEditor (md5: unknown) {
    iOS.query(
        { stmt: 'SELECT id FROM projects WHERE id = ?', values: [md5] },
        function(result) {
            var rows = JSON.parse(result);
            if (rows.length === 0) {
                console.error('[GOTO] Project not found after INSERT, md5:', md5);
                return;
            }
            // ... navigate
        }
    );
}
```

---

## 7. Files to modify

| File | What to change |
|------|---------------|
| `src/main/logging.ts` | Set `DEBUG_DATABASE = true` for debugging |
| `src/main/database.ts` | Add `changes()` check after INSERT in `stmt()` |
| `src/main/ipc-handlers.ts` | Add DB null check at top of `database_stmt` handler |
| `src/app/src/lobby/Home.ts` | Either restore blocking in `gotoEditor` with error alert, or add verification query |
| `src/app/src/iPad/IO.ts` | Add error logging in `saveProject` callback |

---

## 8. Quick commands

```bash
# Full rebuild (after edits)
npm run typecheck && npm test && npm run build:main && npm run build:renderer

# Package
export PATH="/c/wix/bin:$PATH" && npm run make

# Run tests only
npm test

# Check if DB file exists and is valid (run in Node/sqlite3)
sqlite3 ~/Documents/ScratchJR/scratchjr.sqllite "SELECT * FROM PROJECTS;"
```
