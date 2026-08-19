//////////////////////////////////////
//   Pages
/////////////////////////////////////

import ScratchJr from '../ScratchJr';
import Palette from './Palette';
import Page from '../engine/Page';
import ScriptsPane from './ScriptsPane';
import Undo from './Undo';
import UI from './UI';
import type Sprite from '../engine/Sprite';
import type Scripts from './Scripts';
import type Block from '../blocks/Block';
import Events from '../../utils/Events';
import ScratchAudio from '../../utils/ScratchAudio';
import {frame, gn, localx, newHTML, scaleMultiplier, getIdFor,
    isTouch, newImage, localy, setProps} from '../../utils/lib';

let caret: HTMLElement | null = null;

export default class Thumbs {
    static t: unknown;

    static updatePages () {
        var pthumbs = gn('pagecc')!;
        while (pthumbs.childElementCount > 0) {
            pthumbs.removeChild(pthumbs.childNodes[0]);
        }
        var prev: HTMLElement | null = null;
        
        let th;
        for (var i = 0; i < ScratchJr.stage.pages.length; i++) {
            var page = ScratchJr.stage.pages[i];
            page.num = i + 1;
            th = page.pageThumbnail(pthumbs);
            th.prev = prev!;
            if (prev) {
                prev.next = th;
            }
            if (page.id == ScratchJr.stage.currentPage.id) {
                Thumbs.highlighPage(th);
            } else {
                Thumbs.unhighlighPage(th);
            }
            ScriptsPane.updateScriptsPageBlocks(JSON.parse(page.sprites));
            prev = th;
        }
        // Keep the current page visible when the strip is scrolled
        const currentThumb = pthumbs.querySelector('.pagethumb.on');
        if (currentThumb) {
            currentThumb.scrollIntoView({ block: 'nearest' });
        }
        // Cap on pages per project — configurable via settings.json maxPages (default 4)
        if ((ScratchJr.stage.pages.length >= (window.Settings!.maxPages ?? 4)) || !ScratchJr.isEditable()) {
            return;
        }
        var ep = Thumbs.emptyPage(pthumbs);
        ep.prev = prev!;
        th!.next = ep;
    }

    static getObjectFor (div: HTMLElement, id: unknown) {
        for (var i = 0; i < div.childElementCount; i++) {
            if (div.childNodes[i].owner == id) {
                return div.childNodes[i];
            }
        }
        return div.childNodes[0];
    }

    static getType (div: HTMLElement, str: string) {
        while (div != null) {
            if (div.type == str) {
                return div;
            }
            div = div.parentNode as HTMLElement;
        }
        return null;
    }

    static pageMouseDown (e: MouseEvent & { touches?: TouchList }) {
        if (isTouch && e.touches && (e.touches.length > 1)) {
            return;
        }
        if (ScratchJr.onHold) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        Thumbs.t = e.target;
        var tb = Thumbs.getType(Thumbs.t as HTMLElement, 'pagethumb');
        if (ScratchJr.shaking && ((e.target as HTMLElement).className == 'deletethumb')) {
            ScratchJr.clearSelection();
            ScratchJr.stage.deletePage(tb!.owner as string);
            return;
        }
        if (ScratchJr.shaking) {
            ScratchJr.clearSelection();
            return;
        }
        if (!tb) {
            return;
        }
        if (!ScratchJr.isEditable() || (gn('pagecc')!.childElementCount < 3)) {
            Thumbs.clickOnPage(e, tb.owner as string);
        } else {
            Events.startDrag(e, tb, Thumbs.prepareToDragPage, Thumbs.dropPage, Thumbs.draggingPage, Thumbs.clickPage, Thumbs.startPageShaking);
        }
    }

