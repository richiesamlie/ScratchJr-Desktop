import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib.ts evaluates `typeof window.orientation` / `'ontouchstart' in window` at
// module scope, so stub the browser globals before the IO module graph loads.
vi.hoisted(() => {
    globalThis.window = {
        orientation: undefined,
        location: { href: 'test.html' },
        innerHeight: 768,
        innerWidth: 1024,
        devicePixelRatio: 1,
        CSSRule: {},
    };
});

// IO's import graph touches DOM-only modules (iOS bridge, Lobby/appEntry,
// SVG rendering). Stub them; the persistence logic under test only needs
// iOS.query + the MediaLib shape.
vi.mock('../../src/app/src/iPad/iOS.ts', () => ({
    default: {
        query: vi.fn(),
        stmt: vi.fn(),
        database: 'projects',
        path: undefined,
    },
}));

vi.mock('../../src/app/src/lobby/Lobby.js', () => ({ default: {} }));
vi.mock('../../src/app/src/utils/SVG2Canvas.js', () => ({ default: {} }));
vi.mock('../../src/app/src/iPad/MediaLib.ts', () => ({
    default: { path: 'media/', keys: {}, sounds: [], sprites: [], backgrounds: [] },
}));

import IO from '../../src/app/src/iPad/IO.ts';
import iOS from '../../src/app/src/iPad/iOS.ts';

describe('IO persistence helpers', () => {
    it('parseProjectData lowercases keys', () => {
        expect(IO.parseProjectData({ Name: 'Alpha', Mtime: '1' })).toEqual({ name: 'Alpha', mtime: '1' });
    });

    it('getExtension splits at the first dot', () => {
        expect(IO.getExtension('Cat.svg')).toBe('svg');
        expect(IO.getExtension('a.b.Cat.png')).toBe('b.Cat.png');
    });

    it('getFilename returns the stem before the first dot', () => {
        expect(IO.getFilename('Cat.svg')).toBe('Cat');
        expect(IO.getFilename('My.Page.svg')).toBe('My');
    });
});

describe('IO.uniqueProjectName (save round-trip naming)', () => {
    let project;

    beforeEach(() => {
        iOS.query.mockReset();
        project = { name: 'My project', version: 'v1' };
    });

    it('keeps a unique project name unchanged', async () => {
        iOS.query.mockImplementation((json, fcn) => fcn(JSON.stringify([])));
        await new Promise((resolve) => IO.uniqueProjectName(project, resolve));
        expect(project.name).toBe('My project');
    });

    it('renames an unnumbered duplicate to "name 2"', async () => {
        iOS.query.mockImplementation((json, fcn) => fcn(JSON.stringify([{ name: 'My project' }])));
        await new Promise((resolve) => IO.uniqueProjectName(project, resolve));
        expect(project.name).toBe('My project 2');
    });

    it('bumps a numbered duplicate above the highest existing number', async () => {
        iOS.query.mockImplementation((json, fcn) => fcn(JSON.stringify([{ name: 'My project 5' }])));
        await new Promise((resolve) => IO.uniqueProjectName(project, resolve));
        expect(project.name).toBe('My project 6');
    });

    it('appends " 1" when useOne is set and the name is unique', async () => {
        iOS.query.mockImplementation((json, fcn) => fcn(JSON.stringify([])));
        await new Promise((resolve) => IO.uniqueProjectName(project, resolve, true));
        expect(project.name).toBe('My project 1');
    });

    it('does not lower an existing numbered name (keeps gift numbering)', async () => {
        iOS.query.mockImplementation((json, fcn) => fcn(JSON.stringify([{ name: 'My project 2' }])));
        project.name = 'My project 3';
        await new Promise((resolve) => IO.uniqueProjectName(project, resolve));
        expect(project.name).toBe('My project 3');
    });
});
