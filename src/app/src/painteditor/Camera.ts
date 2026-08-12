import ScratchJr from '../editor/ScratchJr';
import iOS from '../iPad/iOS';
import ScratchAudio from '../utils/ScratchAudio';
import Paint from './Paint';
import PaintUndo from './PaintUndo';
import SVGImage from './SVGImage';
import SVGTools from './SVGTools';
import SVG2Canvas from '../utils/SVG2Canvas';
import Rectangle from '../geom/Rectangle';
import Layer from './Layer';
import Ghost from './Ghost';
import {gn, globalx, globaly, DEGTOR, setCanvasSize, isAndroid} from '../utils/lib';

let view = 'front';
let target: Element | null = null;
let available = false;

export default class Camera {
    static active: boolean;
    static flip: unknown;

    static get available () {
        return available;
    }

    static set available (newAvailable) {
        available = newAvailable;
    }

    static startFeed (feedTarget: Element) {
        ScratchAudio.sndFX('entertap.wav');
        if (!Paint.canvasFits()) {
            Paint.scaleToFit();
        }
        target = feedTarget;
        Camera.active = true;
        var devicePixelRatio = window.devicePixelRatio;
        var viewbox = SVGTools.getBox(target).rounded();
        var box = new Rectangle(0, 0, Paint.workspaceWidth, Paint.workspaceHeight);
        viewbox = viewbox.expandBy(20);
        viewbox.crop(box);
        var mask = Camera.getLayerMask(target);
        var data: Record<string, unknown> = {};
        var x = Math.floor((viewbox.x + (viewbox.width / 2)) * Paint.currentZoom - (viewbox.width / 2));
        var y = Math.floor((viewbox.y + (viewbox.height / 2)) * Paint.currentZoom - (viewbox.height / 2));
        data.x = globalx(gn('workspacebkg')!) + x + gn('maincanvas')!.dx!
            + gn('maincanvas')!.cx! - gn('maincanvas')!.cx! * Paint.currentZoom;
        data.y = globaly(gn('workspacebkg')!) + y + gn('maincanvas')!.dy!
            + gn('maincanvas')!.cy! - gn('maincanvas')!.cy! * Paint.currentZoom;
        data.width = viewbox.width;
        data.height = viewbox.height;
        data.scale = Paint.currentZoom;
        data.devicePixelRatio = devicePixelRatio;
        data.mx = globalx(gn('workspacebkg')!) + gn('maincanvas')!.dx!;
        data.my = globaly(gn('workspacebkg')!) + gn('maincanvas')!.dy!;
        data.mw = Paint.workspaceWidth;
        data.mh = Paint.workspaceHeight;
        data.image = mask.toDataURL('image/png');
        iOS.startfeed(data, iOS.trace);
        Paint.cameraToolsOn();
    }

    static prepareForLandscapeMode (cnv: HTMLCanvasElement) {
        var result = document.createElement('canvas');
        setCanvasSize(result, cnv.height, cnv.width);
        var finalctx = result.getContext('2d')!;
        var min = Math.min(cnv.width, cnv.height);
        var max = Math.max(cnv.width, cnv.height);
        var delta = (max - min) / 2;
        var pt = {
            x: (cnv.width / 2),
            y: (cnv.height / 2)
        };
        finalctx.translate(pt.x, pt.y);
        finalctx.rotate(90 * DEGTOR);
        finalctx.translate(-pt.x, -pt.y);
        finalctx.drawImage(cnv, delta, delta);
        return result;
    }

    static doAction (str: string) {
        switch (str) {
        case 'cameraflip':
            ScratchAudio.sndFX('tap.wav');
            view = (view == 'front') ? 'back' : 'front';
            iOS.choosecamera(view, Camera.flip);
            break;
        case 'camerasnap':
            Camera.snapShot();
            Paint.cameraToolsOff();
            break;
        case 'cammera':
            Camera.close();
            Paint.selectButton('select');
            break;
        default:
            Camera.close();
            Paint.selectButton(str);
            break;
        }
    }

    static close () {
        target = null;
        view = 'front';
        Camera.active = false;
        iOS.stopfeed();
        Paint.cameraToolsOff();
        if (isAndroid) {
            ScratchJr.onBackButtonCallback.pop();
        }
    }