    static prepareToDragPage (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        ScratchAudio.sndFX('grab.wav');
        var pt = Events.getTargetPoint(e);
        Events.dragmousex = pt.x;
        Events.dragmousey = pt.y;
        var mx = Events.dragmousex - frame.offsetLeft - localx(Events.dragthumbnail, Events.dragmousex);
        var my = Events.dragmousey - frame.offsetTop - localy(Events.dragthumbnail, Events.dragmousey);
        var mstyle = {
            position: 'absolute',
            left: '0px',
            top: '0px',
            zIndex: ScratchJr.dragginLayer
        };
        Events.dragcanvas = Events.dragthumbnail;
        setProps(Events.dragcanvas.style, mstyle);
        Events.move3D(Events.dragcanvas, mx, my);
        frame.appendChild(Events.dragcanvas);
        caret = newHTML('div', 'pagethumb caret', gn('pagecc')!);
        caret!.prev = Events.dragthumbnail.prev;
        caret!.next = Events.dragthumbnail.next;
        if (Events.dragthumbnail.prev) {
            (Events.dragthumbnail.prev).next = caret;
        }
        if (Events.dragthumbnail.next) {
            (Events.dragthumbnail.next).prev = caret;
        }
        Thumbs.layoutPages();
        Events.dragthumbnail.pos = Thumbs.getPagePos(Events.dragcanvas.top!);
    }

    static layoutPages () {
        var thispage = Thumbs.findFirst();
        var p = gn('pagecc')!;
        while (thispage) {
            p.appendChild(thispage);
            thispage = thispage.next!;
        }
    }

    static findFirst () {
        var kid = gn('pagecc')!.childNodes[0];
        while (kid.prev) {
            kid = kid.prev;
        }
        return kid;
    }

    static findLast () {
        var kid = gn('pagecc')!.childNodes[0];
        while (kid.next) {
            kid = kid.next;
        }
        return kid;
    }

    static getPageOrder () {
        var page = Thumbs.findFirst();
        var res: Page[] = [];
        while (page) {
            var pagename = page.owner as string;
            if (pagename) {
                res.push(gn(pagename)!.owner as Page);
            }
            page = page.next!;
        }
        return res;
    }

    static draggingPage (e: MouseEvent, el: HTMLElement) {
        e.preventDefault();
        var pt = Events.getTargetPoint(e);
        var dx = pt.x - Events.dragmousex;
        var dy = pt.y - Events.dragmousey;
        Events.move3D(el, dx, dy);
        if (!caret) {
            return;
        }
        Thumbs.removeCaret();
        Thumbs.insertCaret(el);
        Thumbs.layoutPages();
    }

    static removeCaret () {
        var myprev = caret!.prev as ChildNode;
        var mynext = caret!.next as ChildNode;
        if (myprev) {
            myprev.next = mynext;
        }
        if (mynext) {
            mynext.prev = myprev;
        }
        caret!.prev = undefined;
        caret!.next = undefined;
        var p = caret!.parentNode;
        if (p) {
            p.removeChild(caret!);
        }
    }

    static insertCaret (el: HTMLElement) {
        var pos = Thumbs.getPagePos(el.top!);
        Thumbs.positionMe(pos, caret!);
        gn('pagecc')!.appendChild(caret!);
    }

    static getPagePos (dy: number) {
        const pageSecond = gn('pagecc')!.childNodes[1] as HTMLElement;
        const pageFirst = gn('pagecc')!.childNodes[0] as HTMLElement;
        var delta = pageSecond.offsetTop - pageFirst.offsetTop;
        // localy() measures from the container's layout top; add the scroll
        // offset so the drop caret lands on the right page when the strip
        // is scrolled (no-op when scrollTop is 0)
        var pos = Math.floor((localy(gn('pagecc')!, dy + (delta / 2)) + gn('pagecc')!.scrollTop) / delta);
        pos = Math.max(0, pos);
        var max = Thumbs.getPageOrder().length;
        return Math.min(max, pos);
    }

    static positionMe (pos: number, elem: HTMLElement) {
        var beforewho = pos >= gn('pagecc')!.childElementCount ? undefined : gn('pagecc')!.childNodes[pos];
        if (!beforewho) {
            var last = Thumbs.findLast();
            last.next = elem as ChildNode;
            elem.prev = last;
            elem.next = undefined;
        } else {
            var prev = beforewho.prev;
            beforewho.prev = elem as ChildNode;
            elem.next = beforewho;
            if (prev) {
                prev.next = elem as ChildNode;
                elem.prev = prev;
            }
        }
    }

