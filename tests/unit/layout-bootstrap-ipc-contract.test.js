import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(relPath) {
    return fs.readFileSync(path.resolve(__dirname, '../../', relPath), 'utf8');
}

describe('startup layout bootstrap IPC contract', () => {
    const preloadSource = readSource('src/preload.js');
    const mainSource = readSource('src/main/ipc-handlers.js');
    const electronClientSource = readSource('src/electronClient.js');
    const libSource = readSource('src/app/src/utils/lib.ts');
    const appEntrySource = readSource('src/app/appEntry.js');

    it('uses invoke for io_gettextresource in preload', () => {
        expect(preloadSource).toContain('ipcRenderer.invoke(\'io_gettextresource\'');
        expect(preloadSource).not.toContain('ipcRenderer.sendSync(\'io_gettextresource\'');
    });

    it('uses ipcMain.handle for io_gettextresource in main', () => {
        expect(mainSource).toContain('ipcMain.handle(\'io_gettextresource\'');
        expect(mainSource).not.toContain('ipcMain.on(\'io_gettextresource\'');
    });

    it('makes electronClient io_gettextresource async', () => {
        expect(electronClientSource).toMatch(/\n\s*async\s+io_gettextresource\(filename\)\s*\{/);
        expect(electronClientSource).toContain('return await bridge.io_gettextresource(filename);');
    });

    it('makes preprocessAndLoad async and awaits IPC', () => {
        expect(libSource).toContain('export async function preprocessAndLoad');
        expect(libSource).toContain('responseText = await window.tablet.io_gettextresource(url);');
    });

    it('makes preprocessAndLoadCss async and awaits preprocessAndLoad', () => {
        expect(libSource).toContain('export async function preprocessAndLoadCss');
        expect(libSource).toContain('var cssData = await preprocessAndLoad(url);');
    });

    it('makes loadPage async and awaits all CSS loads', () => {
        expect(appEntrySource).toContain('export async function loadPage');
        expect(appEntrySource).toContain('await preprocessAndLoadCss(');
        // Every preprocessAndLoadCss call must be awaited
        const lines = appEntrySource.split('\n');
        const cssLines = lines.filter((l) => l.includes('preprocessAndLoadCss(') && !l.trim().startsWith('//'));
        for (const line of cssLines) {
            expect(line).toContain('await preprocessAndLoadCss(');
        }
    });
});
