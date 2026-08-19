import BlockSpecs from './BlockSpecs';
import type Block from './Block';
import {scaleMultiplier, setProps, setCanvasSize, newHTML, isTouch,
    newDiv, getDocumentHeight, drawThumbnail, frame, globalx, globaly,
    dprCenterTransform} from '../../utils/lib';

let openMenu: HTMLElement | null = null;

export default class Menu {
    // Referenced by the dropdown hover path but never defined anywhere in the
    // codebase (pre-existing broken hover); declared so the calls typecheck.
    static highlightdot: (evt: unknown) => void;
    static unhighlightdot: (evt: unknown) => void;

    static get openMenu () {
        return openMenu;
    }

    static set openMenu (newOpenMenu: HTMLElement | null) {
        openMenu = newOpenMenu;
    }

    static openDropDown (b: HTMLElement, fcn: (e: MouseEvent, mu: HTMLElement, b: HTMLElement, c: string) => void) {
        var size = 50;
        const block = b.owner as Block;
        var color = block.blocktype == 'setspeed' ? 'orange' : 'yellow';
        var list = JSON.parse(block.arg.list);
        var num = block.arg.numperrow;
        var p = b.parentNode as HTMLElement & { width?: number };
        var dh = size * Math.round(list.length / num);
        var rows = list.length / num;
        var w = size * list.length / rows;
        var scaledWidth = w * scaleMultiplier;
        var dx = b.left! + (b.offsetWidth - scaledWidth) / 2;
        if ((dx + scaledWidth) > p.width!) {
            dx -= ((dx + scaledWidth) - p.width!);
        }
        if (dx < 5) {
            dx = 5;
        }
        dx += globalx(p);
        var dy = b.top! + b.offsetHeight - ((10 + 18) * scaleMultiplier) + globaly(p);
        if ((dy + ((10 + dh) * scaleMultiplier)) > getDocumentHeight()) {
            dy = getDocumentHeight() - ((15 + dh) * scaleMultiplier);
        }
        var mu = newDiv(frame, dx, dy, w, dh, {
            position: 'absolute',
            zIndex: 100000,
            webkitTransform: 'translate(' + (-w / 2) + 'px,' + (-dh / 2) + 'px) '
                + 'scale(' + scaleMultiplier + ', ' + scaleMultiplier + ') '
                + 'translate(' + (w / 2) + 'px, ' + (dh / 2) + 'px)'
        });
        mu.setAttribute('class', 'menustyle ' + color);
        mu.active = b;
        for (var i = 0; i < list.length; i++) {
            Menu.addImageToDropDown(mu, list[i], b, fcn);
        }
        openMenu = mu;
    }

    static addImageToDropDown (mu: HTMLElement, c: string, block: HTMLElement, fcn: (e: MouseEvent, mu: HTMLElement, b: HTMLElement, c: string) => void) {
        var img = BlockSpecs.getImageFrom('assets/blockicons/' + c, 'svg');
        var cs = newHTML('div', 'ddchoice', mu);
        var micon = newHTML('canvas', undefined, cs) as HTMLCanvasElement;
        var iconSize = 42;
        var scaledIconSize = iconSize * window.devicePixelRatio;
        setCanvasSize(micon, scaledIconSize, scaledIconSize);
        setProps(micon.style, {
            webkitTransform: dprCenterTransform(scaledIconSize, scaledIconSize)
        });
        if (!img.complete) {
            img.onload = function () {
                drawThumbnail(img, micon);
            };
        } else {
            drawThumbnail(img, micon);
        }
        if (isTouch) {
            cs.onmousedown = function (evt: MouseEvent) {
                handleTouchStart(evt);
            };
        } else {
            cs.onmouseover = function (evt: MouseEvent) {
                Menu.highlightdot(evt);
            };
            cs.onmouseout = function (evt: MouseEvent) {
                Menu.unhighlightdot(evt);
            };
            cs.onmousedown = function (evt: MouseEvent) {
                fcn(evt, mu, block, c);
            };
        }
        function handleTouchStart (e: MouseEvent & { touches?: TouchList }) {
            if (isTouch && e.touches && (e.touches.length > 1)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            fcn(e, mu, block, c);
        }
    }

    static closeMyOpenMenu () {
        if (!openMenu) {
            return;
        }
        openMenu.parentNode!.removeChild(openMenu);
        openMenu = null;
    }
}
