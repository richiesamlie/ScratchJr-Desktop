
import ScratchJr from '../ScratchJr';
import iOS from '../../iPad/iOS';
import IO from '../../iPad/IO';
import MediaLib from '../../iPad/MediaLib';
import Paint from '../../painteditor/Paint';
import Events from '../../utils/Events';
import Localization from '../../utils/Localization';
import ScratchAudio from '../../utils/ScratchAudio';
import {gn, newHTML, scaleMultiplier,
    getDocumentWidth, getDocumentHeight, setProps, newCanvas, frame} from '../../utils/lib';

let selectedOne: string | null = null;
let nativeJr = true;
let clickThumb: HTMLElement | null = null;
let shaking: HTMLElement | null = null;
let type: string | null = null;
let timeoutEvent: NodeJS.Timeout | null = null;
let libFrame: HTMLElement | null = null;

// Asset thumbnails carry a JSON-stringified pointer for drag-distance checks
interface LibraryThumb extends HTMLElement {
    pt?: string;
}

// Media-library asset bag (MediaLib.MediaItem or raw SQL rows); all-optional
// shape keeps it assignable both from MediaItem[] and from JSON.parse results.
interface LibraryMediaItem {
    md5?: string;
    width?: unknown;
    height?: unknown;
    name?: unknown;
    scale?: unknown;
    order?: string;
    altmd5?: unknown;
}

export default class Library {
    static init () {
        libFrame = document.getElementById('libframe')!;
        libFrame.style.minHeight = Math.max(getDocumentHeight(), frame.offsetHeight) + 'px';
        var topbar = newHTML('div', 'topbar', libFrame);
        topbar.setAttribute('id', 'topbar');
        var actions = newHTML('div', 'actions', topbar);
        actions.setAttribute('id', 'libactions');
        var ascontainer = newHTML('div', 'assetname-container', topbar);
        var as = newHTML('div', 'assetname', ascontainer);
        var myname = newHTML('p', undefined, as);
        myname.setAttribute('id', 'assetname');
        myname.textContent = '';
        Library.layoutHeader();
    }

    static createScrollPanel () {
        var inner = newHTML('div', 'innerlibrary', libFrame!);
        inner.setAttribute('id', 'asssetsview');
        var div = newHTML('div', 'scrollarea', inner);
        div.setAttribute('id', 'scrollarea');
        
        Library.resizeScroll();
    }

    static open (libType: string) {
        type = libType;
        gn('assetname')!.textContent = '';
        nativeJr = true;
        frame.style.display = 'none';
        libFrame!.className = 'libframe appear';
        libFrame!.focus();
        selectedOne = null;
        gn('okbut')!.onmousedown = (type == 'costumes') ? Library.closeSpriteSelection : Library.closeBkgSelection;
        Library.clean();
        Library.createScrollPanel();
        Library.addThumbnails(type);


        window.onmousedown = null;
        window.onmouseup = null;
        document.onmousemove = null;
        window.onresize = null;

        gn('library_paintme')!.style.opacity = '1';
        gn('library_paintme')!.onmousedown = Library.editResource;

        // Set the back button callback
        ScratchJr.onBackButtonCallback.push(function () {
            var e = document.createEvent('TouchEvent') as TouchEvent & { initTouchEvent: () => void };
            e.initTouchEvent();
            Library.cancelPick(e);
        });
    }

    static clean () {
        if (gn('scrollarea')!) {
            var div = gn('scrollarea')!.parentNode as Node;
            libFrame!.removeChild(div);
        }
    }

    static close (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        ScratchAudio.sndFX('tap.wav');
        ScratchJr.blur();
        // Reset selection state and detach the picker's mouse handlers so a
        // closed picker can never re-add via stale handlers.
        selectedOne = null;
        clickThumb = null;
        window.onmouseup = null;
        window.onmousemove = null;
        if (libFrame) {
            const thumbs = libFrame.querySelectorAll('.assetbox');
            for (let i = 0; i < thumbs.length; i++) {
                (thumbs[i] as HTMLElement).onmouseup = null;
                (thumbs[i] as HTMLElement).onmousemove = null;
            }
        }
        libFrame!.className = 'libframe disappear';
        document.body.scrollTop = 0;
        frame.style.display = 'block';
        ScratchJr.editorEvents();
        ScratchJr.onBackButtonCallback.pop();
    }

