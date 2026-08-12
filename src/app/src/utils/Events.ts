/*
the caller should define the window event and call startDrag with the appropiate values
*/

import {gn, scaleMultiplier, isTouch} from './lib';

// Drag elements are DOM nodes (block/thumb divs, canvases) carrying
// drag-session expando state. While a drag is active they are treated as
// always present; the accessors below assert that for external readers.
type DragElement = HTMLElement & {
    origin?: string;
    startx?: number;
    starty?: number;
    isReporter?: boolean;
};

let dragged = false;
let dragthumbnail: DragElement | null = null; // drag element (block/thumb div) with expando props; cross-module glue
let dragmousex = 0;
let dragmousey = 0;
let timeoutEvent: ReturnType<typeof setTimeout> | undefined;
let dragcanvas: DragElement | null = null; // drag element with expando props; cross-module glue
let dragDiv!: HTMLDivElement;
let fcnstart: ((e: MouseEvent) => void) | undefined;
let fcnend: ((e: MouseEvent | TouchEvent, c: HTMLElement) => void) | undefined;
let updatefcn: ((e: MouseEvent, c: HTMLElement) => void) | undefined;
let fcnclick: ((e: MouseEvent | TouchEvent, c: HTMLElement) => void) | undefined;
let scaleStartsAt = 1;
let delta = 10;
let pinchcenter = {
    x: 0,
    y: 0,
    distance: 0
};
let lastZoomScale = 1;

export default class Events {
    // Getters/setters for globally used properties
    static get dragged () {
        return dragged;
    }

    static set dragged (newDragged) {
        dragged = newDragged;
    }

    static get dragthumbnail (): DragElement {
        return dragthumbnail!;
    }

    static set dragthumbnail (newDragthumbnail: DragElement | null) {
        dragthumbnail = newDragthumbnail;
    }

    static get dragmousex () {
        return dragmousex;
    }

    static set dragmousex (newDragmousex) {
        dragmousex = newDragmousex;
    }

    static get dragmousey () {
        return dragmousey;
    }

    static set dragmousey (newDragmousey) {
        dragmousey = newDragmousey;
    }

    static get timeoutEvent () {
        return timeoutEvent;
    }

    static set timeoutEvent (newTimeoutEvent) {
        timeoutEvent = newTimeoutEvent;
    }

    static get dragcanvas (): DragElement {
        return dragcanvas!;
    }

    static set dragcanvas (newDragcanvas: DragElement | null) {
        dragcanvas = newDragcanvas;
    }

    static get dragDiv () {
        return dragDiv;
    }

    static get scaleStartsAt () {
        return scaleStartsAt;
    }

    static set scaleStartsAt (newScaleStartsAt) {
        scaleStartsAt = newScaleStartsAt;
    }

    static get pinchcenter () {
        return pinchcenter;
    }

    // Instead of popping the dragging block, etc to the outer-most frame,
    // which causes delays while the content is reflowed, we create a
    // small drag div that is a parent of frame that the dragging block
    // can be a child of. This improves dragging performance.
    static init () {
        dragDiv = document.createElement('div');
        dragDiv.id = 'dragDiv';
        dragDiv.style.position = 'absolute';
        dragDiv.style.width = '0px'; // size doesn't matter since children float
        dragDiv.style.height = '0px';
        dragDiv.style.zIndex = '7001'; // slightly higher than ScratchJr.dragginLayer
        var frameDiv = gn('frame')!;
        frameDiv.appendChild(dragDiv);
        window.addEventListener('blur', function () {
            if (dragged || dragthumbnail) {
                Events.cancelAll();
            }
        });
    }
    static startDrag (e: MouseEvent, c: HTMLElement, atstart: (e: MouseEvent) => void,
        atend: (e: MouseEvent | TouchEvent, c: HTMLElement) => void,
        atdrag: (e: MouseEvent, c: HTMLElement) => void,
        atclick: (e: MouseEvent | TouchEvent, c: HTMLElement) => void,
        athold?: (c: HTMLElement) => void) {
        dragged = false;
        var pt = Events.getTargetPoint(e);
        dragmousex = pt.x;
        dragmousey = pt.y;
        dragthumbnail = c;
        fcnstart = atstart;
        fcnend = atend;
        fcnclick = atclick;

        if (athold) {
            Events.holdit(c, athold);
        }
        updatefcn = atdrag;
        if (isTouch) { // startDrag event setting
            delta = 10 * scaleMultiplier;
            window.onmousemove = function (evt) {
                Events.mouseMove(evt);
            };
            window.onmouseup = function (evt) {
                Events.mouseUp(evt);
            };
            window.ontouchleave = function (evt) {
                Events.mouseUp(evt);
            };
            window.ontouchcancel = function (evt) {
                Events.mouseUp(evt);
            };
        } else {
            delta = 7;
            window.onmousemove = function (evt) {
                Events.mouseMove(evt);
            };
            window.onmouseup = function (evt) {
                Events.mouseUp(evt);
            };
        }
    }

    static holdit (c: HTMLElement, fcn: (c: HTMLElement) => void) {
        var repeat = function () {
            Events.clearEvents();
            fcn(dragthumbnail!);
            Events.clearDragAndDrop();
        };
        timeoutEvent = setTimeout(repeat, 500);
    }

