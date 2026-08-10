import { describe, it, expect } from 'vitest';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { isParentFolder, validateFilePath } = require('../../src/lib/path-utils.js');

const isWindows = process.platform === 'win32';

describe('isParentFolder', () => {
    it('returns true for a child path', () => {
        expect(isParentFolder('/app', '/app/css/style.css')).toBe(true);
    });

    it('returns true for a nested child path', () => {
        expect(isParentFolder('/app', '/app/src/utils/lib.js')).toBe(true);
    });

    it('returns false for path traversal with ..', () => {
        expect(isParentFolder('/app', '/app/../etc/passwd')).toBe(false);
    });

    it('returns false for absolute path outside parent', () => {
        expect(isParentFolder('/app', '/etc/passwd')).toBe(false);
    });

    it('returns false for parent itself (empty relative)', () => {
        expect(isParentFolder('/app', '/app')).toBe(false);
    });

    it('returns false for sibling directory', () => {
        expect(isParentFolder('/app', '/other/file.txt')).toBe(false);
    });

    it('returns true for deep nested path', () => {
        expect(isParentFolder('/app', '/app/a/b/c/d/e/f.txt')).toBe(true);
    });

    it('handles platform-native absolute paths', () => {
        const parent = isWindows ? 'C:\\Users\\app' : '/home/user/app';
        const child = isWindows ? 'C:\\Users\\app\\file.txt' : '/home/user/app/file.txt';
        expect(isParentFolder(parent, child)).toBe(true);
    });

    it('blocks platform-native path traversal', () => {
        const parent = isWindows ? 'C:\\Users\\app' : '/home/user/app';
        const escape = isWindows ? 'C:\\Users\\other\\file.txt' : '/home/user/other/file.txt';
        expect(isParentFolder(parent, escape)).toBe(false);
    });
});

describe('validateFilePath', () => {
    const appRoot = '/test/app';

    it('returns resolved path for valid file', () => {
        const result = validateFilePath(appRoot, 'css/style.css');
        expect(result).toBe(path.resolve(appRoot, 'css/style.css'));
    });

    it('throws for null file', () => {
        expect(() => validateFilePath(appRoot, null)).toThrow('File cannot be null or empty');
    });

    it('throws for empty string', () => {
        expect(() => validateFilePath(appRoot, '')).toThrow('File cannot be null or empty');
    });

    it('throws for undefined file', () => {
        expect(() => validateFilePath(appRoot, undefined)).toThrow('File cannot be null or empty');
    });

    it('throws for path traversal', () => {
        expect(() => validateFilePath(appRoot, '../../../etc/passwd')).toThrow('file outside app folder');
    });

    it('throws for root-relative escape', () => {
        // On Windows, \etc\passwd is root-relative; on Unix, /etc/passwd is the equivalent
        const escape = isWindows ? '\\etc\\passwd' : '/etc/passwd';
        expect(() => validateFilePath(appRoot, escape)).toThrow();
    });

    it('throws for absolute path outside parent', () => {
        const escape = isWindows ? 'C:\\Windows\\System32\\config\\SAM' : '/etc/shadow';
        expect(() => validateFilePath(appRoot, escape)).toThrow();
    });

    it('accepts nested valid path', () => {
        const result = validateFilePath(appRoot, 'src/utils/lib.js');
        expect(result).toContain('lib.js');
    });
});