    static layoutHeader () {
        var buttons = newHTML('div', 'bkgbuttons', gn('libactions')!);
        var paintme = newHTML('div', 'painticon', buttons);
        paintme.id = 'library_paintme';
        paintme.onmousedown = Library.editResource;
        var okbut = newHTML('div', 'okicon', buttons);
        okbut.setAttribute('id', 'okbut');
        var cancelbut = newHTML('div', 'cancelicon', buttons);
        cancelbut.onmousedown = Library.cancelPick;
    }

    static cancelPick (e: Event) {
        ScratchJr.onHold = true;
        Library.close(e);
        setTimeout(function () {
            ScratchJr.onHold = false;
        }, 1000);
    }

    static addThumbnails (type?: string) {
        var div = gn('scrollarea')!;
        Library.addEmptyThumb(div, (type == 'costumes') ? (118 * scaleMultiplier) : (120 * scaleMultiplier), (type == 'costumes') ? (90 * scaleMultiplier) : (90 * scaleMultiplier));
        var key = (type == 'costumes') ? 'usershapes' : 'userbkgs';
        // Student' assets
        var json: SqlPayload = {};
        json.cond = 'ext = ? AND version = ?';
        json.items = ((type == 'costumes')
            ? ['md5', 'altmd5', 'name', 'scale', 'width', 'height'] : ['altmd5', 'md5', 'width', 'height']);
        json.values = ['svg', ScratchJr.version];
        json.order = 'ctime desc';
        IO.query(key, json, Library.displayAssets);
    }

    static skipUserAssets () {
        var div = gn('scrollarea')!;
        Library.addEmptyThumb(div, (type == 'costumes') ? (118 * scaleMultiplier) : (120 * scaleMultiplier), (type == 'costumes') ? (90 * scaleMultiplier) : (90 * scaleMultiplier));
        Library.addHR(div);
        Library.displayLibAssets((type == 'costumes') ? MediaLib.sprites : MediaLib.backgrounds);
    }

    static getpadding (div: HTMLElement) {
        var w = Math.min(getDocumentWidth(), libFrame!.offsetWidth);
        var dw = (div.childNodes[1] as HTMLElement).offsetLeft - (div.childNodes[0] as HTMLElement).offsetLeft;
        var qty = Math.floor(w / dw);
        var pad = Math.floor((w - (qty * dw)) / 2);
        if (pad < 10) {
            return Math.floor((w - ((qty - 1) * dw)) / 2);
        }
        return pad;
    }

    static displayAssets (str: string) {
        nativeJr = true;
        var div = gn('scrollarea')!;
        var data = JSON.parse(str);
        if (data.length > 0) {
            for (var i = 0; i < data.length; i++) {
                Library.addAssetThumbChoose(div, data[i], 120 * scaleMultiplier, 90 * scaleMultiplier, Library.selectAsset);
            }
        }
        Library.addHR(div);
        nativeJr = false;
        data = (type == 'costumes') ? MediaLib.sprites : MediaLib.backgrounds;
        Library.displayLibAssets(data);
    }

    static displayLibAssets (data: LibraryMediaItem[]) {
        var div = gn('scrollarea')!;
        if (data.length < 1) {
            return;
        }
        var order = data[0].order;
        var key = order ? order.split(',')[1] : '';
        for (var i = 0; i < data.length; i++) {
            order = data[i].order;
            var key2 = order ? order.split(',')[1] : '';
            if (key2 != key) {
                Library.addHR(div);
                key = key2;
            }
            if ('separator' in data[i]) {
                Library.addHR(div);
            } else {
                Library.addLocalThumbChoose(div, data[i], 120 * scaleMultiplier, 90 * scaleMultiplier, Library.selectAsset);
            }
        }
    }

