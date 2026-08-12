import Snap from 'snapsvg';

import ScratchJr from '../editor/ScratchJr';
import SVGTools from './SVGTools';
import Paint from './Paint';
import PaintAction from './PaintAction';
import Layer from './Layer';
import Vector from '../geom/Vector';
import type {Point} from '../geom/Vector';
import Transform from './Transform';
import SVG2Canvas from '../utils/SVG2Canvas';
import {gn, setCanvasSize, newDiv} from '../utils/lib';

// Event handler shape used across the paint editor: both mouse and touch events
// reach these handlers, so only the members actually read are declared.
type PaintEvt = {
    touches?: TouchList;
    changedTouches?: TouchList;
    target?: EventTarget | null;
    shiftKey?: boolean;
    clientX?: number;
    clientY?: number;
    preventDefault(): void;
    stopPropagation(): void;
};

let maskCanvas = document.createElement('canvas');
let maskData: Record<string, string> = {};
let linemask = 16;
let maskColor = 16;

export default class Ghost {
    static get maskCanvas () {
        return maskCanvas;
    }

    static get maskData () {
        return maskData;
    }

    static set maskData (newMaskData) {
        maskData = newMaskData;
    }

    static get linemask () {
        return linemask;
    }

    static highlight (group: Element[]) {
        Ghost.clearLayer();
        var g = SVGTools.createGroup(gn('draglayer')! as Element, 'ghostgroup');
        g.setAttribute('class', 'active3d');
        for (var i = 0; i < group.length; i++) {
            Ghost.hightlightElem(g, group[i], 0.5, '5,5', 'black', 3);
        }
    }

    static hightlightElem (p: Element, elem: Element, opacity: number, space: string, c: string, sw: number) {
        if (elem.tagName == 'g') {
            for (var i = 0; i < elem.childElementCount; i++) {
                Ghost.hightlightElem(p, elem.childNodes[i] as Element, opacity, space, c, sw);
            }
        } else {
            if (Ghost.hasGhost(elem)) {
                Ghost.getKid(p, elem, opacity, space, c, sw);
            }
        }
    }

    static hasGhost (elem: Element) { // too slow if there are too many--> doing this to minimize overlapping ghosts
        if (!elem.id) {
            return true;
        }
        if (elem.id.indexOf('Border') < 0) {
            return true;
        }
        var mfill = elem.id.split('Border')[0];
        if (mfill == '') {
            return true;
        }
        return (!gn(mfill)!);
    }

    static clearLayer () {
        var p = gn('draglayer')!;
        if (!p) {
            return;
        }
        while (p.childElementCount > 0) {
            p.removeChild(p.childNodes[0]);
        }
    }

    ///////////////////////////////////
    // Ghost Management
    ///////////////////////////////////

    static findTarget (evt: PaintEvt | null) {
        Ghost.clearLayer();
        if (evt == null) {
            return null;
        }
        var pt = PaintAction.getScreenPt(evt);
        if (Ghost.outsideArea(Vector.floor(Vector.scale(pt, Paint.currentZoom)), maskCanvas)) {
            return null;
        } else {
            return Ghost.allTools(pt);
        }
    }

    static findWho (evt: PaintEvt | null) { // just gets the object clicked
        Ghost.clearLayer();
        if (evt == null) {
            return null;
        }
        var pt = PaintAction.getScreenPt(evt);
        var color = Ghost.getPtColor(pt);
        var id = maskData[color as string];
        var mt = (id && gn(id)!) ? gn(id)! as Element : null;
        return (mt && mt.getAttribute('fixed') != 'yes') ? mt : Ghost.getHitObject(pt);
    }

    static allTools (pt: Point) {
        var color = Ghost.getPtColor(pt);
        var id = maskData[color as string];
        if (id) {
            return Ghost.hitSomething(pt, id, color);
        } else {
            return Ghost.notHitted(pt);
        }
    }

    static hitSomething (pt: Point, id: string, color?: string | number) {
        var mt: Element | null = gn(id)! as Element;
        var dogohst = true;
        if (mt && mt.getAttribute('relatedto')) {
            mt = gn(mt.getAttribute('relatedto')!)! as Element;
        }
        switch (Paint.mode) {
        case 'select':
        case 'rotate':
        case 'stamper':
        case 'scissors':
        case 'path':
            if (mt.getAttribute('fixed') == 'yes') {
                mt = Ghost.getHitObject(pt, (Paint.mode as string) == 'path');
            }
            dogohst = mt ? (mt.getAttribute('fixed') != 'yes') : false;
            break;
        case 'paintbucket':
        case 'camera':
            mt = Ghost.getHitObject(pt, (Paint.mode as string) == 'path');
            break;
        }
        if (mt && dogohst) {
            return Ghost.setGhostTo(mt);
        }
        return null;
    }