    static repositionThumb (thumb: HTMLElement, dy: number) {
        var pos = Thumbs.getPagePos(dy);
        if (pos != thumb.pos) {
            ScratchAudio.sndFX('snap.wav');
        }
        var myprev = thumb.prev as HTMLElement;
        var mynext = thumb.next as HTMLElement;
        if (myprev) {
            myprev.next = mynext;
        }
        if (mynext) {
            mynext.prev = myprev;
        }
        Thumbs.positionMe(pos, thumb);
    }

    static dropPage (e: MouseEvent | TouchEvent) {
        ScratchJr.storyStart('Thumbs.dropPage');
        e.preventDefault();
        if (!caret) {
            return;
        }
        Events.dragthumbnail.prev = caret.prev;
        Events.dragthumbnail.next = caret.next;
        if (Events.dragthumbnail.prev) {
            (Events.dragthumbnail.prev).next = Events.dragthumbnail;
        }
        if (Events.dragthumbnail.next) {
            (Events.dragthumbnail.next).prev = Events.dragthumbnail;
        }
        if (caret.parentNode) {
            caret.parentNode.removeChild(caret);
        }
        caret = null;
        Events.dragthumbnail.style.position = '';
        Events.dragthumbnail.style.left = '';
        Events.dragthumbnail.style.top = '';
        Events.dragthumbnail.style.webkitTransform = '';
        var oldpos = Number(Events.dragthumbnail.childNodes[1].childNodes[0].textContent) - 1;
        var oldpage = Events.dragthumbnail.owner;
        Thumbs.repositionThumb(Events.dragthumbnail, Events.dragthumbnail.top!);
        var oldlist = ScratchJr.stage.getPagesID();
        ScratchJr.stage.pages = Thumbs.getPageOrder();
        Thumbs.layoutPages();
        Thumbs.updatePages();
        ScratchJr.stage.renumberPageBlocks(oldlist);
        if (Palette.numcat == 5) {
            Palette.selectCategory(5);
        }
        if (Thumbs.getPageOrder()[oldpos].id != oldpage) {
            Undo.record({
                action: 'pageorder',
                who: oldpage,
                where: oldpage
            });
        }
    }

    static clickPage (e: MouseEvent | TouchEvent) {
        ScratchJr.clearSelection();
        Thumbs.clickOnPage(e, Events.dragthumbnail.owner as string);
        Events.clearEvents();
        Events.dragthumbnail = null;
    }

    static clickOnPage (e: MouseEvent | TouchEvent, pagename: string) {
        ScratchJr.unfocus(e);
        var pthumbs = gn('pagecc')!;
        for (var i = 0; i < pthumbs.childElementCount; i++) {
            var thumb = pthumbs.childNodes[i] as HTMLElement;
            if (thumb.id == 'emptypage') {
                continue;
            }
        }
        if (ScratchJr.stage.currentPage.id == pagename) {
            return;
        }
        var page = gn(pagename)!.owner as Page;
        ScratchJr.stage.setPage(page, false);
        Undo.record({
            action: 'changepage',
            who: pagename,
            where: pagename
        });
    }


    static startPageShaking (tb: HTMLElement) {
        ScratchJr.shaking = tb;
        ScratchJr.stopShaking = Thumbs.stopPageShaking;
        var cc = tb.getAttribute('class')!;
        tb.setAttribute('class', cc + ' shakeme');
        (tb.childNodes[tb.childElementCount - 1] as HTMLElement).style.visibility = 'visible';
    }


    static stopPageShaking (b: HTMLElement) {
        ScratchJr.shaking = undefined;
        ScratchJr.stopShaking = undefined;
        var cc = b.getAttribute('class')!;
        cc = cc.substr(0, cc.length - 8);
        b.setAttribute('class', cc);
        (b.childNodes[b.childElementCount - 1] as HTMLElement).style.visibility = 'hidden';
    }