    static addAssetThumbChoose (parent: HTMLElement, aa: Record<string, unknown>, w: number, h: number, fcn: (e: MouseEvent, tb: LibraryThumb) => void) {
        var data = Library.parseAssetData(aa);
        var tb = document.createElement('div');
        parent.appendChild(tb);
        tb.byme = nativeJr ? 1 : 0;
        var md5 = data.md5 as string;
        tb.setAttribute('class', 'assetbox off');
        tb.setAttribute('id', md5);
        tb.scale = (!data.scale) ? 0.5 : (data.scale as number);
        tb.fieldname = data.name as string;
        tb.w = Number(data.width);
        tb.h = Number(data.height);
        var scale = Math.min(w / tb.w, h / tb.h);
        var img = newHTML('img', undefined, tb) as HTMLImageElement;
        img.style.left = (9 * scaleMultiplier) + 'px';
        img.style.top = (7 * scaleMultiplier) + 'px';
        img.style.position = 'relative';
        img.style.height = (Number(data.height) * scale) + 'px';
        if (data.altmd5) {
            IO.getAsset(data.altmd5 as string, drawMe);
        }
        function drawMe (dataurl: string) {
            img.src = dataurl;
        }
        tb.onmousedown = function (evt) {
            fcn(evt, tb);
        };
        return tb;
    }

    static addLocalThumbChoose (parent: HTMLElement, data: LibraryMediaItem, w: number, h: number, fcn: (e: MouseEvent, tb: LibraryThumb) => void) {
        var tb = newHTML('div', 'assetbox off', parent);
        var md5 = data.md5 as string;
        tb.byme = nativeJr ? 1 : 0;
        tb.setAttribute('id', md5);
        tb.scale = (!data.scale) ? 0.5 : (data.scale as number);
        tb.fieldname = data.name as string;
        tb.w = Number(data.width);
        tb.h = Number(data.height);

        var img = newHTML('img', undefined, tb) as HTMLImageElement;
        var scale = Math.min(w / tb.w, h / tb.h);
        img.style.height = tb.h * scale + 'px';
        img.style.width = tb.w * scale + 'px';

        img.style.left = Math.floor(((w - (scale * tb.w)) / 2) + (9 * scaleMultiplier)) + 'px';
        img.style.top = Math.floor(((h - (scale * tb.h)) / 2) + (9 * scaleMultiplier)) + 'px';
        img.style.position = 'relative';

        // Cached downsized-thumbnails are in pnglibrary
        var pngPath = MediaLib.path.replace('svg', 'png');
        img.src = pngPath + IO.getFilename(md5) + '.png';

        tb.onmousedown = function (evt: MouseEvent) {
            fcn(evt, tb);
        };
        return tb;
    }

    static userAssetThumbnail (img: HTMLImageElement, cnv: HTMLCanvasElement, sizew: number, sizeh: number) {
        var scale = Math.min(sizew / img.width, sizeh / img.height);
        var currentCtx = cnv.getContext('2d')!;
        var iw = Math.floor(scale * img.width);
        var ih = Math.floor(scale * img.height);
        var ix = Math.floor((sizew - (scale * img.width)) / 2);
        var iy = Math.floor((sizeh - (scale * img.height)) / 2);
        currentCtx.drawImage(img, 0, 0, img.width, img.height, ix, iy, iw, ih);
    }

    static addEmptyThumb (parent: HTMLElement, w: number, h: number) {
        var tb = document.createElement('div');
        tb.setAttribute('class', 'assetbox off');
        tb.setAttribute('id', 'none');
        tb.fieldname = ((type == 'costumes')
            ? Localization.localize('LIBRARY_CHARACTER') : Localization.localize('LIBRARY_BACKGROUND'));
        tb.byme = 1;
        var cnv = newCanvas(tb, 9 * scaleMultiplier, 7 * scaleMultiplier, w, h, {
            position: 'relative'
        });
        var ctx = cnv.getContext('2d')!;
        ctx.fillStyle = ScratchJr.stagecolor;
        ctx.fillRect(0, 0, w, h);
        parent.appendChild(tb);
        tb.onmousedown = function (evt) {
            Library.selectAsset(evt, tb);
        };
    }

    static addHR (div: HTMLElement) {
        var hr = document.createElement('hr');
        div.appendChild(hr);
        hr.setAttribute('class', 'bigdivide');
    }

    ///////////////////////////
    //selection


