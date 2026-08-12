import ScratchJr from '../editor/ScratchJr';
import BlockSpecs from '../editor/blocks/BlockSpecs';
import SVGTools from './SVGTools';
import SVG2Canvas from '../utils/SVG2Canvas';
import Ghost from './Ghost';
import iOS from '../iPad/iOS';

// Named-form access: document.forms.spriteform
const namedForms = document.forms as unknown as {
    spriteform: HTMLFormElement & { name: HTMLInputElement };
};
import IO from '../iPad/IO';
import MediaLib from '../iPad/MediaLib';
import Localization from '../utils/Localization';
import Alert from '../editor/ui/Alert';
import PaintAction from './PaintAction';
import ScratchAudio from '../utils/ScratchAudio';
import Path from './Path';
import type Sprite from '../editor/engine/Sprite';
import PaintUndo from './PaintUndo';
import Camera from './Camera';
import Events from '../utils/Events';
import Transform from './Transform';
import Vector from '../geom/Vector';
import type {Point} from '../geom/Vector';
import {gn, newHTML, setCanvasSize, getIdFor, isAndroid, setProps, hitRect, frame} from '../utils/lib';

// The costume name input carries a local `firstTime` expando flag (see nameFocus).
interface PaintNameInput extends HTMLInputElement {
    firstTime?: boolean;
}

// Originally several files (Paint.js, PaintIO.js, PaintLayout.js)
// were all contributing utility functions to the Paint object.
// To consolidate it into a single module, I've combined these below.
// A nice refactor would be to split them back into the "modules," but that will likely involve
// some serious code changes - determining where the relevant Paint.X are called, if any shared
// data needs to be moved, etc. -TM
let xmlns = 'http://www.w3.org/2000/svg';
let xmlnslink = 'http://www.w3.org/1999/xlink';
let fillcolor = '#080808';
let workspaceWidth = 432;
let workspaceHeight = 384;
let mode: string = 'select';
let pensizes = [1, 2, 4, 8, 16];

let strokewidth = 2;
let spriteId: string | undefined;
let currentName: string | undefined;
let costumeScale: string | number | undefined;
let nativeJr;
let isBkg = false;
let currentMd5: string | null = null;
let currentZoom = 1;
let root: SVGSVGElement;
let saving = false;
let paintFrame: HTMLElement | null = null;
let saveMD5: string | null = null;
let svgdata: string | null = null;
let splash: string | null = null;
let splashshade: string | null = null;
let maxZoom = 5;
let minZoom = 1;
let initialPoint = {
    x: 0,
    y: 0
};
let deltaPoint = {
    x: 0,
    y: 0
};

export default class Paint {
    static skipNext: boolean;


    static get xmlns () {
        return xmlns;
    }

    static get xmlnslink () {
        return xmlnslink;
    }

    static get fillcolor () {
        return fillcolor;
    }

    static get workspaceWidth () {
        return workspaceWidth;
    }

    static get workspaceHeight () {
        return workspaceHeight;
    }

    static get mode () {
        return mode;
    }

    static set mode (newMode) {
        mode = newMode;
    }

    static get strokewidth () {
        return strokewidth;
    }

    static get currentZoom () {
        return currentZoom;
    }

    static set currentZoom (newCurrentZoom) {
       // currentZoom = newCurrentZoom;
       currentZoom = 1;
    }

    static get root () {
        return root;
    }

    static get saving () {
        return saving;
    }

    static get frame () {
        return paintFrame;
    }

    static get splash () {
        return splash;
    }

    static get splashshade () {
        return splashshade;
    }

    static get initialPoint () {
        return initialPoint;
    }

    static set initialPoint (newInitialPoint) {
        initialPoint = newInitialPoint;
    }

    static get deltaPoint () {
        return deltaPoint;
    }

    static set deltaPoint (newDeltaPoint) {
        deltaPoint = newDeltaPoint;
    }

    ///////////////////////////////////////////
    //Opening and Layout
    ///////////////////////////////////////////

    static init (w?: number, h?: number) {
        paintFrame = document.getElementById('paintframe');
        paintFrame!.style.width = w + 'px';
        paintFrame!.style.height = h + 'px';
        BlockSpecs.loadCount++;
        IO.requestFromServer('assets/paint/splash.svg', Paint.setSplash);
        BlockSpecs.loadCount++;
        IO.requestFromServer('assets/paint/splashshade.svg', Paint.setSplashShade);
    }

    static setSplash (str: string) {
        BlockSpecs.loadCount--;
        splash = str;
    }

    static setSplashShade (str: string) {
        BlockSpecs.loadCount--;
        splashshade = 'data:image/svg+xml;base64,' + btoa(str);
    }

    static open (bkg: boolean, md5: string | undefined, sname?: string, cname?: string, cscale?: string | number, sw?: number, sh?: number) {
        iOS.analyticsEvent('editor', 'paint_editor_opened', bkg ? 'bkg' : 'character');
        PaintUndo.buffer = [];
        PaintUndo.index = 0;
        maxZoom = 5;
        minZoom = 1;
        workspaceWidth = 432;
        workspaceHeight = 384;
        Paint.clearWorkspace();
        frame.style.display = 'none';
        paintFrame!.className = 'paintframe appear';
        currentMd5 = md5 ?? null;
        isBkg = bkg;
        spriteId = sname;
        currentName = cname;
        costumeScale = cscale;
        SVGTools.init();
        nativeJr = true;
        if (isBkg) {
            Paint.initBkg(480, 360);
        } else {
            Paint.initSprite(sw, sh);
        }
        window.onmousedown = Paint.detectGesture;
        window.ondevicemotion = null;

        // Set the back button callback
        ScratchJr.onBackButtonCallback.push(function () {
            var e = document.createEvent('TouchEvent');
            (e as TouchEvent & { initTouchEvent: () => void }).initTouchEvent();
            Paint.backToProject(e);
        });
    }


    //Paint Editor Gestures


    static blockGestures (e: TouchEvent) {
        if (!e.touches) {
            return;
        }
        if (e.touches.length == 4) {
            Paint.ignore(e);
        }
    }

    static detectGesture (e: MouseEvent | TouchEvent) {
       /* if (!e.touches) {
            return;
        }*/
        if (Camera.active) {
            return;
        }
        Paint.clearEvents(e);
        initialPoint = PaintAction.getScreenPt(e);
        deltaPoint = PaintAction.getScreenPt(e);
        //var n = Math.min(3, e.touches.length);
       // var cmdForGesture = [Paint.ignore, Paint.mouseDown, Paint.pinchStart, Paint.Scroll];
        Paint.mouseDown(e);
    }

