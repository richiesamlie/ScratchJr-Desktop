import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('preload bridge contract', () => {
    const preloadSource = fs.readFileSync(
        path.resolve(__dirname, '../../src/preload.js'), 'utf8'
    );

    // Every IPC channel the renderer uses must be exposed by the preload.
    const requiredChannels = [
        // Database
        'database_stmt',
        'database_query',
        // Settings & Resources
        'io_getsettings',
        'io_gettextresource',
        'io_getIsDebug',
        // File I/O
        'io_setfile',
        'io_getfile',
        'io_remove',
        'io_cleanassets',
        'io_getmd5',
        // Media I/O
        'io_getmedia',
        'io_getmediadata',
        'io_getmediadone',
        'io_getmedialen',
        'io_setmedia',
        'io_setmedianame',
        'io_getAudioData',
        // Debug
        'debugWriteLog',
        // Lifecycle
        'sendAppClosedAcked',
    ];

    const requiredEventListeners = [
        'onDatabaseRestored',
        'onKeyboardShortcut',
        'onAppClose',
    ];

    for (const channel of requiredChannels) {
        it(`exposes ${channel} in bridge`, () => {
            expect(preloadSource).toContain(`${channel}:`);
        });
    }

    for (const listener of requiredEventListeners) {
        it(`exposes ${listener} in bridge`, () => {
            expect(preloadSource).toContain(`${listener}:`);
        });
    }

    it('uses contextBridge.exposeInMainWorld', () => {
        expect(preloadSource).toContain('contextBridge.exposeInMainWorld');
    });

    it('exposes as window.scratchjr', () => {
        expect(preloadSource).toContain("'scratchjr'");
    });

    it('does not expose nodeIntegration or require', () => {
        expect(preloadSource).not.toContain('nodeIntegration');
        expect(preloadSource).not.toMatch(/require\(['"]\.\//);  // no local requires besides electron
    });

    it('uses invoke for all request/response channels', () => {
        for (const channel of requiredChannels) {
            if (channel === 'debugWriteLog' || channel === 'sendAppClosedAcked') {
                // These use async send(), not invoke
                continue;
            }
            expect(preloadSource).toContain(`ipcRenderer.invoke('${channel}'`);
        }
    });
});