    static emptyPage (p: HTMLElement) {
        var tb = newHTML('div', 'pagethumb', p);
        var c = newHTML('div', 'empty', tb);
        var img;
        if (window.Settings!.edition == 'PBS') {
            img = newImage(c, 'assets/ui/newpage.svg');
        } else {
            img = newImage(c, 'assets/ui/newpage.png', {
                position: 'absolute'
            });
        }
        img.setAttribute('class', 'unselectable');
        tb.setAttribute('id', 'emptypage');
        tb.onmousedown = function (evt: MouseEvent) {
                Thumbs.clickOnEmptyPage(evt);
            };
        return tb;
    }

    static clickOnEmptyPage (e: MouseEvent & { touches?: TouchList }) {
        if (isTouch && e.touches && (e.touches.length > 1)) {
            return;
        }
        ScratchAudio.sndFX('tap.wav');
        e.preventDefault();
        ScratchJr.stage.currentPage.div.style.visibility = 'hidden';
        ScratchJr.stage.currentPage.setPageSprites('hidden');
        var sc = gn(ScratchJr.stage.currentPage.currentSpriteName + '_scripts')!;
        if (sc) {
            (sc.owner as Scripts).deactivate();
        }
        ScratchJr.unfocus(e);
        let page =  new Page(getIdFor('page'));  // eslint-disable-line no-unused-vars
    }

    static highlighPage (page: HTMLElement) {
        page.setAttribute('class', 'pagethumb on');
    }

    static unhighlighPage (page: HTMLElement) {
        page.setAttribute('class', 'pagethumb off');
    }

    static overpage (page: HTMLElement) {
        page.setAttribute('class', 'pagethumb drop');
    }

    //////////////////////////////////////
    //   Library
    /////////////////////////////////////

    static updateSprites () {
        var costumes = gn('spritecc')!;
        costumes.parentElement!.scrollTop = 0;
        while (costumes.childElementCount > 0) {
            costumes.removeChild(costumes.childNodes[0]);
        }
        var sprites = JSON.parse(ScratchJr.stage.currentPage.sprites);
        for (var i = 0; i < sprites.length; i++) {
            var s = gn(sprites[i])!;
            if (!s) {
                continue;
            }
            var spr = s.owner as Sprite;
            if (spr.type != 'sprite') {
                continue;
            }
            var th = spr.spriteThumbnail(costumes);
            if (spr.id == ScratchJr.stage.currentPage.currentSpriteName) {
                Thumbs.highlighSprite(th);
            } else {
                Thumbs.unhighlighSprite(th);
            }
        }
        if (!ScratchJr.getSprite()) {
            ScratchJr.stage.currentPage.setCurrentSprite(undefined);
        }
        UI.resetSpriteLibrary();
    }

    static updateSprite (spr: Sprite) {
        if (!spr) {
            return;
        }
        if (spr.thumbnail) {
            spr.updateSpriteThumb();
        } else {
            var costumes = gn('spritecc')!;
            if (spr.type != 'sprite') {
                return;
            }
            spr.spriteThumbnail(costumes);
            Thumbs.selectThisSprite(spr);
            UI.resetSpriteLibrary();
        }
    }

    /////////////////////////////////////////////
    //  Sprite Thumbnails
    ////////////////////////////////////////////

    static startDragThumb (e: MouseEvent, tb: HTMLElement) {
        if (ScratchJr.shaking && ((e.target as HTMLElement).id == 'deletespritethumb')) {
            ScratchJr.clearSelection();
            ScratchJr.stage.removeSprite(gn(tb.owner as string)!.owner as Sprite);
        }
        if (ScratchJr.shaking) {
            ScratchJr.clearSelection();
        }
        if (!ScratchJr.isEditable()) {
            Thumbs.clickOnSprite(e, tb);
        } else {
            Events.startDrag(e, tb, Thumbs.prepareToDrag, Thumbs.drop, Thumbs.dragging, Thumbs.click, Thumbs.startCharShaking);
        }
    }

