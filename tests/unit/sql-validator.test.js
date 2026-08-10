import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { normalizeAndValidateSqlPayload, SQL_ALLOWED_VERBS, SQL_FORBIDDEN_KEYWORDS } = require('../../src/lib/sql-validator.js');

describe('normalizeAndValidateSqlPayload', () => {
    // --- Valid inputs ---

    it('accepts a valid SELECT with parameters', () => {
        const result = normalizeAndValidateSqlPayload({
            stmt: 'SELECT name, thumbnail FROM projects WHERE deleted = ? AND version = ?',
            values: ['NO', 'iOSv01'],
        });
        expect(result.stmt).toContain('SELECT');
        expect(result.values).toEqual(['NO', 'iOSv01']);
    });

    it('accepts a valid INSERT', () => {
        const result = normalizeAndValidateSqlPayload({
            stmt: 'INSERT INTO projects (name, version) VALUES (?, ?)',
            values: ['test', 'v1'],
        });
        expect(result.values).toEqual(['test', 'v1']);
    });

    it('accepts a valid UPDATE', () => {
        const result = normalizeAndValidateSqlPayload({
            stmt: 'UPDATE projects SET name = ? WHERE id = ?',
            values: ['new name', '42'],
        });
        expect(result.stmt).toContain('UPDATE');
    });

    it('accepts a valid DELETE', () => {
        normalizeAndValidateSqlPayload({
            stmt: 'DELETE FROM projects WHERE id = ?',
            values: ['42'],
        });
    });

    it('parses JSON string input', () => {
        const result = normalizeAndValidateSqlPayload(
            JSON.stringify({ stmt: 'SELECT 1', values: [] })
        );
        expect(result.stmt).toBe('SELECT 1');
    });

    it('strips trailing semicolon', () => {
        const result = normalizeAndValidateSqlPayload({ stmt: 'SELECT 1;', values: [] });
        expect(result.stmt).toBe('SELECT 1');
    });

    it('defaults values to empty array when missing', () => {
        const result = normalizeAndValidateSqlPayload({ stmt: 'SELECT 1' });
        expect(result.values).toEqual([]);
    });

    it('defaults values to empty array when not an array', () => {
        const result = normalizeAndValidateSqlPayload({ stmt: 'SELECT 1', values: 'not-array' });
        expect(result.values).toEqual([]);
    });

    // --- Invalid inputs: payload shape ---

    it('rejects null payload', () => {
        expect(() => normalizeAndValidateSqlPayload(null)).toThrow('invalid sql payload');
    });

    it('rejects undefined payload', () => {
        expect(() => normalizeAndValidateSqlPayload(undefined)).toThrow('invalid sql payload');
    });

    it('rejects string "hello" (not JSON)', () => {
        expect(() => normalizeAndValidateSqlPayload('hello')).toThrow();
    });

    it('rejects empty string (JSON parse fails)', () => {
        expect(() => normalizeAndValidateSqlPayload('')).toThrow();
    });

    it('rejects numeric payload', () => {
        expect(() => normalizeAndValidateSqlPayload(42)).toThrow('invalid sql payload');
    });

    // --- Invalid inputs: stmt field ---

    it('rejects missing stmt', () => {
        expect(() => normalizeAndValidateSqlPayload({ values: [] })).toThrow('missing sql stmt');
    });

    it('rejects empty stmt', () => {
        expect(() => normalizeAndValidateSqlPayload({ stmt: '', values: [] })).toThrow('missing sql stmt');
    });

    it('rejects whitespace-only stmt', () => {
        expect(() => normalizeAndValidateSqlPayload({ stmt: '   ', values: [] })).toThrow('missing sql stmt');
    });

    it('rejects non-string stmt', () => {
        expect(() => normalizeAndValidateSqlPayload({ stmt: 123, values: [] })).toThrow('missing sql stmt');
    });

    // --- Injection: multiple statements ---

    it('rejects multiple statements', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT 1; DROP TABLE projects',
            values: [],
        })).toThrow('multiple sql statements are not allowed');
    });

    it('rejects multiple statements with trailing semicolon', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT 1; DELETE FROM projects;',
            values: [],
        })).toThrow('multiple sql statements are not allowed');
    });

    // --- Injection: forbidden verbs ---

    it('rejects DROP', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'DROP TABLE projects',
            values: [],
        })).toThrow('sql verb not allowed: drop');
    });

    it('rejects ALTER', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'ALTER TABLE projects ADD COLUMN foo TEXT',
            values: [],
        })).toThrow('sql verb not allowed: alter');
    });

    it('rejects CREATE', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'CREATE TABLE evil (id INT)',
            values: [],
        })).toThrow('sql verb not allowed: create');
    });

    // --- Injection: forbidden keywords ---

    it('blocks UNION injection', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT name FROM projects WHERE id = 1 UNION SELECT password FROM users',
            values: [],
        })).toThrow('sql keyword not allowed: union');
    });

    it('blocks PRAGMA', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT * FROM projects WHERE name = PRAGMA table_info(projects)',
            values: [],
        })).toThrow('sql keyword not allowed: pragma');
    });

    it('blocks ATTACH', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT * FROM projects WHERE name = ATTACH DATABASE',
            values: [],
        })).toThrow('sql keyword not allowed: attach');
    });

    it('blocks BEGIN (transaction)', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT * FROM projects WHERE name = BEGIN',
            values: [],
        })).toThrow('sql keyword not allowed: begin');
    });

    it('blocks VACUUM', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'SELECT * FROM projects WHERE name = VACUUM',
            values: [],
        })).toThrow('sql keyword not allowed: vacuum');
    });

    // --- Case insensitivity ---

    it('rejects lowercase union injection', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'select name from projects union select password from users',
            values: [],
        })).toThrow('sql keyword not allowed: union');
    });

    it('rejects mixed-case DROP TABLE', () => {
        expect(() => normalizeAndValidateSqlPayload({
            stmt: 'dRoP tAbLe projects',
            values: [],
        })).toThrow('sql verb not allowed: drop');
    });

    // --- Allowed verbs constant ---

    it('defines the correct allowed verbs', () => {
        expect(SQL_ALLOWED_VERBS).toEqual(new Set(['select', 'insert', 'update', 'delete']));
    });

    it('includes union in forbidden keywords', () => {
        expect(SQL_FORBIDDEN_KEYWORDS).toContain('union');
    });
});