    static selectAsset (e: MouseEvent, tb: LibraryThumb) {
        tb.pt = JSON.stringify(Events.getTargetPoint(e));
        if (shaking && ((e.target as HTMLElement).className == 'deleteasset')) {
            Library.removeFromAssetList();
            return;
        } else if (shaking) {
            Library.stopShaking();
        }
        if (tb.byme && (tb.id != 'none')) {
            holdit();
        }
        tb.onmouseup = function (evt) {
            clickMe(evt, tb);
        };
        window.onmouseup = function (evt) {
            clickMe(evt, tb);
        };
        window.onmousemove = function (evt) {
            clearEvents(evt, tb);
        };
        function holdit () {
            var repeat = function () {
                tb.onmouseup = null;
                window.onmouseup = null;
                window.onmousemove = null;
                timeoutEvent = null;
                Library.stopShaking();
                shaking = tb;
                Library.clearAllSelections();
                Library.startShaking(tb);
            };
            timeoutEvent = setTimeout(repeat, 500);
        }
        function clearEvents (e: MouseEvent, tb: LibraryThumb) { // eslint-disable-line no-shadow
            var pt = Events.getTargetPoint(e);
            var pt2 = JSON.parse(tb.pt!);
            if (Library.distance(pt, pt2) < 30) {
                return;
            }
            e.preventDefault();
            if (timeoutEvent) {
                clearTimeout(timeoutEvent);
            }
            if (clickThumb) {
                Library.unSelect(clickThumb);
            }
            timeoutEvent = null;
            tb.onmouseup = null;
            window.onmouseup = function () {
                window.onmousemove = null;
                window.onmouseup = null;
            };
        }
        function clickMe (e: MouseEvent, tb: LibraryThumb) { // eslint-disable-line no-shadow
            if (timeoutEvent) {
                clearTimeout(timeoutEvent);
            }
            Library.selectThisAsset(e, tb);
            timeoutEvent = null;
            tb.onmouseup = null;
            tb.onmouseup = null;
            window.onmousemove = null;
            window.onmouseup = null;
        }
    }

    static startShaking (b: LibraryThumb) {
        b.className = b.className + ' shakeme';
        newHTML('div', 'deleteasset', b);
        shaking = b;
    }

    static stopShaking () {
        if (!shaking) {
            return;
        }
        var b = shaking;
        b.setAttribute('class', 'assetbox off');
        var ic = b.childNodes[b.childElementCount - 1] as HTMLElement;
        if (ic.getAttribute('class') == 'deleteasset') {
            b.removeChild(ic);
        }
        shaking = null;
    }

    static removeFromAssetList () {
        ScratchAudio.sndFX('cut.wav');
        var b = shaking!;
        b.parentNode!.removeChild(b);
        var key = (type == 'costumes') ? 'usershapes' : 'userbkgs';
        var json: SqlPayload = {};
        json.cond = 'md5 = ?';
        json.items = ['*'];
        json.values = [b.id];
        IO.query(key, json, Library.removeAssetFromLib);
        clickThumb = null;
        selectedOne = null;
        return true;
    }

    // Determine if an asset thumbnail is unique
    // md5: thumbnail md5 to determine uniqueness
    // type: "costumes" or "backgrounds"
    // callback: called with true if unique, false if duplicate exists
    static assetThumbnailUnique (md5: string, type: string, callback: (isUnique: boolean) => void) {
        var key = (type == 'costumes') ? 'usershapes' : 'userbkgs';
        var json: SqlPayload = {};
        json.cond = 'ext = ? AND altmd5 = ?';
        json.items = ['md5', 'altmd5'];
        json.values = ['svg', md5];
        json.order = 'ctime desc';
        IO.query(key, json, function (results: string) {
            results = JSON.parse(results);
            callback(results.length <= 1);
        });
    }

    static removeAssetFromLib (str: string) {
        var key = (type == 'costumes') ? 'usershapes' : 'userbkgs';
        var aa = JSON.parse(str)[0];
        var data = Library.parseAssetData(aa);

        if (data.altmd5) {
            // Removes the thumbnail for the asset.
            // First ensure that there aren't other characters/bgs using the same thumb
            // (this is possible if we receive a duplicate project, for example)
            Library.assetThumbnailUnique(data.altmd5 as string, type!, function (isUnique: boolean) {
                if (isUnique) {
                    iOS.remove(data.altmd5 as string, iOS.trace);
                }
            });
        }

        IO.deleteobject(key, data.id as string, iOS.trace);
    }

    static parseAssetData (data: Record<string, unknown>): Record<string, unknown> {
        var res: Record<string, unknown> = {};
        for (var key in data) {
            res[key.toLowerCase()] = data[key];
        }
        return res;
    }