    static svgHit (pt: Point) {
        var rpos = Paint.root.createSVGRect();
        rpos.x = pt.x;
        rpos.y = pt.y;
        rpos.width = 1;
        rpos.height = 1;

        var matches = Paint.root.getIntersectionList(rpos, null);
        if (matches !== null) {
            return matches;
        } else {
            // getIntersectionList() isn't implemented below API Level 19
            // and will return null.  Call the helper method to manually detect
            // the intersection lists.
            return Ghost.svgHitHelper(gn('layer1')! as Element, pt);
        }
    }

    /**
     * Iterates all the path elements of the root and checks if 'pt'
     * is inside the path.
     * This method uses the SnapSVG library (Apache 2 license) to perform the hit test.
     */
    static svgHitHelper (root: Element, pt: Point) {
        var matches: Element[] = [];
        if (!root) {
            return matches;
        }

        var paths = root.getElementsByTagName('path');
        for (var i = 0; i < paths.length; ++i) {
            var pathData = paths[i].getAttribute('d');
            if (pathData && Snap.path.isPointInside(pathData, pt.x, pt.y)) {
                matches.push(paths[i]);
            }
        }

        return matches;
    }


    static setGhostTo (mt: Element) {
        var g = SVGTools.createGroup(gn('draglayer')! as Element, 'ghostlayer');
        Ghost.setDashBorder(g, mt, 0.7, '5,5', 'black', 3);
        return mt;
    }

    static notHitted (pt: Point) {
        var mt;
        switch (Paint.mode) {
        case 'select':
        case 'rotate':
        case 'stamper':
        case 'scissors':
            mt = Ghost.getActualHit(Ghost.getHitObject(pt, (Paint.mode as string) != 'path'), pt);
            if (mt && mt.id) {
                if (mt.getAttribute('relatedto')) {
                    mt = gn(mt.getAttribute('relatedto')!)! as Element;
                }
                var isStencil = (
                    (mt.id.indexOf('staticbkg') > -1)
                    || (mt.getAttribute('stencil') == 'yes')
                    || (mt.getAttribute('fixed') == 'yes')
                );
                if (isStencil) {
                    mt = undefined;
                }
            }
            break;
        case 'camera':
        case 'paintbucket':
            var targ = Ghost.getHitObject(pt, false);
            var target = Ghost.getActualHit(targ, pt);
            if (target && target.nodeName != 'g') {
                mt = target;
            }
            break;
        }
        if (mt) {
            return Ghost.setGhostTo(mt);
        }
        return null;
    }

    static getActualHit (mt: Element | null, pt: Point, id?: string) {
        if (!mt) {
            return null;
        }
        pt = Vector.floor(Vector.scale(pt, Paint.currentZoom));
        var list = Layer.findUnderMe(mt);
        for (var i = 0; i < list.length; i++) {
            var obj = list[i];
            if (!Ghost.contains(mt, obj)) {
                continue;
            }
            if (!Ghost.hittedSingleObject(obj, pt)) {
                continue;
            }
            mt = obj;
        }
        return mt;
    }

    static contains (e1: Element, e2: Element) {
        var box1 = SVGTools.getBox(e1);
        var box2 = SVGTools.getBox(e2);
        var boxi = box1.intersection(box2);
        if (boxi.isEmpty()) {
            return false;
        }
        return boxi.isEqual(box2);
    }