    static clearEvents (e: Event) {
        window.onmousemove = null;
        window.onmouseup = null;
        if (PaintAction.currentshape) {
            PaintAction.stopAction(e);
        }
        Events.clearEvents();
        PaintAction.clearEvents();
    }

    static ignore (e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    static Scroll (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        if (Paint.canvasFits()) {
            return;
        }
        Ghost.clearLayer();
        initialPoint = PaintAction.getScreenPt(e);
        window.onmousemove = function (evt: MouseEvent) {
            Paint.dragBackground(evt);
        };
        window.onmouseup = function () {
            Paint.bounceBack();
            Paint.setCanvasTransform(currentZoom);
            PaintAction.clearEvents();
        };
    }

    static pinchStart (e: MouseEvent | TouchEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (PaintAction.currentshape) {
            return;
        }
        window.onmousemove = function () {
            Paint.gestureStart(e);
        };
    }

    static gestureStart (e: MouseEvent | TouchEvent) {
        window.onmousemove = null;
        var skipmodes = ['path', 'ellipse', 'rect'];
        if (skipmodes.indexOf(mode) > -1) {
            if (PaintAction.currentshape && PaintAction.currentshape.parentNode) {
                PaintAction.currentshape.parentNode.removeChild(PaintAction.currentshape);
            }
        }
        Ghost.clearLayer();
        Events.scaleStartsAt = currentZoom;
        Events.updatePinchCenter(e);
        initialPoint = PaintAction.zoomPt(Events.pinchcenter);
        Events.clearEvents();
        Events.clearDragAndDrop();
        window.onmousemove = Paint.gestureChange;
        window.onmouseup = Paint.gestureEnd;
    }

    static gestureChange (e: MouseEvent | TouchEvent) {
        e.preventDefault();
        var scale = Math.min(maxZoom, Events.scaleStartsAt * Events.zoomScale(e));
        scale = Math.max(minZoom, scale);
        var mc = gn('maincanvas')!;
        var w = mc.offsetWidth * scale;
        var h = mc.offsetHeight * scale;
        var size = Math.min(w, h);
        if (size < 240) {
            return;
        }
        Paint.updateZoomScale(scale);
        var pt = PaintAction.zoomPt(Events.pinchcenter);
        var delta = Vector.diff(pt, initialPoint);
        Paint.adjustPos(delta);
    }

    static gestureEnd (e: MouseEvent | TouchEvent) {
        e.preventDefault();
        window.onmousemove = null;
        window.onmouseup = null;
        var scale = Math.min(maxZoom, Events.scaleStartsAt * Events.zoomScale(e));
        scale = Math.max(minZoom, scale);
        Paint.updateZoomScale(scale);
        var pt = PaintAction.zoomPt(Events.pinchcenter);
        var delta = Vector.diff(pt, initialPoint);
        Paint.adjustPos(delta);
        Events.scaleStartsAt = currentZoom;
        if (Path.selector) {
            Path.showDots(Path.selector);
        }
        Paint.setZoomTo(scale);
    }

    static canvasFits () {
        return ((gn('maincanvas')!.offsetWidth * currentZoom <= gn('workspacebkg')!.offsetWidth)
            && (gn('maincanvas')!.offsetHeight * currentZoom <= gn('workspacebkg')!.offsetHeight));
    }

    static mouseDown (e: MouseEvent | TouchEvent) {
        var t = e.target as HTMLElement;
        if (t.onmousedown) {
            return;
        }
        var pt = Events.getTargetPoint(e);
        if (hitRect(gn('donecheck')!, pt)) {
            Paint.backToProject(e);
        } else {
            if (t.parentNode && (t.parentNode as Element).getAttribute('key')) {
                return;
            } else {
                PaintAction.mouseDown(e);
            }
        }
    }

    static close () {
        saving = true;
        paintFrame!.className = 'paintframe disappear';
        frame.style.display = 'block';
        ScratchJr.editorEvents();
        window.onmousemove = null;
        window.onmouseup = null;
        window.onmousemove = null;
        Alert.close();
        Paint.clearWorkspace();
        PaintUndo.buffer = [];
        PaintUndo.index = 0;
        Ghost.maskData = {};
        setTimeout(function () {
            saving = false;
        }, 500); // delay so it doesn't open the info box
    }

    static backToProject (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        if (saving) {
            return;
        }
        if (PaintAction.dragGroup.length > 0) {
            return;
        }
        var te = e as TouchEvent;
        if (te.touches && (te.touches.length > 1)) {
            return;
        }
        Path.quitEditMode();
        Camera.close();
        PaintAction.clearDragGroup();
        ScratchJr.unfocus();
        ScratchAudio.sndFX('tap.wav');
        if ((spriteId == null) && (currentName == null)) {
            Paint.savePageImage(Paint.changePage);
        } else {
            Paint.saveSprite(Paint.changePageSprite);
        }
        ScratchJr.onBackButtonCallback.pop();
    }

    static saveEditState (fcn?: (result: unknown) => void) {
        Camera.close();
        ScratchJr.unfocus();
        ScratchAudio.sndFX('tap.wav');
        if ((spriteId == null) && (currentName == null)) {
            Paint.savePageImage();
        } else {
            Paint.saveSprite();
        }
    }

    /////////////////////////
    //Modes
    /////////////////////////

    static setMode (e: Event) {
        var te = e as TouchEvent;
        if (te.touches && (te.touches.length > 1)) {
            return;
        }
        e.preventDefault();
        var t: EventTarget | null;
        if (window.event) {
            t = window.event.srcElement;
        } else {
            t = e.target;
        }
        if (t == null) {
            return;
        }
        Path.quitEditMode();
        if (Camera.active) {
            Camera.doAction((t as Element).getAttribute('key')!);
        } else {
            var tools = ['select', 'rotate', 'stamper', 'scissors', 'camera', 'paintbucket'];
            if (tools.indexOf((t as Element).getAttribute('key')!) > -1) {
                ScratchAudio.sndFX('tap.wav');
            }
            Paint.selectButton((t as Element).getAttribute('key')!);
        }
    }

    static selectButton (str: string) {
        Paint.selectButtonFromDiv(gn('painttools')!, str);
        Paint.selectButtonFromDiv(gn('selectortools')!, str);
        Paint.selectButtonFromDiv(gn('edittools')!, str);
        Paint.selectButtonFromDiv(gn('filltools')!, str);
        if (gn('stamps')!) {
            Paint.selectButtonFromDiv(gn('stamps')!, str);
        }
        mode = str;
        Paint.selectPenSize(pensizes.indexOf(strokewidth));
    }

    static selectButtonFromDiv (p: HTMLElement, str: string) {
        for (var i = 0; i < p.childElementCount; i++) {
            var elem = p.childNodes[i] as Element;
            var icon = elem.childNodes[0] as Element;
            if (icon.getAttribute('key') == str) {
                elem.setAttribute('class', Paint.getClass(elem, 'on'));
                if (icon.getAttribute('class')) {
                    icon.setAttribute('class', Paint.getClass(icon, 'on'));
                }
            } else {
                elem.setAttribute('class', Paint.getClass(elem, 'off'));
                if (icon.getAttribute('class')) {
                    icon.setAttribute('class', Paint.getClass(icon, 'off'));
                }
            }
        }
    }

    static getClass (elem: Element, state: string) {
        var list = elem.getAttribute('class')!.split(' ');
        list.pop();
        list.push(state);
        return list.join(' ');
    }


    //Zoom Management
    ///////////////////////////////////////////

    static setZoomTo (value: number) {
        //currentZoom = value;
        currentZoom = 1;
        
        Paint.bounceBack();
        Paint.setCanvasTransform(value);
        Ghost.drawOffscreen();
    }

    static updateZoomScale (value: number) {
        currentZoom = 1;
        
        // currentZoom = value;
        Paint.setCanvasTransform(value);
    }

    static setCanvasTransform (value: number) {
        if (isAndroid) { // Use 3D translate to increase speed
            gn('maincanvas')!.style.webkitTransform = 'translate3d(' + gn('maincanvas')!.dx + 'px,'
                + gn('maincanvas')!.dy + 'px, 0px) scale(' + value + ',' + value + ')';
        } else { // Use 2D translate to maintain sharpness
            gn('maincanvas')!.style.webkitTransform = 'translate(' + gn('maincanvas')!.dx + 'px,'
                + gn('maincanvas')!.dy + 'px) scale(' + value + ',' + value + ')';

        }
    }

    static adjustPos (delta: Point) {
        gn('maincanvas')!.dx! += delta.x;
        gn('maincanvas')!.dy! += delta.y;
        Paint.setCanvasTransform(currentZoom);
    }

    static bounceBack () {
        var mx = Math.floor((gn('workspacebkg')!.offsetWidth - workspaceWidth) / 2);
        var my = Math.floor((gn('workspacebkg')!.offsetHeight - workspaceHeight) / 2);
        gn('maincanvas')!.dx = Paint.canvasFits() ? mx : Paint.getCoorx(20, mx);
        gn('maincanvas')!.dy = Paint.canvasFits() ? my : Paint.getCoory(20, my);
    }

    static getCoorx (indent: number, val: number) {
        if (gn('maincanvas')!.offsetWidth * currentZoom <= gn('workspacebkg')!.offsetWidth) {
            return val;
        }
        var dx = gn('maincanvas')!.dx! + gn('maincanvas')!.cx! - gn('maincanvas')!.cx! * currentZoom;
        if (dx > indent) {
            return gn('maincanvas')!.dx! + (indent - dx);
        }
        val = ((dx / currentZoom) + gn('maincanvas')!.offsetWidth) * currentZoom;
        var edge = gn('workspacebkg')!.offsetWidth - indent;
        if (val < edge) {
            return gn('maincanvas')!.dx! + (edge - val);
        }
        return gn('maincanvas')!.dx!;
    }

    static getCoory (indent: number, val: number) {
        if (gn('maincanvas')!.offsetHeight * currentZoom <= gn('workspacebkg')!.offsetHeight) {
            return val;
        }
        var dy = gn('maincanvas')!.dy! + gn('maincanvas')!.cy! - gn('maincanvas')!.cy! * currentZoom;
        if (dy > indent) {
            return gn('maincanvas')!.dy! + (indent - dy);
        }
        val = ((dy / currentZoom) + gn('maincanvas')!.offsetHeight) * currentZoom;
        var edge = gn('workspacebkg')!.offsetHeight - indent;
        if (val < edge) {
            return gn('maincanvas')!.dy! + (edge - val);
        }
        return gn('maincanvas')!.dy!;
    }

    static scaleToFit () {
        var dh = (root.parentNode!.parentNode as HTMLElement).offsetHeight / (workspaceHeight + 10);
        var dw = (root.parentNode!.parentNode as HTMLElement).offsetWidth / (workspaceWidth + 10);
        Paint.setZoomTo(Math.min(dw, dh));
    }

    static dragBackground (evt: Event) {
        if (Paint.canvasFits()) {
            return;
        }
        var pt = PaintAction.getScreenPt(evt);
        var delta = Vector.diff(pt, initialPoint);
        Paint.adjustPos(delta);
    }

    /////////////////////////////////////////////////////////
    //dispatch table


    // Originally PaintLayout.js

    /////////////////////////////////
    //Layout Setup
    /////////////////////////////////

    static layout () {
        Paint.topbar();
        var div = newHTML('div', 'innerpaint', paintFrame!);
        Paint.leftPalette(div);
        var workspaceContainer = newHTML('div', 'workspacebkg-container', div);
        var workspace = newHTML('div', 'workspacebkg', workspaceContainer);
        workspace.setAttribute('id', 'workspacebkg');
        Paint.rightPalette(div);
        Paint.colorPalette(paintFrame!);
        Paint.selectButton('path');
        Paint.createSVGeditor(workspace);
    }

    /////////////////////////////////
    //top bar
    /////////////////////////////////

    static topbar () {
        var pt = newHTML('div', 'paintop', paintFrame!);
        Paint.checkMark(pt);
        PaintUndo.setup(pt); // plug here the undo
        Paint.nameOfcostume(pt);
    }

    static checkMark (pt: HTMLElement) {
        var clicky = newHTML('div', 'paintdone', pt);
        clicky.id = 'donecheck';
        clicky.onmousedown = Paint.backToProject;
    }

    static nameOfcostume (p: HTMLElement) {
        var sform = newHTML('form', 'spriteform', p) as HTMLFormElement;
        sform.name = 'spriteform';
        var ti = newHTML('input', undefined, sform) as PaintNameInput;
        ti.autocomplete = false as unknown as AutoFill;
        ti.autocorrect = false;
        ti.name = 'name';
        ti.maxLength = 25;
        ti.firstTime = true;
        ti.onmousedown = () => {};
        ti.onfocus = Paint.nameFocus;
        ti.onblur = Paint.nameBlur;
        ti.onkeypress = Paint.handleNamePress;
        ti.onkeyup = Paint.handleKeyRelease;
        sform.onsubmit = Paint.submitNameChange;
    }

    static submitNameChange (e: Event) {
        e.preventDefault();
        var input = e.target as HTMLInputElement;
        input.blur();
    }

    static nameFocus (e: FocusEvent) {
        e.preventDefault();
        e.stopPropagation();
        var ti = e.target as PaintNameInput;
        ti.firstTime = true;
        ScratchJr.activeFocus = ti as unknown as typeof ScratchJr.activeFocus;
        if (isAndroid) {
            AndroidInterface.scratchjr_setsoftkeyboardscrolllocation(
                ti.getBoundingClientRect().top * window.devicePixelRatio,
                ti.getBoundingClientRect().bottom * window.devicePixelRatio
            );
        }
        setTimeout(function () {
            ti.setSelectionRange(ti.value.length, ti.value.length);
        }, 1);
    }

    static nameBlur (e: FocusEvent) {
        ScratchJr.activeFocus = undefined;
        var spr = ScratchJr.getSprite();
        var ti = e.target as PaintNameInput;
        var val = ScratchJr.validate(ti.value, (spr as Sprite).name);
        ti.value = val.substring(0, ti.maxLength);
        ScratchJr.storyStart('Paint.nameBlur');
    }

    static handleNamePress (e: KeyboardEvent) {
        var key = e.keyCode || e.which;
        if (key == 13) {
            Paint.submitNameChange(e);
        } else {
            var ti = e.target as PaintNameInput;
            if (ti.firstTime) {
                ti.firstTime = false;
                ti.value = '';
            }
            if (ti.value.length == 25) {
                ScratchAudio.sndFX('boing.wav');
            }
        }
    }

    static handleKeyRelease (e: KeyboardEvent) {
        var key = e.keyCode || e.which;
        var ti = e.target as PaintNameInput;
        if (key != 8) {
            return;
        }
        if (ti.firstTime) {
            ti.firstTime = false;
            ti.value = '';
        }
    }

    /////////////////////////////////
    //Left Palette
    /////////////////////////////////

    static leftPalette (div: HTMLElement) {
        var leftpal = newHTML('div', 'side up', div);
        var pal = newHTML('div', 'paintpalette', leftpal);
        pal.setAttribute('id', 'paintpalette');
        Paint.setupEditPalette(pal);
        Paint.createSizeSelector(pal);
    }

    static setupEditPalette (pal: HTMLElement) {
        var section = newHTML('div', 'section', pal);
        section.setAttribute('id', 'painttools');
        var list = ['path', 'ellipse', 'rect', 'tri'];
        var i = 0;
        for (i = 0; i < list.length; i++) {
            var but = newHTML('div', 'element off', section);
            var icon = newHTML('div', 'tool ' + list[i] + ' off', but);
            icon.setAttribute('key', list[i]);
            icon.onmousedown = Paint.setMode;
        }
    }

    static createSizeSelector (pal: HTMLElement) {
        var section = newHTML('div', 'section space', pal);
        section.setAttribute('id', 'sizeSelector');
        for (var i = 0; i < pensizes.length; i++) {
            var ps = newHTML('div', 'pensizeholder', section);
            ps.key = i;
            ps.onmousedown = function (e) {  // eslint-disable-line no-loop-func
                e.preventDefault();
                e.stopPropagation();
                var n = Number((this as HTMLElement).key);
                strokewidth = pensizes[Number((this as HTMLElement).key)];
                Paint.selectPenSize(n);
            };
            var c = newHTML('div', 'line t' + i, ps);
            Paint.drawPenSizeInColor(c);
        }
        strokewidth = pensizes[1];
        Paint.selectPenSize(1);
    }

    ////////////////////////////////////////
    // Pen sizes
    ////////////////////////////////////////


    static drawPenSizeInColor (c: HTMLElement) {
        c.style.background = fillcolor;
    }

    static updateStrokes () {
        var div = gn('sizeSelector')!;
        if (!div) {
            return;
        }
        for (var i = 0; i < div.childElementCount; i++) {
            var elem = div.childNodes[i];
            Paint.drawPenSizeInColor(elem.childNodes[0] as HTMLElement);
        }
    }

    static selectPenSize (str: number) {
        var p = gn('sizeSelector')!;
        for (var i = 0; i < p.childElementCount; i++) {
            var elem = p.childNodes[i];
            if ((elem as HTMLElement).key == str) {
                (elem as HTMLElement).setAttribute('class', 'pensizeholder on');
            } else {
                (elem as HTMLElement).setAttribute('class', 'pensizeholder off');
            }
        }
    }

    /////////////////////////////////
    //Right Palette
    /////////////////////////////////

    static rightPalette (div: HTMLElement) {
        var rightpal = newHTML('div', 'side', div);
        Paint.addSidePalette(rightpal, 'selectortools', ['select', 'rotate']);
        Paint.addSidePalette(rightpal, 'edittools', ['stamper', 'scissors']);
        Paint.addSidePalette(rightpal, 'filltools', (iOS.camera == '1' && Camera.available) ? ['camera', 'paintbucket'] : ['paintbucket']);
    }

    static addSidePalette (p: HTMLElement, id: string, list: string[]) {
        var pal = newHTML('div', 'paintpalette short', p);
        pal.setAttribute('id', id);
        for (var i = 0; i < list.length; i++) {
            var but = newHTML('div', 'element off', pal);
            var icon = newHTML('div', 'tool ' + list[i] + ' off', but);
            icon.setAttribute('key', list[i]);
            icon.onmousedown = Paint.setMode;
        }
    }

    static cameraToolsOn () {
        gn('backdrop')!.setAttribute('class', 'modal-backdrop fade dark');
        setProps(gn('backdrop')!.style, {
            display: 'block'
        });
        var topbar = newHTML('div', 'phototopbar', gn('backdrop')!);
        topbar.setAttribute('id', 'photocontrols');
        //  var actions = newHTML("div",'actions', topbar);
        //  var buttons = newHTML('div', 'photobuttons', actions);
        var fc = newHTML('div', 'flipcamera', topbar);
        fc.setAttribute('id', 'cameraflip');
        fc.setAttribute('key', 'cameraflip');
        if (isAndroid && !AndroidInterface.scratchjr_has_multiple_cameras()) {
            fc.style.display = 'none';
        }

        fc.onmousedown = Paint.setMode;
        var captureContainer = newHTML('div', 'snapshot-container', gn('backdrop')!);
        captureContainer.setAttribute('id', 'capture-container');
        var capture = newHTML('div', 'snapshot', captureContainer);
        capture.setAttribute('id', 'capture');
        capture.setAttribute('key', 'camerasnap');
        capture.onmousedown = Paint.setMode;
        var cc = newHTML('div', 'cameraclose', topbar);
        cc.setAttribute('id', 'cameraclose');
        cc.onmousedown = Paint.closeCameraMode;
    }

    static closeCameraMode () {
        ScratchAudio.sndFX('exittap.wav');
        Camera.close();
        Paint.selectButton('select');
    }

    static cameraToolsOff () {
        gn('backdrop')!.setAttribute('class', 'modal-backdrop fade');
        setProps(gn('backdrop')!.style, {
            display: 'none'
        });
        if (gn('photocontrols')!) {
            gn('photocontrols')!.parentNode!.removeChild(gn('photocontrols')!);
        }
        if (gn('capture')!) {
            var captureContainer = gn('capture')!.parentNode!;
            var captureContainerParent = captureContainer.parentNode!;
            captureContainer.removeChild(gn('capture')!);
            captureContainerParent.removeChild(gn('capture-container')!);
        }
    }

    //////////////////////////////////
    // canvas Area
    //////////////////////////////////


    static setUpCanvasArea () {
        var workspace = gn('workspacebkg')!;
        var dx = Math.floor((workspace.offsetWidth - workspaceWidth) / 2);
        var dy = Math.floor((workspace.offsetHeight - workspaceHeight) / 2);
        var w = workspaceWidth;
        var h = workspaceHeight;

        var div = gn('maincanvas')!;
        div.style.background = '#F5F2F7';
        div.style.top = '0px';
        div.style.left = '0px';

        div.style.width = w + 'px';
        div.style.height = h + 'px';
        div.cx = div.offsetWidth / 2;
        div.cy = div.offsetHeight / 2;
        div.dx = dx;
        div.dy = dy;

        root.setAttributeNS(null, 'width', String(w));
        root.setAttributeNS(null, 'height', String(h));
        Paint.drawGrid(w, h);
        PaintAction.clearEvents();
    }

    /////////////////////////////////
    //Color Palette
    /////////////////////////////////

    static colorPalette (div: HTMLElement) {
        var swatchlist = Paint.initSwatchList();
        var spalContainer = newHTML('div', 'swatchpalette-container', div);
        var spal = newHTML('div', 'swatchpalette', spalContainer);
        spal.setAttribute('id', 'swatches');
        for (var i = 0; i < swatchlist.length; i++) {
            var colour = newHTML('div', 'swatchbucket', spal);
            // bucket
            var sf = newHTML('div', 'swatchframe', colour);
            var sc = newHTML('div', 'swatchcolor', sf);
            sc.style.background = swatchlist[i];
            //
            sf = newHTML('div', 'splasharea off', colour);
            Paint.setSplashColor(sf, splash, swatchlist[i]);
            Paint.addImageUrl(sf, splashshade);
            colour.onmousedown = Paint.selectSwatch;
        }
        Paint.setSwatchColor(gn('swatches')!.childNodes[swatchlist.indexOf('#1C1C1C')] as HTMLElement);
    }

    static setSplashColor (p: HTMLElement, str: string | null, color: string) {
        var dataurl = 'data:image/svg+xml;base64,' + btoa(str!.replace(/#662D91/g, color));
        Paint.addImageUrl(p, dataurl);
    }

    static addImageUrl (p: HTMLElement, url: string | null) {
        var img = document.createElement('img');
        img.src = url!;
        img.style.position = 'absolute';
        p.appendChild(img);
    }

    static selectSwatch (e: Event) {
        var te = e as TouchEvent;
        if (te.touches && (te.touches.length > 1)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (Camera.active) {
            return;
        }
        var t: HTMLElement | null;
        if (window.event) {
            t = window.event.srcElement as HTMLElement;
        } else {
            t = e.target as HTMLElement;
        }
        var b = 'swatchbucket' != t!.className;
        while (b) {
            t = t!.parentNode as HTMLElement | null;
            b = !!t && ('swatchbucket' != t.className);
        }
        if (!t) {
            return;
        }
        ScratchAudio.sndFX('splash.wav');
        Paint.setSwatchColor(t);
    }

    static setSwatchColor (t: HTMLElement | null) {
        var tools = ['select', 'wand', 'stamper', 'scissors', 'rotate'];
        if (t && (tools.indexOf(mode) > -1)) {
            Paint.selectButton('paintbucket');
        }
        var c = (t!.childNodes[0].childNodes[0] as HTMLElement).style.backgroundColor;
        for (var i = 0; i < gn('swatches')!.childElementCount; i++) {
            const swatchNode = gn('swatches')!.childNodes[i] as HTMLElement;
            const swatchColor = swatchNode.childNodes[0].childNodes[0] as HTMLElement;
            var mycolor = swatchColor.style.backgroundColor;
            if (c == mycolor) {
                (swatchNode.childNodes[1] as HTMLElement).setAttribute('class', 'splasharea on');
            } else {
                (swatchNode.childNodes[1] as HTMLElement).setAttribute('class', 'splasharea off');
            }
        }
        fillcolor = c;
        Path.quitEditMode();
        Paint.updateStrokes();
    }

    static initSwatchList () {
        return [
            //	"#FF5500", // new orange
            '#FFD2F2', '#FF99D6', '#FF4583', // red pinks
            '#C30001', '#FF0023', '#FF8300', '#FFB200',
            '#FFF42E',
            '#FFF9C2', // pale yellow
            '#E2FFBD', //  pale green
            '#CFF500', // lime green
            '#50D823', // problematic
            //          "#2BFC49", // less problematic
            '#29C130',
            //          "#56C43B",  // ERROR?
            '#2BBF8A', // new green
            '#027607', '#114D24', //greens
            '#FFFFFF', '#CCDDE7', '#61787C', '#1C1C1C', // grays
            '#D830A3', // sarah's pink shoes border
            '#FF64E9', // purple pinks
            '#D999FF', ' #A159D3', // vilote
            '#722696', // sarah's violet
            '#141463', '#003399', '#1D40ED',
            '#0079D3', '#009EFF', '#76C8FF',
            '#ACE0FD', '#11B7BC', '#21F9F3', '#C3FCFC', '#54311E',
            '#8E572A', '#E4B69D', '#FFCDA4', '#FFEDD7' // skin colors

        ];
    }

    /////////////////////////////////////////////////
    //  Setup SVG Editor
    ////////////////////////////////////////////////


    static createSVGeditor (container: HTMLElement) {
        var div = newHTML('div', 'maincanvas', container);
        div.setAttribute('id', 'maincanvas');
        div.style.background = '#F5F2F7';
        div.style.top = '0px';
        div.style.left = '0px';
        window.onmousemove = null;
        window.onmouseup = null;
        root = SVGTools.create(div as Element) as SVGSVGElement;
        root.setAttribute('class', 'active3d');
        window.xform = Transform.getTranslateTransform();
        window.selxform = Transform.getTranslateTransform();
        var layer = SVGTools.createGroup(root, 'layer1');
        layer.setAttribute('style', 'pointer-events:visiblePainted');
        SVGTools.createGroup(root, 'draglayer');
        SVGTools.createGroup(root, 'paintgrid');
        gn('paintgrid')!.setAttribute('opacity', '0.5');
    }

    static clearWorkspace () {
        var fcn = function (div: HTMLElement) {
            while (div.childElementCount > 0) {
                div.removeChild(div.childNodes[0]);
            }
        };
        fcn(gn('layer1')!);
        fcn(gn('paintgrid')!);
        fcn(gn('draglayer')!);
        Path.quitEditMode();
    }

    static drawGrid (w: number, h: number) {
        var attr, path;
        if (!isBkg) {
            attr = {
                'd': Paint.getGridPath(w, h, 12),
                'id': getIdFor('gridpath'),
                'opacity': 1,
                'stroke': '#dcddde',
                'fill': 'none',
                'stroke-width': 0.5
            };
            path = SVGTools.addChild(gn('paintgrid')! as Element, 'path', attr);
            path.setAttribute('style', 'pointer-events:none;');
        }
        attr = {
            'd': Paint.getGridPath(w, h, isBkg ? 24 : 48),
            'id': getIdFor('gridpath'),
            'opacity': 1,
            'stroke': '#c1c2c3',
            'fill': 'none',
            'stroke-width': 0.5
        };
        path = SVGTools.addChild(gn('paintgrid')! as Element, 'path', attr);
        path.setAttribute('style', 'pointer-events:none;');
    }

    static getGridPath (w: number, h: number, gridsize: number) {
        var str = '';
        var dx = gridsize;
        // vertical
        var cmd;
        for (let i = 0; i < w / gridsize; i++) {
            cmd = 'M' + dx + ',' + 0 + 'L' + dx + ',' + h;
            str += cmd;
            dx += gridsize;
        }
        var dy = gridsize;
        // horizontal
        for (let i = 0; i < h / gridsize; i++) {
            cmd = 'M' + 0 + ',' + dy + 'L' + w + ',' + dy;
            str += cmd;
            dy += gridsize;
        }
        return str;
    }


    // Originally PaintIO.js
    ///////////////////////////
    // Loading and saving
    //////////////////////////

    static initBkg (ow: number, oh: number) {
        nativeJr = true;
        workspaceWidth = ow;
        workspaceHeight = oh;
        Paint.setUpCanvasArea();
        var dh = (root.parentNode!.parentNode as HTMLElement).offsetHeight / (workspaceHeight + 10);
        var dw = (root.parentNode!.parentNode as HTMLElement).offsetWidth / (workspaceWidth + 10);
        Paint.setZoomTo(Math.min(dw, dh));
        (document.forms as unknown as { spriteform: HTMLFormElement }).spriteform.style.visibility = 'hidden';
        if (currentMd5) {
            Paint.loadBackground(currentMd5);
        } else {
            var attr = {
                'id': 'staticbkg',
                'opacity': 1,
                'fixed': 'yes',
                fill: ScratchJr.stagecolor
            };
            var cmds = [['M', 0, 0], ['L', 480, 0], ['L', 480, 360], ['L', 0, 360], ['L', 0, 0]];
            (attr as Record<string, unknown>).d = SVG2Canvas.arrayToString(cmds);
            SVGTools.addChild(gn('layer1')! as Element, 'path', attr);
            Ghost.drawOffscreen();
            PaintUndo.record(true);
        }
    }

    static loadBackground (md5: string) {
        if (md5.indexOf('samples/') >= 0) {
            // Load sample asset
            Paint.loadChar(md5);
        } else if (!(MediaLib.keys as Record<string, unknown>)[md5]) {
            // Load user asset
            iOS.getmedia(md5, nextStep);
        } else {
            // Load library asset
            Paint.getBkg(MediaLib.path + md5);
        }
        function nextStep (base64: string) {
            var str = atob(base64);
            IO.getImagesInSVG(str, function () {
                Paint.loadBkg(str);
            });
        }
    }

    static getBkg (url: string) {
        var xmlrequest = new XMLHttpRequest();
        xmlrequest.onreadystatechange = function () {
            if (xmlrequest.readyState == 4) {
                Paint.createBkgFromXML(xmlrequest.responseText);
            }
        };
        xmlrequest.open('GET', url, true);
        xmlrequest.send(null);
    }

    static loadBkg (str: string) {
        Paint.createBkgFromXML(str);
    }

    static createBkgFromXML (str: string) {
        nativeJr = str.indexOf('Scratch Jr') > -1;
        str = str.replace(/>\s*</g, '><');
        var xmlDoc = new DOMParser().parseFromString(str, 'text/xml');
        var extxml = document.importNode(xmlDoc.documentElement, true);
        var flat = Paint.skipUnwantedElements(extxml as Element, []);
        for (var i = 0; i < flat.length; i++) {
            gn('layer1')!.appendChild(flat[i]);
            if (flat[i].getAttribute('id') == 'fixed') {
                flat[i].setAttribute('fixed', 'yes');
            }
            flat[i].setAttribute('file', 'yes');
        }
        Paint.doAbsolute(gn('layer1')! as Element);
        if (!nativeJr) {
            Paint.reassingIds(gn('layer1')! as Element);
        } // make sure there are unique mask names
        //	gn("layer1").childNodes[0].setAttribute('id', "staticbkg");
        var dh = (root.parentNode!.parentNode as HTMLElement).offsetHeight / (workspaceHeight + 10);
        var dw = (root.parentNode!.parentNode as HTMLElement).offsetWidth / (workspaceWidth + 10);
        Paint.setZoomTo(Math.min(dw, dh));
        PaintUndo.record(true);
        if (!nativeJr) {
            Paint.selectButton('paintbucket');
        }
    }

    static initSprite (ow?: number, oh?: number) {
        nativeJr = true;
        namedForms.spriteform.style.visibility = 'visible';
        namedForms.spriteform.name.value = gn(currentName!)! ? (gn(currentName!)!.owner as Sprite).name : currentName!;
        if (ow) {
            workspaceWidth = ow;
        }
        if (oh) {
            workspaceHeight = oh;
        }
        if (currentMd5) {
            Paint.loadCharacter(currentMd5);
        } else {
            Paint.setUpCanvasArea();
            setCanvasSize(
                Ghost.maskCanvas,
                Math.round(Number(root.getAttribute('width')) * currentZoom),
                Math.round(Number(root.getAttribute('height')) * currentZoom)
            );
            var dh = (root.parentNode!.parentNode as HTMLElement).offsetHeight / (workspaceHeight + 10);
            var dw = (root.parentNode!.parentNode as HTMLElement).offsetWidth / (workspaceWidth + 10);
            Paint.setZoomTo(Math.min(dw, dh));
            PaintUndo.record(true);
        }
    }

    static loadCharacter (md5: string) {
        if (md5.indexOf('samples/') >= 0) {
            // Load sample asset
            Paint.loadChar(md5);
        } else if (!(MediaLib.keys as Record<string, unknown>)[md5]) {
            // Load user asset
            iOS.getmedia(md5, nextStep);
        } else {
            // Load library asset
            Paint.loadChar(MediaLib.path + md5);
        }
        function nextStep (base64: string) {
            var str = atob(base64);
            IO.getImagesInSVG(str, function () {
                Paint.loadSprite(str);
            });
        }
    }

    static loadSprite (svg: string) {
        Paint.createCharFromXML(svg, currentName);
    }

    static loadChar (url: string) {
        var xmlrequest = new XMLHttpRequest();
        xmlrequest.onreadystatechange = function () {
            if (xmlrequest.readyState == 4) {
                Paint.createCharFromXML(xmlrequest.responseText, currentName);
            }
        };
        xmlrequest.open('GET', url, true);
        xmlrequest.send(null);
    }

    static adjustShapePosition (dx: number, dy: number) {
        window.xform!.setTranslate(dx, dy);
        Transform.translateTo(gn('layer1')! as Element, window.xform!);
    }

    ///////////////////////////////////
    // Saving
    /////////////////////////////////

    static savePageImage (fcn?: (result: unknown) => void) {
        var worthsaving = (gn('layer1')!.childElementCount > 0);
        if (!worthsaving) {
            Paint.close();
        } else {
            saving = true;
            if (fcn) {
                Alert.open(paintFrame!, gn('donecheck')!, Localization.localize('ALERT_SAVING'), '#28A5DA');
                Alert.balloon!.style.zIndex = String(12000);
            }
            svgdata = SVGTools.saveBackground(gn('layer1')! as Element, workspaceWidth, workspaceHeight);
            IO.setMedia(svgdata, 'svg', function (str: string) {
                Paint.changeBackground(str, fcn);
            });
        }
    }

    static changeBackground (md5: string, fcn?: (result: unknown) => void) {
        saveMD5 = md5;
        var type = 'userbkgs';
        var mobj: SqlPayload = {};
        mobj.cond = 'md5 = ? AND version = ?';
        mobj.items = ['*'];
        mobj.values = [saveMD5, ScratchJr.version];
        IO.query(type, mobj, function (str: string) {
            Paint.checkDuplicateBkg(str, fcn);
        });
    }

    static checkDuplicateBkg (str: string, fcn?: (result: unknown) => void) {
        var list = JSON.parse(str);
        if (list.length > 0) {
            if (fcn) {
                fcn('duplicate');
            }
        } else {
            Paint.addToBkgLib(fcn);
        }
    }

    /////////////////////////////////////
    // userbkgs:  stores backgrounds
    /////////////////////////////////////
    /*
        [version] =>
        [md5] =>
        [altmd5] =>  //for PNG option
        [ext] => png / svg
       	[width] =>
       	[height] =>
    */

    static addToBkgLib (fcn?: (result: unknown) => void) {
        var dataurl = IO.getThumbnail(svgdata!, 480, 360, 120, 90);
        var pngBase64 = dataurl.split(',')[1];
        iOS.setmedia(pngBase64, 'png', setBkgRecord);
        function setBkgRecord (pngmd5: string) {
            var json: SqlPayload = {};
            var keylist = ['md5', 'altmd5', 'version', 'width', 'height', 'ext'];
            var values = '?,?,?,?,?,?';
            json.values = [saveMD5, pngmd5, ScratchJr.version, '480', '360', 'svg'];
            json.stmt = 'insert into userbkgs (' + keylist.toString() + ') values (' + values + ')';
            iOS.stmt(json, fcn);
        }
    }

    static changePage () {
        ScratchJr.stage.currentPage.setBackground(saveMD5!, ScratchJr.stage.currentPage.updateBkg);
        Paint.close();
    }

    static saveSprite (fcn?: (result: unknown) => void) {
        var cname = namedForms.spriteform.name.value;
        var worthsaving = (gn('layer1')!.childElementCount > 0) && (PaintUndo.index > 0);
        if (worthsaving) {
            saving = true;
            if (fcn) {
                Alert.open(paintFrame!, gn('donecheck')!, 'Saving...', '#28A5DA');
                Alert.balloon!.style.zIndex = String(12000);
            }
            svgdata = SVGTools.saveShape(gn('layer1')! as Element, workspaceWidth, workspaceHeight);
            IO.setMedia(svgdata, 'svg', function (str: string) {
                Paint.addOrModifySprite(str, fcn);
            });
        } else {
            var type = Paint.getLoadType(spriteId, cname);
            if ((cname != currentName) && (type == 'modify')) {
                ScratchJr.stage.currentPage.modifySpriteName(cname, spriteId!);
            } else if (currentMd5 && (type == 'add')) {
                ScratchJr.stage.currentPage.addSprite(costumeScale as number, currentMd5, cname);
            }
            Paint.close();
        }
    }

    static addOrModifySprite (str: string, fcn?: (result: unknown) => void) {
        saveMD5 = str;
        var mobj: SqlPayload = {};
        mobj.cond = 'md5 = ? AND version = ?';
        mobj.items = ['*'];
        mobj.values = [saveMD5, ScratchJr.version];
        IO.query('usershapes', mobj, function (str: string) {
            Paint.checkDuplicate(str, fcn);
        });
    }

    static checkDuplicate (str: string, fcn?: (result: unknown) => void) {
        var list = JSON.parse(str);
        if (list.length > 0) {
            if (fcn) {
                fcn('duplicate');
            }
        } else {
            Paint.addToLib(fcn);
        }
    }

    /////////////////////////////////////
    // usershapes:  stores costumes
    /////////////////////////////////////
    /* current data
        [md5] =>
        [altmd5] =>  // for PNG  -- not used
        [version] =>
    		[scale] =>
        [ext] => png / svg
       	[width] =>
       	[height] =>
        [name] =>

    */

    static addToLib (fcn?: (result: unknown) => void) {
        var scale = '0.5'; // always saves with 1/2 the size
        var cname = namedForms.spriteform.name.value;
        cname = ((unescape(cname)).replace(/[0-9]/g, '')).replace(/\s*/g, '');
        var box = SVGTools.getBox(gn('layer1')! as Element).rounded();
        box = box.expandBy(20);
        var w = box.width.toString();
        var h = box.height.toString();
        var dataurl = IO.getThumbnail(svgdata!, w, h, 120, 90);
        var pngBase64 = dataurl.split(',')[1];
        iOS.setmedia(pngBase64, 'png', setCostumeRecord);
        function setCostumeRecord (pngmd5: string) {
            var json: SqlPayload = {};
            var keylist = ['scale', 'md5', 'altmd5', 'version', 'width', 'height', 'ext', 'name'];
            var values = '?,?,?,?,?,?,?,?';
            json.values = [scale, saveMD5, pngmd5, ScratchJr.version, w, h, 'svg', cname];
            json.stmt = 'insert into usershapes (' + keylist.toString() + ') values (' + values + ')';
            iOS.stmt(json, fcn);
        }
    }

    static changePageSprite () {
        Paint.close();
        var cname = namedForms.spriteform.name.value;
        var type = Paint.getLoadType(spriteId, cname);
        switch (type) {
        case 'modify':
            ScratchJr.stage.currentPage.modifySprite(saveMD5!, cname, spriteId!);
            break;
        case 'add':
            ScratchJr.stage.currentPage.addSprite(costumeScale as number, saveMD5!, cname);
            break;
        default:
            ScratchJr.stage.currentPage.update();
            break;
        }
    }

    static getLoadType (sid: string | null | undefined, cid: string | null | undefined) {
        if (!cid) {
            return 'none';
        }
        if (sid && cid) {
            return 'modify';
        }
        return 'add';
    }

    ///////////////////////////
    // XML import processs
    ///////////////////////////

    static skipUnwantedElements (p: Element, res: Element[]) {
        for (var i = 0; i < p.childNodes.length; i++) {
            var elem = p.childNodes[i] as Element;
            if (elem.nodeName == 'metadata') {
                continue;
            }
            if (elem.nodeName == 'defs') {
                continue;
            }
            if (elem.nodeName == 'sodipodi:namedview') {
                continue;
            }
            if (elem.nodeName == '#comment') {
                continue;
            }
            if ((elem.nodeName == 'g') && (elem.id == 'layer1')) {
                Paint.skipUnwantedElements(elem, res);
                if (elem.removeAttribute('id') as unknown) {
                    elem.removeAttribute('id');
                }
            } else {
                res.push(elem);
            }
        }
        return res;
    }

    static reassingIds (p: Element) {
        for (var i = 0; i < p.childNodes.length; i++) {
            var elem = p.childNodes[i] as Element;
            if ((elem.parentNode as Element).getAttribute('fixed') == 'yes') {
                elem.setAttribute('fixed', 'yes');
            }
            var id = elem.getAttribute('id');
            if (!id) {
                elem.setAttribute('id', getIdFor(elem.nodeName));
            }
            if (elem.nodeName == 'g') {
                Paint.reassingIds(elem);
            }
        }
    }

    static createCharFromXML (str: string, fcn?: string) {
        nativeJr = str.indexOf('Scratch Jr') > -1;
        var dx = (workspaceWidth < 432) ? Math.floor((432 - workspaceWidth) / 2) : 0;
        var dy = (workspaceHeight < 384) ? Math.floor((384 - workspaceHeight) / 2) : 0;
        if (workspaceWidth < 432) {
            workspaceWidth = 432;
        }
        if (workspaceHeight < 384) {
            workspaceHeight = 384;
        }
        Paint.setUpCanvasArea();
        str = str.replace(/>\s*</g, '><');
        var xmlDoc = new DOMParser().parseFromString(str, 'text/xml');
        var extxml = document.importNode(xmlDoc.documentElement, true);
        var flat = Paint.skipUnwantedElements(extxml as Element, []);
        for (var i = 0; i < flat.length; i++) {
            gn('layer1')!.appendChild(flat[i]);
        }
        Paint.doAbsolute(gn('layer1')! as Element);
        Paint.adjustShapePosition(dx, dy);
        if (!nativeJr) {
            Paint.reassingIds(gn('layer1')! as Element);
        } // make sure there are unique mask names
        Paint.scaleToFit();
        minZoom = currentZoom < 1 ? currentZoom / 2 : 1;
        var maxpix = 2290 * 2289; // Magic iOS max canvas size
        var ratio = maxpix / (workspaceWidth * workspaceHeight);
        var zoom = Math.floor(Math.sqrt(ratio));
        if (zoom < maxZoom) {
            maxZoom = zoom;
        }
        PaintUndo.record(true);
        if (!nativeJr) {
            Paint.selectButton('paintbucket');
        }
    }

    static doAbsolute (div: Element) {
        for (var i = 0; i < div.childElementCount; i++) {
            var elem = div.childNodes[i] as Element;
            if (elem.tagName == 'path') {
                SVG2Canvas.setAbsolutePath(elem);
            }
            if (elem.tagName == 'g') {
                Paint.doAbsolute(elem);
            }
        }
    }

    static getComponents (p: Element, res: Element[]) {
        for (var i = 0; i < p.childNodes.length; i++) {
            var elem = p.childNodes[i] as Element;
            if (elem.nodeName == 'metadata') {
                continue;
            }
            if (elem.nodeName == 'defs') {
                continue;
            }
            if (elem.nodeName == 'sodipodi:namedview') {
                continue;
            }
            if (elem.nodeName == '#comment') {
                continue;
            }
            if (elem.nodeName == 'g') {
                Paint.getComponents(elem, res);
                if (elem.getAttribute('id')) {
                    elem.removeAttribute('id');
                }
            } else {
                res.push(elem);
            }
        }
        return res;
    }
}
