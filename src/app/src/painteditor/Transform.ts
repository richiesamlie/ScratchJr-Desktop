//////////////////////////////////
// SVG Transforms
//////////////////////////////////

import SVGTools from './SVGTools';
import SVG2Canvas from '../utils/SVG2Canvas';
import Paint from './Paint';
import Vector from '../geom/Vector';
import {gn, DEGTOR} from '../utils/lib';

export default class Transform {
    static getList (elem: Element | null) {
        if (elem == undefined) {
            return null;
        }
        if ((elem as SVGGraphicsElement).transform) {
            return (elem as SVGGraphicsElement).transform.baseVal;
        } else if ((elem as SVGGradientElement).gradientTransform) {
            return (elem as SVGGradientElement).gradientTransform.baseVal;
        }
        return null;
    }

    static extract (elem: Element, n: number) {
        var tl = Transform.getList(elem)!;
        for (var i = 0; i < tl.numberOfItems; ++i) {
            if (tl.getItem(i).type == n) {
                return tl.getItem(i);
            }
        }
        return Paint.root.createSVGTransform();
    }

    static getIndex (elem: Element, n: number) {
        var tl = Transform.getList(elem)!;
        for (var i = 0; i < tl.numberOfItems; ++i) {
            if (tl.getItem(i).type == n) {
                return i;
            }
        }
        return null;
    }

    static point (x: number | string | null, y: number | string | null, m: SVGMatrix) {
        return Transform.newPoint(x, y).matrixTransform(m);
    }

    static newPoint (x: number | string | null, y: number | string | null) {
        var pt = Paint.root.createSVGPoint();
        pt.x = x as unknown as number;
        pt.y = y as unknown as number;
        return pt;
    }

    ////////////////////////////
    // Element translation
    ////////////////////////////

    static translateTo (elem: Element, xform: { setTranslate(x: number, y: number): void; matrix?: unknown }, fcn?: SVGMatrix) {
        if (elem == undefined) {
            return;
        }
        var pname = elem.tagName;
        //	console.log ("translateTo", elem.id, elem.tagName, xform.matrix);
        switch (pname) {
        case 'g':
            for (var i = 0; i < elem.childElementCount; i++) {
                if (Transform.getList(elem.childNodes[i] as Element) != null) {
                    Transform.translateTo(elem.childNodes[i] as Element, xform,
                        Transform.getScaleMatrix(elem.childNodes[i] as Element));
                }
            }
            break;
        case 'ellipse':
        case 'circle':
            var center = Transform.point(elem.getAttribute('cx'), elem.getAttribute('cy'), xform.matrix as SVGMatrix);
            elem.setAttributeNS(null, 'cx', String(center.x));
            elem.setAttributeNS(null, 'cy', String(center.y));
            break;
        case 'line':
            Transform.line(elem, xform.matrix as SVGMatrix);
            break;
        case 'path':
            Transform.applyToCmds(elem, xform.matrix as SVGMatrix);
            break;
        case 'clipPath':
            Transform.translateTo(elem.childNodes[0] as Element, xform);
            break;
        case 'image':
        case 'rect':
            var corner = Transform.point(Number(elem.getAttribute('x')), Number(elem.getAttribute('y')), xform.matrix as SVGMatrix);
            elem.setAttributeNS(null, 'x', String(corner.x));
            elem.setAttributeNS(null, 'y', String(corner.y));
            break;
        case 'polygon':
        case 'polyline':
            var points = (elem as SVGPolygonElement).points;
            var delta = {
                x: (xform.matrix as SVGMatrix).e,
                y: (xform.matrix as SVGMatrix).f
            };
            for (var j = 0; j < points.numberOfItems; j++) {
                var p = Vector.sum(points.getItem(j), delta);
                points.getItem(j).x = p.x;
                points.getItem(j).y = p.y;
            }
            break;
        }
        Transform.updateAll(elem);
        Transform.updateRotationCenter(elem);
    }

    static updateRotationCenter (elem: Element) {
        if (Transform.getRotationAngle(elem) == 0) {
            return;
        }
        var angle = Transform.getRotationAngle(elem);
        var rot = Transform.extract(elem, 4);
        var mtx = Transform.getCombinedMatrices(elem); // skips rotation matrices
        var center = SVGTools.getBoxCenter(elem);
        center = Transform.point(center.x, center.y, mtx);
        rot.setRotate(angle, center.x, center.y);
    }