    static hittedSingleObject (obj: Element, pt: Point) {
        var ctx = ScratchJr.workingCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, ScratchJr.workingCanvas.width, ScratchJr.workingCanvas.height);
        ctx.save();
        Layer.drawInContext(obj, ctx, Paint.currentZoom);
        ctx.restore();
        var pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
        return pixel[3] != 0;
    }

    static getPtColor (pt: Point) {
        pt = Vector.floor(Vector.scale(pt, Paint.currentZoom));
        if (Ghost.outsideArea(pt, maskCanvas)) {
            return 0;
        }
        var ctx = maskCanvas.getContext('2d')!;
        var pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
        var r = pixel[0];
        var g = pixel[1];
        var b = pixel[2];
        return Ghost.getHex([r, g, b]);
    }

    static outsideArea (node: Point, canvas: HTMLCanvasElement) {
        if ((node.x < 0) || (node.x > (canvas.width - 1))) {
            return true;
        }
        if ((node.y < 0) || (node.y > (canvas.height - 1))) {
            return true;
        }
        return false;
    }

    static setDashBorder (p: Element, elem: Element, opacity: number, space: string, c: string, sw: number) {
        if (elem.tagName == 'g') {
            for (var i = 0; i < elem.childElementCount; i++) {
                Ghost.setDashBorder(p, elem.childNodes[i] as Element, opacity, space, c, sw);
            }
        } else {
            Ghost.getKid(p, elem, opacity, space, c, sw);
        }
    }

    static getKid (p: Element, elem: Element, opacity?: number, space?: string, c?: string, sw?: number | string | null) {
        if (!sw) {
            sw = elem.getAttribute('stroke-width');
        }
        var attr = SVGTools.attributeTable[elem.tagName];
        if (!attr) {
            attr = [];
        }
        var drawattr = SVGTools.attributePenTable[elem.tagName];
        if (!drawattr) {
            drawattr = [];
        }
        // black outline
        var shape = document.createElementNS(Paint.xmlns, elem.tagName);
        p.appendChild(shape);

        attr = attr.concat(drawattr);
        for (var i = 0; i < attr.length; i++) {
            if (elem.getAttribute(attr[i]) == null) {
                continue;
            }
            shape.setAttribute(attr[i], elem.getAttribute(attr[i])!);
        }
        shape.setAttribute('fill', 'none');
        shape.setAttribute('stroke', c!);
        shape.setAttribute('stroke-width', String(Number(sw) / Paint.currentZoom));
        shape.setAttribute('class', 'active3d');
        var ang = Transform.getRotationAngle(elem);
        if (ang != 0) {
            Transform.applyRotation(shape, ang);
        }
        if (opacity) {
            shape.setAttribute('opacity', String(opacity));
        }
        // white dashed

        var dash = document.createElementNS(Paint.xmlns, elem.tagName);
        p.appendChild(dash);
        attr = attr.concat(drawattr);
        for (var j = 0; j < attr.length; j++) {
            if (elem.getAttribute(attr[j]) == null) {
                continue;
            }
            dash.setAttribute(attr[j], elem.getAttribute(attr[j])!);
        }
        dash.setAttribute('fill', 'none');
        dash.setAttribute('stroke', 'white');
        dash.setAttribute('stroke-width', String(3 / Paint.currentZoom));
        dash.setAttribute('stroke-dasharray', space!);
        dash.setAttribute('class', 'active3d');
        if (opacity) {
            dash.setAttribute('opacity', String(opacity));
        }
        if (ang != 0) {
            Transform.applyRotation(dash, ang);
        }
        return dash;
    }

    //////////////////////////////////////////////////
    //   Offscreen for cursor
    //////////////////////////////////////////////////

    static drawOffscreen () {
        setCanvasSize(
            maskCanvas,
            Math.round(Number(Paint.root.getAttribute('width')) * Paint.currentZoom),
            Math.round(Number(Paint.root.getAttribute('height')) * Paint.currentZoom)
        );
        var ctx = maskCanvas.getContext('2d')!;
        ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        var p = gn('layer1')!;
        if (!p) {
            return;
        }
        maskData = {};
        maskColor = 16;
        Ghost.drawElements(p as Element, ctx);
    }

    static drawElements (p: Element, ctx: CanvasRenderingContext2D) {
        for (var i = 0; i < p.childElementCount; i++) {
            var elem = p.childNodes[i] as Element;
            if (elem.id == 'pathdots') {
                continue;
            }
            if (elem.tagName == 'image') {
                continue;
            }
            if (elem.tagName == 'clipPath') {
                continue;
            }
            if (elem.nodeName == 'g') {
                Ghost.drawElements(elem, ctx);
            } else {
                Ghost.drawElement(elem, ctx);
            }
        }
    }

    static drawElement (elem: Element, ctx: CanvasRenderingContext2D) {
        var c = Ghost.getRGB(maskColor);
        var bc = Ghost.getRGB(maskColor + 8);
        maskColor += 16;
        ctx.save();
        var nostroke = (!elem.getAttribute('stroke')) || (elem.getAttribute('stroke') == 'none');
        var n = Number(elem.getAttribute('stroke-width'));
        ctx.lineWidth = nostroke ? 0 : n;
        ctx.fillStyle = (elem.getAttribute('fill') == 'none')
            ? 'rgba(0,0,0,0)' : 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',255)';
        ctx.strokeStyle = !elem.getAttribute('stroke')
            ? 'rgba(0,0,0,0)' : 'rgba(' + bc[0] + ',' + bc[1] + ',' + bc[2] + ',255)';
        if (!SVG2Canvas.isCloseDPath(elem)) {
            ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',255)';
        }
        if (elem.id.indexOf('pathborder_image') > -1) {
            ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',255)';
        }
        if (!elem.getAttribute('fill') && !elem.getAttribute('stroke')) {
            ctx.fillStyle = 'rgba(' + bc[0] + ',' + bc[1] + ',' + bc[2] + ',255)';
        }
        maskData[Ghost.getHex(c)] = elem.id;
        maskData[Ghost.getHex(bc)] = elem.id;
        var rot = Transform.extract(elem, 4);
        if (rot.angle != 0) {
            Layer.rotateFromCenter(ctx, elem, rot.angle);
        }
        ctx.scale(Paint.currentZoom, Paint.currentZoom);
        SVG2Canvas.processXMLnode(elem, ctx, true);
        ctx.restore();
        if (SVG2Canvas.isCloseDPath(elem)) {
            return;
        }
        ctx.save();
        ctx.scale(Paint.currentZoom, Paint.currentZoom);
        ctx.lineWidth = (linemask) < n ? n : linemask;
        ctx.fillStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',255)';
        ctx.strokeStyle = 'rgba(' + bc[0] + ',' + bc[1] + ',' + bc[2] + ',255)';
        rot = Transform.extract(elem, 4);
        if (rot.angle != 0) {
            Layer.rotateFromCenter(ctx, elem, rot.angle);
        }
        SVG2Canvas.renderPathTips(elem, ctx);
        ctx.restore();
    }

    static getRGB (color: number) {
        return [Number((color >> 16) & 255), Number((color >> 8) & 255), Number(color & 255)];
    }

    static getHex (rgb: number[]) {
        var r = rgb[0].toString(16);
        if (r.length < 2) {
            r = '0' + r;
        }
        var g = rgb[1].toString(16);
        if (g.length < 2) {
            g = '0' + g;
        }
        var b = rgb[2].toString(16);
        if (b.length < 2) {
            b = '0' + b;
        }
        return r + g + b;
    }

    static getHitObject (pt: Point, isTip?: boolean, exclude?: Element) {
        var list = Ghost.svgHit(pt);
        pt = Vector.floor(Vector.scale(pt, Paint.currentZoom));
        if (!Paint.root) {
            return null;
        }
        setCanvasSize(ScratchJr.workingCanvas,
            Math.round(Number(Paint.root.getAttribute('width')) * Paint.currentZoom),
            Math.round(Number(Paint.root.getAttribute('height')) * Paint.currentZoom)
        );
        var ctx = ScratchJr.workingCanvas.getContext('2d')!;
        if (Ghost.outsideArea(pt, ScratchJr.workingCanvas)) {
            return null;
        }
        ctx.clearRect(0, 0, ScratchJr.workingCanvas.width, ScratchJr.workingCanvas.height);
        return Ghost.findHit(list as Element[], pt, ScratchJr.workingCanvas.getContext('2d')!, isTip, exclude);
    }

    static findHit (list: Element[], pt: Point, ctx: CanvasRenderingContext2D, isTip?: boolean, exclude?: Element) {
        for (var i = list.length - 1; i >= 0; i--) {
            var elem = list[i];
            if (exclude && (elem == exclude)) {
                continue;
            }
            var lw = elem.getAttribute('stroke-width') ? elem.getAttribute('stroke-width') : 0;
            ctx.save();
            Layer.drawInContext(elem, ctx, Paint.currentZoom, lw, isTip);
            ctx.restore();
            var pixel = ctx.getImageData(pt.x, pt.y, 1, 1).data;
            if (pixel[3] != 0) {
                return elem;
            }
        }
        return null;
    }

    ////////////////////
    // Debugging hit masks
    ////////////////////////

    static showmask () {
        var mask = newDiv(Paint.frame!, 0, 0, maskCanvas.width, maskCanvas.height, {
                position: 'absolute',
                zIndex: ScratchJr.layerTop + 20
            });
        mask.setAttribute('id', 'ghostmask');
        mask.appendChild(maskCanvas);
    }

    static off () {
        gn('ghostmask')!.style.visibility = 'hidden';
    }

    static on () {
        gn('ghostmask')!.style.visibility = 'visible';
    }
}