    static selectThisAsset (e: MouseEvent, tb: LibraryThumb) {
        if (tb.id == selectedOne) {
            if (type == 'costumes') {
                Library.closeSpriteSelection(e);
            } else {
                Library.closeBkgSelection(e);
            }
        } else {
            Library.clearAllSelections();

            // Disable paint editor for PNG sprites
            var thumbID = tb.id;
            var thumbType = thumbID.substr(thumbID.length - 3);
            if (thumbType == 'png') {
                gn('library_paintme')!.style.opacity = '0';
                gn('library_paintme')!.onmousedown = null;
            } else {
                gn('library_paintme')!.style.opacity = '1';
                gn('library_paintme')!.onmousedown = Library.editResource;
            }

            tb.className = 'assetbox on';
            selectedOne = tb.id;
            clickThumb = tb;
            if (tb.fieldname) {
                gn('assetname')!.textContent = tb.fieldname;
            }
        }
    }

    static clearAllSelections () {
        var div = gn('scrollarea')!;
        for (var i = 0; i < div.childElementCount; i++) {
            if (div.childNodes[i].nodeName == 'DIV') {
                (div.childNodes[i] as HTMLElement).className = 'assetbox off';
            }
        }
    }

    static unSelect (tb: LibraryThumb) {
        gn('assetname')!.textContent = '';
        tb.className = 'assetbox off';
        selectedOne = null;
        if (clickThumb) {
            if (tb.byme && (clickThumb.childElementCount > 1)) {
                (clickThumb.childNodes[clickThumb.childElementCount - 1] as HTMLElement).style.visibility = 'hidden';
            }
            clickThumb = null;
        }
    }

    static resizeScroll () {
        var w = Math.min(getDocumentWidth(), frame.offsetWidth);
        var h = Math.max(getDocumentHeight(), frame.offsetHeight);
        var dx = w - 20 * scaleMultiplier;
        
        setProps(gn('scrollarea')!.style, {
            width: dx + 'px',
            height: (h - 120 * scaleMultiplier) + 'px'
        });
    }

    ///////////////////////////////////////////
    // Object actions
    //////////////////////////////////////////

    static editResource (e: Event) {
        Library.close(e);
        if (type != 'costumes') {
            Library.editBackground(e);
        } else {
            Library.editCostume(e);
        }
    }

    static editBackground (e?: Event) {
        var md5 = selectedOne && (selectedOne != 'none') ? selectedOne : undefined;
        Paint.open(true, md5);
    }

    static editCostume (e?: Event) {
        var sname;
        var cname = selectedOne ? clickThumb!.fieldname : Localization.localize('LIBRARY_CHARACTER');
        var scale = selectedOne && (selectedOne != 'none') ? clickThumb!.scale : 0.5;
        var md5 = selectedOne && (selectedOne != 'none') ? selectedOne : undefined;
        var w = selectedOne && (selectedOne != 'none') ? Math.round(clickThumb!.w!) : undefined;
        var h = selectedOne && (selectedOne != 'none') ? Math.round(clickThumb!.h!) : undefined;
        Paint.open(false, md5, sname, cname, scale, w, h);
    }

    static closeSpriteSelection (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        // Guard against re-entrant adds while a previous sprite is still
        // loading (onHold stays true until spriteAdded fires).
        if (ScratchJr.onHold) {
            return;
        }
        var id = selectedOne ? clickThumb!.fieldname! : Localization.localize('LIBRARY_CHARACTER');
        if (selectedOne && (selectedOne != 'none')) {
            ScratchJr.stage.currentPage.addSprite(clickThumb!.scale!, selectedOne, id);
        }

        // Prevent reporting user asset names
        if (clickThumb) {
            var analyticsName = clickThumb.fieldname;
            if (!((selectedOne as string) in MediaLib.keys)) {
                analyticsName = 'user_asset';
            }
            iOS.analyticsEvent('editor', 'new_character', analyticsName);
        }
        Library.close(e);
    }

    static closeBkgSelection (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        if (selectedOne) {
            ScratchJr.stage.currentPage.setBackground(selectedOne, ScratchJr.stage.currentPage.updateBkg);
        }
        Library.close(e);
    }

    /////////////////////////////////////////
    //Key Handeling Top Level prevention
    /////////////////////////////////////////

    static distance (pt1: { x: number; y: number }, pt2: { x: number; y: number }) {
        var dx = pt1.x - pt2.x;
        var dy = pt1.y - pt2.y;
        return Math.round(Math.sqrt((dx * dx) + (dy * dy)));
    }
}