    static line (elem: Element, mtx: SVGMatrix) {
        var pt = Paint.root.createSVGPoint();
        pt.x = Number(elem.getAttribute('x1'));
        pt.y = Number(elem.getAttribute('y1'));
        pt = pt.matrixTransform(mtx);
        elem.setAttribute('x1', String(pt.x));
        elem.setAttribute('y1', String(pt.y));
        pt.x = Number(elem.getAttribute('x2'));
        pt.y = Number(elem.getAttribute('y2'));
        pt = pt.matrixTransform(mtx);
        elem.setAttribute('x2', String(pt.x));
        elem.setAttribute('y2', String(pt.y));
    }

    static eleminateTranslates (elem: Element) {
        var tl = Transform.getList(elem)!;
        for (var i = 0; i < tl.numberOfItems; ++i) {
            if (tl.getItem(i).type == 2) {
                var trnsf = tl.getItem(i);
                tl.removeItem(i);
                if (elem.nodeName == 'image') {
                    var clip = gn('clip_' + elem.id)!;
                    if (clip) {
                        Transform.translateTo(clip.childNodes[0] as Element, trnsf);
                    }
                }
                Transform.translateTo(elem, trnsf);
            }
        }

    }

    static eliminateAll (spr: Element) {
        var tl = Transform.getList(spr);
        if (tl && tl.numberOfItems > 0) {
            var k = tl.numberOfItems;
            while (k--) {
                tl.removeItem(k);
            }
        }
        return tl;
    }

    static combineAll (elem: Element) {
        var tl = Transform.getList(elem);
        if (tl == null) {
            return Paint.root.createSVGMatrix();
        }
        var n = tl.numberOfItems;
        var m = Paint.root.createSVGMatrix();
        for (var i = 0; i < n; i++) {
            var mtom = tl.getItem(i);
            m = m.multiply(mtom.matrix);
        }
        return m;
    }

    static appendForMove (elem: Element, t: SVGTransform) {
        var tl = Transform.getList(elem);
        if (tl == null) {
            return;
        }
        if (tl.numberOfItems == 0) {
            tl.appendItem(t);
        } else {
            tl.insertItemBefore(t, 0);
        }
    }

    static getTranslateTransform () {
        var res = Paint.root.createSVGTransform();
        res.setTranslate(0, 0);
        return res;
    }

    static applyRotation (elem: Element, angle: number) {
        var rot = Paint.root.createSVGTransform();
        var box = SVGTools.getBox(elem);
        var cx = box.x + box.width / 2;
        var cy = box.y + box.height / 2;
        rot.setRotate(angle, cx, cy);
        Transform.getList(elem)!.appendItem(rot);
    }

    //////////////////////////////////
    // SVG Transforms
    //////////////////////////////////

    static getRotationAngle (elem: Element, to_rad?: boolean) {
        var tl = Transform.getList(elem);
        if (!tl) {
            return 0;
        }
        var num = tl.numberOfItems;
        for (var i = 0; i < num; ++i) {
            var xform = tl.getItem(i);
            if (xform.type == 4) {
                return to_rad ? xform.angle * DEGTOR : xform.angle;
            }
        }
        return 0.0;
    }

    static getRotation (elem: Element) {
        //console.log ("Transform.getRotation", elem);
        var tl = Transform.getList(elem)!;
        var num = tl.numberOfItems;
        for (var i = 0; i < num; ++i) {
            var xform = tl.getItem(i);
            if (xform.type == 4) {
                return xform;
            }
        }
        var rot = Paint.root.createSVGTransform();
        var center = SVGTools.getBoxCenter(elem);
        rot.setRotate(0, center.x, center.y);

        if (tl.numberOfItems == 0) {
            Transform.getList(elem)!.appendItem(rot);
        } else {
            Transform.getList(elem)!.insertItemBefore(rot, 0);
        }
        return rot;
    }

