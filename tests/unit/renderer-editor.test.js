// @vitest-environment jsdom
// Editor engine contracts under jsdom: script-strip encode/decode round-trip
// (the project file format), the scroll-aware page-strip caret math, and a
// runtime primitive execution.
import './renderer-harness.js';
import { describe, it, expect, beforeEach } from 'vitest';
import Project from '../../src/app/src/editor/ui/Project.js';
import Scripts from '../../src/app/src/editor/ui/Scripts.js';
import Sprite from '../../src/app/src/editor/engine/Sprite.js';
import Page from '../../src/app/src/editor/engine/Page.js';
import ScratchJr from '../../src/app/src/editor/ScratchJr.js';
import Thumbs from '../../src/app/src/editor/ui/Thumbs.js';
import iOS from '../../src/app/src/iPad/iOS.js';
import BlockSpecs from '../../src/app/src/editor/blocks/BlockSpecs.js';
import Thread from '../../src/app/src/editor/engine/Thread.js';
import Prims from '../../src/app/src/editor/engine/Prims.js';
import { gn } from '../../src/app/src/utils/lib.js';

function resetDom () {
    document.body.innerHTML = '';
    const scriptscontainer = document.createElement('div');
    scriptscontainer.id = 'scriptscontainer';
    document.body.appendChild(scriptscontainer);
    const pagesdiv = document.createElement('div');
    pagesdiv.id = 'pagesdiv';
    document.body.appendChild(pagesdiv);
    ScratchJr.stage = {
        pagesdiv,
        pages: [],
        currentPage: null,
    };
}

// Sprite construction kicks off async media loading through the native
// bridge; the format tests don't need images.
function stubMedia () {
    iOS.getmedia = async () => {};
    iOS.path = '';
}

describe('script strip round-trip (project file format)', () => {
    beforeEach(() => {
        resetDom();
        stubMedia();
        BlockSpecs.initBlocks();
    });

    it('recreates blocks and re-encodes the same blocktype/arg/nesting', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        const sc = new Scripts(spr);

        const strip = [
            ['hop', 2, 0, 0],
            ['repeat', 3, 0, 10, [
                ['hop', 2, 0, 0],
                ['say', 'Hello', 0, 0],
            ]],
            ['hide', 'null', 0, 0],
        ];

        const blocks = sc.recreateStrip(strip);

        // Decode built the expected block graph.
        expect(blocks.map(b => b.blocktype)).toEqual(['hop', 'repeat', 'hide']);
        expect(blocks[1].inside.blocktype).toBe('hop');
        expect(blocks[1].inside.next.blocktype).toBe('say');

        // Re-encoding yields the same structure (positions are relaid out, so
        // only blocktype/arg/nesting are compared).
        function stripShape (s) {
            return s.map(t => [t[0], t[1], Array.isArray(t[4]) ? stripShape(t[4]) : null]);
        }
        // encodeStrip walks the .next chain, so the first block encodes the
        // whole strip.
        const reencoded = Project.encodeStrip(blocks[0]);
        expect(stripShape(reencoded)).toEqual(stripShape(strip));
    });

    it('round-trips a strip with an arg block and page navigation target', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        const sc = new Scripts(spr);

        // gotopage is arg-encoded via hasargs even though its arg is a number.
        const strip = [
            ['wait', 1, 0, 0],
            ['gotopage', 2, 0, 10],
        ];

        const blocks = sc.recreateStrip(strip);
        expect(blocks.map(b => b.blocktype)).toEqual(['wait', 'gotopage']);

        const reencoded = Project.encodeStrip(blocks[0]);
        expect(reencoded[0][0]).toBe('wait');
        expect(reencoded[0][1]).toBe(1);
        expect(reencoded[1][0]).toBe('gotopage');
    });
});