    static startCharShaking (tb: HTMLElement) {
        if (!tb) {
            return;
        }
        ScratchJr.shaking = tb;
        ScratchJr.stopShaking = Thumbs.stopCharShaking;
        var cc = tb.getAttribute('class')!;
        tb.setAttribute('class', cc + ' shakethumb');
        var close = newHTML('div', 'deletespritethumb', tb);
        close.id = 'deletespritethumb';
    }

    static stopCharShaking (b: HTMLElement) {
        ScratchJr.shaking = undefined;
        ScratchJr.stopShaking = undefined;
        var cc = b.getAttribute('class')!;
        cc = cc.substr(0, cc.length - 8);
        b.setAttribute('class', cc);
        var ic = b.childNodes[b.childElementCount - 1];
        if ((ic as HTMLElement).getAttribute('class') == 'deletespritethumb') {
            b.removeChild(ic);
        }
    }

    static selectThisSprite (spr: Sprite) {
        var costumes = gn('spritecc')!;
        var el = spr.thumbnail;
        for (var i = 0; i < costumes.childElementCount; i++) {
            var th = costumes.childNodes[i];
            if (th == el) {
                Thumbs.highlighSprite(el);
            } else {
                Thumbs.unhighlighSprite(th as HTMLElement);
            }
        }
    }

    static clickOnSprite (e: MouseEvent | TouchEvent, el: HTMLElement) {
        if (ScratchJr.shaking && (ScratchJr.shaking == el)) {
            ScratchJr.clearSelection();
            ScratchJr.stage.removeSprite(gn(el.owner as string)!.owner as Sprite);
            return;
        }
        var spritename = el.owner as string;
        if (!gn(spritename)!) {
            return;
        }
        ScratchJr.unfocus(e);
        var spr = gn(spritename)!.owner as Sprite;
        var page = spr.div.parentNode!.owner as Page;
        page.setCurrentSprite(spr);
        Thumbs.selectThisSprite(spr);
    }

    static prepareToDrag (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        ScratchAudio.sndFX('grab.wav');
        var pt = Events.getTargetPoint(e);
        Events.dragmousex = pt.x;
        Events.dragmousey = pt.y;
        Events.dragthumbnail = Thumbs.getObjectFor(gn('spritecc')!, Events.dragthumbnail.owner) as HTMLElement;
        var mx = Events.dragmousex - frame.offsetLeft
            - localx(Events.dragthumbnail, Events.dragmousex) - gn('topsection')!.offsetLeft;
        var my = Events.dragmousey - frame.offsetTop
            - localy(Events.dragthumbnail, Events.dragmousey) - gn('topsection')!.offsetTop;
        var sy = (Events.dragthumbnail.parentNode!.parentNode as HTMLElement).scrollTop;
        var sx = (Events.dragthumbnail.parentNode!.parentNode as HTMLElement).scrollLeft;
        my -= sy;
        mx -= sx;
        var mstyle = {
            position: 'absolute',
            left: '0px',
            top: '0px',
            zIndex: ScratchJr.dragginLayer,
            zoom: (100 / window.devicePixelRatio) + '%'
        };
        var spr = gn(Events.dragthumbnail.owner as string)!.owner as Sprite;
        Events.dragcanvas = document.createElement('canvas');
        spr.drawMyImage(Events.dragcanvas as HTMLCanvasElement,
            76 * scaleMultiplier * window.devicePixelRatio,
            (76 - 12) * scaleMultiplier * window.devicePixelRatio
        );
        setProps(Events.dragcanvas.style, mstyle);
        Events.move3D(Events.dragcanvas, mx * window.devicePixelRatio, my * window.devicePixelRatio);
        Events.dragcanvas.owner = Events.dragthumbnail.owner;
        frame.appendChild(Events.dragcanvas);
    }