    static getValid (elem: Element) {
        if (!elem) {
            return null;
        }
        var tl = Transform.getList(elem);
        if (!tl) {
            return null;
        }
        if (tl && tl.numberOfItems > 0) {
            var k = tl.numberOfItems;
            while (k--) {
                var xform = tl.getItem(k);
                if (xform.type == 0) {
                    tl.removeItem(k);
                }
                if ((xform.matrix as unknown as { isIdentity: () => boolean }).isIdentity()) {
                    tl.removeItem(k);
                } else if (xform.type == 4) { // remove zero-degree rotations
                    if (xform.angle == 0) {
                        tl.removeItem(k);
                    }
                    if (xform.angle == 360) {
                        tl.removeItem(k);
                    }
                }
            }
            if (tl.numberOfItems == 1 && Transform.getRotationAngle(elem)) {
                return null;
            }
        }
        // if this element had no transforms, we are done
        if (tl.numberOfItems == 0) {
            if (elem.getAttribute('transform')) {
                elem.removeAttribute('transform');
            }
            return null;
        }
        return tl;
    }

    static getCombinedMatrices (elem: Element) {
        var tl = Transform.getList(elem);
        if (tl == null) {
            return Paint.root.createSVGMatrix();
        }
        var n = tl.numberOfItems;
        var m = Paint.root.createSVGMatrix();
        for (var i = 0; i < n; i++) {
            var mtom = tl.getItem(i);
            if (mtom.type == 4) {
                continue; // skip rotation transform
            } else {
                m = m.multiply(mtom.matrix);
            }
        }
        return m;
    }

    static hasScaleMatrix (elem: Element) {
        var tl = Transform.getList(elem);
        if (tl == null) {
            return false;
        }
        for (var i = 0; i < tl.numberOfItems; ++i) {
            if (tl.getItem(i).type == 3) {
                return true;
            }
        }
        return false;
    }

    static getScaleMatrix (e: Element) {
        var tl = Transform.getList(e);
        var scaleIndex = Transform.getIndex(e, 3);
        if (scaleIndex != null) {
            return tl!.getItem(scaleIndex).matrix;
        }
        return Paint.root.createSVGMatrix();
    }

    static updateAll (elem: Element | null) {
        var newtl = Transform.getList(elem);
        if (newtl && newtl.numberOfItems == 0) {
            elem!.removeAttribute('transform');
        }
    }

    static applyMatrix (elem: Element, matrix: SVGMatrix) {
        var m = Paint.root.createSVGTransform();
        m.setMatrix(matrix);
        Transform.getList(elem)!.appendItem(m);
    }

    ////////////////////////////////////////////////////////////
    // Paths data structure
    ////////////////////////////////////////////////////////////

    static applyToCmds (shape: Element, mtx: SVGMatrix) {
        var d = shape.getAttribute('d');
        var list = SVG2Canvas.getCommandList(d);
        var plist: (string | number)[][] = [];
        if (!list) {
            return;
        }
        for (var j = 0; j < list.length; j++) {
            var cmd = list[j];
            cmd = Transform.getModifiedCmd(cmd, mtx);
            plist.push(cmd);
        }
        var path = SVG2Canvas.arrayToString(plist);
        shape.setAttribute('d', path);
    }

    static getModifiedCmd (cmd: [string, ...number[]], mtx: SVGMatrix) {
        var pt = Transform.newPoint(0, 0);
        if (cmd.length < 2) {
            return cmd;
        }
        if (cmd.length < 3) {
            if ((cmd[0] as string).toLowerCase() == 'h') {
                pt.x = cmd[1];
                cmd[1] = pt.matrixTransform(mtx).x;
            } else {
                pt.y = cmd[1];
                cmd[1] = pt.matrixTransform(mtx).y;
            }
            return cmd;
        }
        for (var i = 1; i < cmd.length; i += 2) {
            pt.x = cmd[i] as number;
            pt.y = cmd[i + 1] as number;
            pt = pt.matrixTransform(mtx);
            cmd[i] = pt.x;
            cmd[i + 1] = pt.y;
        }
        return cmd;
    }


    ////////////////////////////////////////////////
    // Element Rotation
    ///////////////////////////////////////////////