describe('Thumbs.getPagePos (scroll-aware page strip caret math)', () => {
    beforeEach(() => {
        resetDom();
        const pagecc = document.createElement('div');
        pagecc.id = 'pagecc';
        document.body.appendChild(pagecc);

        // Three page thumbs chained via the next/prev expandos, plus their
        // page divs carrying the Page-object owner.
        let prevThumb = null;
        for (let i = 0; i < 3; i++) {
            const thumb = document.createElement('div');
            thumb.id = 'pt' + i;
            Object.defineProperty(thumb, 'offsetTop', { value: i * 50, configurable: true });
            thumb.owner = 'page' + i;
            thumb.prev = prevThumb;
            if (prevThumb) {
                prevThumb.next = thumb;
            }
            pagecc.appendChild(thumb);
            prevThumb = thumb;

            const pageDiv = document.createElement('div');
            pageDiv.id = 'page' + i;
            document.body.appendChild(pageDiv);
            pageDiv.owner = { id: 'page' + i };
        }
    });

    it('maps a y-coordinate to the correct page slot at scrollTop 0', () => {
        expect(Thumbs.getPagePos(0)).toBe(0);
        expect(Thumbs.getPagePos(50)).toBe(1);
        expect(Thumbs.getPagePos(100)).toBe(2);
    });

    it('shifts the caret slot down when the strip is scrolled', () => {
        const pagecc = gn('pagecc');
        pagecc.scrollTop = 25;
        // Same cursor y as the first test, but the strip scrolled 25px:
        // the caret now lands on the next page.
        expect(Thumbs.getPagePos(0)).toBe(1);
        expect(Thumbs.getPagePos(50)).toBe(2);
    });

    it('clamps the position to the page count', () => {
        expect(Thumbs.getPagePos(1000)).toBe(3);
        expect(Thumbs.getPagePos(-100)).toBe(0);
    });
});

describe('page encode/decode round-trip (page bag format)', () => {
    beforeEach(() => {
        resetDom();
        stubMedia();
        BlockSpecs.initBlocks();
    });

    it('encodePage produces the page bag and recreatePage decodes it', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        spr.code.recreateStrip([
            ['hop', 2, 0, 0],
            ['repeat', 3, 0, 10, [['say', 'Hi', 0, 0]]],
        ]);
        page.sprites = JSON.stringify(['cat']);

        const encoded = page.encodePage();

        // Page bag shape: sprite list, last sprite, num, layers, sprite bags.
        expect(encoded.sprites).toEqual(['cat']);
        expect(encoded.lastSprite).toBeUndefined();
        expect(encoded.num).toBe(1);
        expect(encoded.layers).toContain('cat');
        const spriteBag = encoded.cat;
        expect(spriteBag.id).toBe('cat');
        expect(spriteBag.type).toBe('sprite');
        expect(spriteBag.scripts[0][0][0]).toBe('hop');
        expect(spriteBag.scripts[0][1][0]).toBe('repeat');
        expect(spriteBag.scripts[0][1][4][0][0]).toBe('say');

        // Decode: recreatePage builds a new page and re-creates the sprite.
        Project.recreatePage('page2', encoded);
        const page2 = ScratchJr.stage.pages[1];
        expect(page2.id).toBe('page2');
        expect(JSON.parse(page2.sprites)).toEqual(['cat']);
        const catDiv = Array.from(page2.div.children).find(c => c.id === 'cat');
        expect(catDiv).toBeTruthy();
        expect(catDiv.owner.type).toBe('sprite');
    });
});

describe('runtime primitive execution', () => {
    beforeEach(() => {
        resetDom();
        stubMedia();
        BlockSpecs.initBlocks();
    });

    function makeThread (strip, spr) {
        const sc = new Scripts(spr);
        const [block] = sc.recreateStrip(strip);
        return new Thread(spr, block);
    }

    it('Home moves the sprite back to its home position', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        const thread = makeThread([['home', 'null', 0, 0]], spr);

        spr.homex = 0;
        spr.homey = 0;
        spr.xcoor = 120;
        spr.ycoor = 80;
        Prims.Home(thread);

        expect(spr.xcoor).toBe(0);
        expect(spr.ycoor).toBe(0);
        // The primitive advanced the thread to the next block (end of strip).
        expect(thread.thisblock).toBeNull();
    });

    it('SetSpeed applies 2^arg to the sprite speed', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        const thread = makeThread([['setspeed', 2, 0, 0]], spr);

        Prims.SetSpeed(thread);

        expect(spr.speed).toBe(4);
        expect(thread.thisblock).toBeNull();
    });

    it('Show and Hide flip visibility synchronously at full speed', () => {
        const page = new Page('page1', { lastSprite: '', sprites: [], layers: [], num: 1 });
        const spr = new Sprite({ type: 'sprite', page, md5: 'm1', id: 'cat', name: 'Cat', sounds: [] });
        spr.speed = 4;
        const showThread = makeThread([['show', 'null', 0, 0]], spr);
        const hideThread = makeThread([['hide', 'null', 0, 0]], spr);

        Prims.Show(showThread);
        expect(spr.shown).toBe(true);
        expect(spr.div.style.opacity).toBe('1');
        expect(showThread.thisblock).toBeNull();

        Prims.Hide(hideThread);
        expect(spr.shown).toBe(false);
        expect(spr.div.style.opacity).toBe('0');
        expect(hideThread.thisblock).toBeNull();
    });
});