    static dragging (e: MouseEvent, el: HTMLElement) {
        e.preventDefault();
        var pt = Events.getTargetPoint(e);
        var dx = pt.x - Events.dragmousex;
        var dy = pt.y - Events.dragmousey;
        Events.move3D(el, dx * window.devicePixelRatio, dy * window.devicePixelRatio);
        if (Palette.getLandingPlace(el, e, window.devicePixelRatio) != 'pages') {
            Thumbs.removePagesCaret();
            return;
        }
        var thumb = Palette.getHittedThumb(el, gn('pagecc')!, window.devicePixelRatio) as HTMLElement | null;
        if (thumb && !thumb.owner) {
            thumb = null;
        }
        if (thumb) {
            Thumbs.overpage(thumb);
        }
        for (var i = 0; i < gn('pagecc')!.childElementCount; i++) {
            var spr = gn('pagecc')!.childNodes[i] as HTMLElement;
            if (!spr.owner) {
                continue;
            }
            var page = gn(spr.owner as string)!;
            if (thumb && (thumb.id != spr.id)) {
                const dragPage = page.owner as Page;
                if (dragPage.id == ScratchJr.stage.currentPage.id) {
                    Thumbs.highlighPage(spr);
                } else {
                    Thumbs.unhighlighPage(spr);
                }
            }
        }
    }

    static removePagesCaret () {
        for (var i = 0; i < gn('pagecc')!.childElementCount; i++) {
            var spr = gn('pagecc')!.childNodes[i] as HTMLElement;
            if (!spr.owner) {
                continue;
            }
            var page = gn(spr.owner as string)!;
            const pageOwner = page.owner as Page;
            if (pageOwner.id == ScratchJr.stage.currentPage.id) {
                Thumbs.highlighPage(spr);
            } else {
                Thumbs.unhighlighPage(spr);
            }
        }
    }

    static drop (e: MouseEvent | TouchEvent, el: HTMLElement) {
        e.preventDefault();
        switch (Palette.getLandingPlace(el, e, window.devicePixelRatio)) {
        case 'pages':
            var thumb = Palette.getHittedThumb(el, gn('pagecc')!, window.devicePixelRatio) as HTMLElement | null;
            if (thumb && thumb.id != 'emptypage') {
                ScratchJr.stage.copySprite(el, thumb);
            }
            break;
        default:
            break;
        }
        if (Events.dragcanvas) {
            Events.dragcanvas.parentNode!.removeChild(Events.dragcanvas);
        }
        Events.dragcanvas = null;
    }

    static click (e: MouseEvent | TouchEvent, el: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        Thumbs.t = e.target;
        el.setAttribute('class', ScratchJr.isEditable() ? 'spritethumb on' : 'spritethumb noneditable');
        Thumbs.clickOnSprite(e, el);
    }

    static highlighSprite (spr: HTMLElement) {
        spr.setAttribute('class', ScratchJr.isEditable() ? 'spritethumb on' : 'spritethumb noneditable');
        ScriptsPane.setActiveScript(spr.owner as string);
        Palette.reset();
    }

    static unhighlighSprite (spr: HTMLElement) {
        spr.setAttribute('class', 'spritethumb off');
        var currentsc = gn(String(spr.owner) + '_scripts')!;
        (currentsc.owner as Scripts).deactivate();
        for (var i = 0; i < currentsc.childElementCount; i++) {
            if (currentsc.childNodes[i].owner) {
                (currentsc.childNodes[i].owner as Block).unhighlight();
            }
        }
    }

    static quickHighlight (spr: HTMLElement) {
        if (spr.owner == ScratchJr.stage.currentPage.currentSpriteName) {
            spr.className = 'spritethumb on target';
        } else {
            spr.className = 'spritethumb off target';
        }
    }

    static quickRestore (spr: HTMLElement) {
        if (spr.owner == ScratchJr.stage.currentPage.currentSpriteName) {
            spr.className = ScratchJr.isEditable() ? 'spritethumb on' : 'spritethumb noneditable';
        } else {
            spr.className = 'spritethumb off';
        }
    }
}
