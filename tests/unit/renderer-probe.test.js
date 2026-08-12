// @vitest-environment jsdom
// Probe: what does the editor module graph need at import time under jsdom?
import './renderer-harness.js';
import { describe, it, expect } from 'vitest';

describe('import probe', () => {
    it('imports core editor modules without crashing', async () => {
        const lib = await import('../../src/app/src/utils/lib.js');
        expect(typeof lib.gn).toBe('function');
        const Project = (await import('../../src/app/src/editor/ui/Project.js')).default;
        const Scripts = (await import('../../src/app/src/editor/ui/Scripts.js')).default;
        const Block = (await import('../../src/app/src/editor/blocks/Block.js')).default;
        const Page = (await import('../../src/app/src/editor/engine/Page.js')).default;
        const Sprite = (await import('../../src/app/src/editor/engine/Sprite.js')).default;
        expect(typeof Project.getProject).toBe('function');
        expect(typeof Scripts).toBe('function');
        expect(typeof Block).toBe('function');
        expect(typeof Page).toBe('function');
        expect(typeof Sprite).toBe('function');
    });
});