    static rotateFromPoint (erot: SVGTransform, node: Element) {
        var pname = node.tagName;
        var rot = Transform.getRotation(node);
        var c, p, delta, mtx, cx, cy;
        switch (pname) {
        case 'g':
            for (var i = 0; i < node.childElementCount; i++) {
                Transform.rotateFromPoint(erot, node.childNodes[i] as Element);
            }
            if (node.getAttribute('transform')) {
                node.removeAttribute('transform');
            }
            break;
        case 'clipPath':
            // it is done in the image processing
            break;
        case 'image':
        case 'rect':
            c = SVGTools.getBoxCenter(node);
            p = Transform.point(c.x, c.y, erot.matrix);
            delta = Vector.diff(p, c);
            mtx = Paint.root.createSVGMatrix();
            mtx.e = delta.x;
            mtx.f = delta.y;
            var pt = Paint.root.createSVGPoint();
            pt.x = Number(node.getAttribute('x'));
            pt.y = Number(node.getAttribute('y'));
            pt = pt.matrixTransform(mtx);
            var imgdelta = Vector.diff({
                x: pt.x,
                y: pt.y
            }, {
                x: Number(node.getAttribute('x')),
                y: Number(node.getAttribute('y'))
            });
            node.setAttribute('x', String(pt.x));
            node.setAttribute('y', String(pt.y));
            if ((pname == 'image') && (Vector.len(imgdelta) > 0)) {
                var clip = gn('pathmask_' + node.id)!;
                if (clip) {
                    if (clip.getAttribute('transform')) {
                        clip.removeAttribute('transform');
                    }
                    var cmtx = Paint.root.createSVGMatrix();
                    cmtx.e = imgdelta.x;
                    cmtx.f = imgdelta.y;
                    Transform.applyToCmds(clip as Element, cmtx);
                }
            }
            break;
        case 'circle':
        case 'ellipse':
            cx = Number(node.getAttribute('cx'));
            cy = Number(node.getAttribute('cy'));
            p = Transform.point(cx, cy, erot.matrix);
            var attr: Record<string, number> = {
                'cx': p.x,
                'cy': p.y
            };
            for (var val in attr) {
                node.setAttributeNS(null, val, String(Math.round(attr[val] * 100) / 100));
            }
            break;
        case 'line':
            c = SVGTools.getBoxCenter(node);
            p = Transform.point(c.x, c.y, erot.matrix);
            delta = Vector.diff(p, c);
            mtx = Paint.root.createSVGMatrix();
            mtx.e = delta.x;
            mtx.f = delta.y;
            Transform.line(node, mtx);
            break;
        case 'path':
            c = SVGTools.getBoxCenter(node);
            p = Transform.point(c.x, c.y, erot.matrix);
            delta = Vector.diff(p, c);
            mtx = Paint.root.createSVGMatrix();
            mtx.e = delta.x;
            mtx.f = delta.y;
            Transform.applyToCmds(node, mtx);
            break;
        case 'polygon':
        case 'polyline':
            c = SVGTools.getBoxCenter(node);
            p = Transform.point(c.x, c.y, erot.matrix);
            delta = Vector.diff(p, c);
            mtx = Paint.root.createSVGMatrix();
            mtx.e = delta.x;
            mtx.f = delta.y;
            var points = (node as SVGPolygonElement).points;
            for (var j = 0; j < points.numberOfItems; j++) {
                p = Transform.point(points.getItem(j).x, points.getItem(j).y, mtx);
                points.getItem(j).x = p.x;
                points.getItem(j).y = p.y;
            }
            break;
        }
        if (pname == 'g') {
            return;
        }
        if (pname == 'clipPath') {
            return;
        }
        rot = Transform.getRotation(node);
        var box = SVGTools.getBox(node);
        cx = box.x + box.width / 2;
        cy = box.y + box.height / 2;
        rot.setRotate(erot.angle + rot.angle, cx, cy);
        Transform.updateRotationCenter(node);
        if (pname == 'path') {
            Transform.applyToCmds(node, Transform.combineAll(node));
            Transform.eliminateAll(node);
        }
    }
}

const svgMatrixProto = SVGMatrix.prototype as unknown as { isIdentity: () => boolean };
        svgMatrixProto.isIdentity = function (this: SVGMatrix) {
    return (this.a == 1 && this.b == 0 && this.c == 0 && this.d == 1 && this.e == 0 && this.f == 0);
};