    static snapShot () {
        iOS.captureimage('Camera.processimage'); // javascript call back;
    }

    static getLayerMask (elem: Element) {
        // draw background
        var w, h;
        if (isAndroid) {
            var mainCanvas = gn('maincanvas')!;
            var mainCanvasRect = mainCanvas.getBoundingClientRect();
            w = mainCanvasRect.width;
            h = mainCanvasRect.height;
        } else {
            w = Paint.workspaceWidth;
            h = Paint.workspaceHeight;
        }
        var cnv = document.createElement('canvas');
        setCanvasSize(cnv, w, h);
        var ctx = cnv.getContext('2d')!;
        ctx.fillStyle = ScratchJr.stagecolor;
        ctx.fillRect(0, 0, cnv.width, cnv.height);
        if (isAndroid) {
            ctx.save();
            ctx.scale(Paint.currentZoom, Paint.currentZoom);
        }
        SVG2Canvas.drawImage(gn('paintgrid')! as Element, ctx);

        var isgroup = (elem.parentNode && ((elem.parentNode as Element).id != 'layer1'));
        var index = (isgroup ? Layer.groupStartsAt(gn('layer1')! as Element, elem.parentNode as Element)
            : Layer.groupStartsAt(gn('layer1')! as Element, elem));
        Camera.drawLayers(gn('layer1')! as Element, ctx, 0, index);
        let localindex: number = 0;

        if (isgroup) {
            localindex = Layer.groupStartsAt(elem.parentNode as Element, elem);
            Camera.drawLayers(elem.parentNode as Element, ctx, 0, localindex);
        }
        Camera.drawHole(elem, ctx);
        if (isgroup) {
            Camera.drawLayers(elem.parentNode as Element, ctx, localindex + 1,
                (elem.parentNode as Element).childElementCount);
        }
        Camera.drawLayers(gn('layer1')! as Element, ctx, index + 1,
            (gn('layer1')! as Element).childElementCount);
        if (isAndroid) {
            ctx.restore();
        }
        return cnv;
    }

    static drawLayers (p: Element, ctx: CanvasRenderingContext2D, startat: number, endat: number) {
        var min = Math.min(startat, p.childElementCount);
        var max = Math.min(endat, p.childElementCount);
        for (var i = min; i < max; i++) {
            SVG2Canvas.drawLayer(p.childNodes[i] as Element, ctx, SVG2Canvas.drawLayer);
        }
    }

    static drawHole (elem: Element, ctx: CanvasRenderingContext2D) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        SVG2Canvas.drawElementHole(elem, ctx);
        ctx.restore();
        ctx.fillStyle = 'rgba(0, 0, 0,0)';
        ctx.strokeStyle = !elem.getAttribute('stroke') ? 'none' : elem.getAttribute('stroke')!;
        ctx.lineCap = (elem.getAttribute('stroke-linecap')
            ? elem.getAttribute('stroke-linecap')! : SVG2Canvas.strokevalues['stroke-linecap']) as CanvasLineCap;
        ctx.lineWidth = elem.getAttribute('stroke-width')
            ? Number(elem.getAttribute('stroke-width')) : Number(SVG2Canvas.strokevalues['stroke-width']);
        ctx.miterLimit = Number(elem.getAttribute('stroke-miterlimit')
            ? elem.getAttribute('stroke-miterlimit') : SVG2Canvas.strokevalues['stroke-miterlimit']);
        // legacy typo preserved: 'linejoin' is a no-op expando, rendering uses lineJoin
        (ctx as CanvasRenderingContext2D & { linejoin: string }).linejoin = elem.getAttribute('stroke-linejoin')
            ? elem.getAttribute('stroke-linejoin')! : SVG2Canvas.strokevalues['stroke-linejoin'];
        SVG2Canvas.processXMLnode(elem, ctx, true);
    }

    static processimage (str: string) {
        if (!target) {
            return;
        }
        if (str != 'error getting a still') {
            SVGImage.addCameraFill(target, str);
        }
        Camera.close();
        Paint.cameraToolsOff();
        Paint.selectButton('select');
        if (str != 'error getting a still') {
            PaintUndo.record();
            Ghost.drawOffscreen();
        }
    }
}

// Exposing the camera for the tablet callback in iOS.snapShot
window.Camera = Camera;