    static clearDragAndDrop () {
        timeoutEvent = undefined;
        dragcanvas = null;
        dragged = false;
        dragthumbnail = null;
        fcnstart = undefined;
        fcnend = undefined;
        updatefcn = undefined;
        fcnclick = undefined;
    }

    static mouseMove (e: MouseEvent) {
        // be forgiving about the click
        var pt = Events.getTargetPoint(e);
        if (!dragged && (Events.distance(dragmousex - pt.x, dragmousey - pt.y) < delta)) {
            return;
        }
        clearTimeout(timeoutEvent);
        timeoutEvent = undefined;
        if (!dragged) {
            try {
                fcnstart!(e);
            } catch (err) {
                console.error('Events.mouseMove: fcnstart failed', err);
                Events.clearDragAndDrop();
                return;
            }
        }
        dragged = true;
        if (updatefcn) {
            updatefcn(e, dragcanvas!);
        }
        dragmousex = pt.x;
        dragmousey = pt.y;
    }

    static distance (dx: number, dy: number) {
        return Math.round(Math.sqrt((dx * dx) + (dy * dy)));
    }

    static mouseUp (e: MouseEvent | TouchEvent) {
        clearTimeout(timeoutEvent);
        timeoutEvent = undefined;
        Events.clearEvents();
        try {
            if (!dragged) {
                Events.itIsAClick(e);
            } else {
                Events.performMouseUpAction(e);
            }
        } catch (err) {
            console.error('Events.mouseUp: handler failed', err);
        }
        Events.clearDragAndDrop();
    }

    static cancelAll () {
        clearTimeout(timeoutEvent);
        timeoutEvent = undefined;
        Events.clearEvents();
    }

    static clearEvents () {
        if (isTouch) { // clearEvents
            window.onmousemove = null;
            window.onmouseup = null;
        } else {
            window.onmousemove = function (e) {
                e.preventDefault();
            };
            window.onmouseup = null;
        }
    }

    static performMouseUpAction (e: MouseEvent | TouchEvent) {
        if (fcnend) {
            fcnend(e, dragcanvas!);
        }
    }

    static itIsAClick (e: MouseEvent | TouchEvent) {
        if (fcnclick) {
            fcnclick(e, dragthumbnail!);
        }
    }

    static moveThumbnail (el: HTMLElement, dx: number, dy: number) {
        if (!el) {
            return;
        }
        el.top = el.top! + dy;
        el.left = el.left! + dx;
        el.style.top = el.top + 'px';
        el.style.left = el.left + 'px';
    }

    static move3D (el: HTMLElement, dx: number, dy: number) {
        if (!el) {
            return;
        }
        // globals.d.ts augments HTMLElement with `next?: unknown`, breaking
        // HTMLElement -> Element assignability; cast to the DOM API shape.
        var mtx = new WebKitCSSMatrix(window.getComputedStyle(el as Element).webkitTransform);
        el.top = dy + mtx.m42;
        el.left = dx + mtx.m41;
        el.style.webkitTransform = 'translate3d(' + el.left + 'px,' + el.top + 'px, 0)';
    }


    /*
    .m41 – corresponds to the ‘x’ value of a WebKitCSSMatrix
    .m42 – corresponds to the ‘y’ value of a WebKitCSSMatrix
    
    
    The clientX read-only property of the MouseEvent interface provides the horizontal 
    coordinate within the application's client area at which the event occurred 
    (as opposed to the coordinates within the page). 
    
    For example, clicking in the top-left corner of the client area will always 
    result in a mouse event with a clientX value of 0, regardless of whether the 
    page is scrolled horizontally.
    */

    static getTargetPoint (e: MouseEvent | TouchEvent) {
        const te = e as TouchEvent;
        if (isTouch) {
            if (te.touches && (te.touches.length > 0)) {
                return {
                    x: te.touches[0].pageX,
                    y: te.touches[0].pageY
                };
            } else if (te.changedTouches) {
                return {
                    x: te.changedTouches[0].pageX,
                    y: te.changedTouches[0].pageY
                };
            }
        }
        const me = e as MouseEvent;
        return {
            x: me.clientX,
            y: me.clientY
        };
    }

    static updatePinchCenter (e: MouseEvent | TouchEvent) {
        const te = e as TouchEvent;
        if (te.touches.length != 2) {
            return;
        }
        var x1 = te.touches[0].clientX,
            y1 = te.touches[0].clientY;
        var x2 = te.touches[1].clientX,
            y2 = te.touches[1].clientY;
        var cx = x1 + (x2 - x1) / 2,
            cy = y1 + (y2 - y1) / 2;
        var d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        pinchcenter = {
            x: cx,
            y: cy,
            distance: d
        };
    }

    static zoomScale (e: MouseEvent | TouchEvent) {
        const te = e as TouchEvent;
        if (te.touches.length !== 2) {
            return lastZoomScale;
        }
        var x1 = te.touches[0].clientX,
            y1 = te.touches[0].clientY;
        var x2 = te.touches[1].clientX,
            y2 = te.touches[1].clientY;
        var d = Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1));
        lastZoomScale = d / pinchcenter.distance;
        return lastZoomScale;
    }
}
