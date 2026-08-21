//////////////////////////////////////////////////
// Home Screen
//////////////////////////////////////////////////

import Lobby from './Lobby.js';
import iOS from '../iPad/iOS';
import IO from '../iPad/IO';
import Project from '../editor/ui/Project';
import Localization from '../utils/Localization';
import ScratchAudio from '../utils/ScratchAudio';
import Vector from '../geom/Vector';
import {gn, newHTML, isTouch} from '../utils/lib';

let frame: HTMLElement;
let scrollvalue: number;
let version: string;
let timeoutEvent: NodeJS.Timeout | null = null;

export default class Home {
    // Dynamic statics used by the touch handlers below
    static dragging = false;
    static holding = false;
    static actionTarget: HTMLElement | null = null;
    static initialPt: { x: number; y: number };
    static scrolltop: number;

    static init () {
        version = Lobby.version;
        frame = gn('htmlcontents')!;
        var inner = newHTML('div', 'inner', frame);
        var div = newHTML('div', 'scrollarea', inner);
        div.setAttribute('id', 'scrollarea');
        frame.onmousedown = Home.handleTouchStart;
        frame.onmouseup = Home.handleTouchEnd;
        Home.displayYourProjects();
    }

    ////////////////////////////
    // Home Screen
    ////////////////////////////

    static emptyProjectThumbnail (parent: HTMLElement) {
        var tb = newHTML('div', 'projectthumb', parent) as ThumbElement;
        newHTML('div', 'aproject empty', tb);
        tb.id = 'newproject';
    }

    //////////////////////////
    // Events
    //////////////////////////

    static handleTouchStart (e: MouseEvent & { touches?: TouchList }) {
        Home.dragging = false;
        Home.holding = false;
        // if ((t.nodeName == "INPUT") || (t.nodeName == "FORM")) return;
        var mytarget = Home.getMouseTarget(e);
        if ((mytarget != Home.actionTarget) && Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
            const actionChild = Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1] as HTMLElement;
            actionChild.style.visibility = 'hidden';
        }
        Home.actionTarget = mytarget;
        Home.initialPt = Events.getTargetPoint(e);
        if (Home.actionTarget) {
            holdit();
        }
        function holdit () {
            frame.onmousemove = Home.handleMove;
            var repeat = function () {
                if (Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
                    const actionChild = Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1] as HTMLElement;
                    actionChild.style.visibility = 'visible';

                    Home.holding = true;
                }
            };
            timeoutEvent = setTimeout(repeat, 500);
        }
        Home.scrolltop = document.body.scrollTop;
    }

    static handleMove (e: MouseEvent) {
        var pt = Events.getTargetPoint(e);
        var delta = Vector.diff(pt, Home.initialPt);
        if (!Home.dragging && (Vector.len(delta) > 20)) {
            Home.dragging = true;
        }
        if (!Home.dragging) {
            return;
        }
        if (timeoutEvent) {
            clearTimeout(timeoutEvent);
        }
        timeoutEvent = null;
    }

    static getMouseTarget (e: MouseEvent) {
        var t = e.target as HTMLElement;
        if (t == frame) {
            return null;
        }
        if (t.parentNode && !(t.parentNode as HTMLElement).tagName) {
            return null;
        }
        while (t.parentNode && (t.parentNode != frame) && ((t.parentNode as HTMLElement).getAttribute('class') != 'scrollarea')) {
            t = t.parentNode as HTMLElement;
        }
        return (!t.parentNode || (t.parentNode == frame)) ? null : t;
    }

    static handleTouchEnd (e: MouseEvent & { touches?: TouchList }) {
        e.preventDefault();
        e.stopPropagation();
        if (e.touches && (e.touches.length > 1)) {
            return;
        }
        frame.onmousemove = null;
        if (timeoutEvent) {
            clearTimeout(timeoutEvent);
        }
        timeoutEvent = null;
        if (Home.dragging) {
            return;
        }
        Home.performAction(e);
    }

    static performAction (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (!Home.actionTarget) {
            return;
        }
        if (Home.holding) {
            return;
        }
        var md5 = Home.actionTarget.id;
        switch (Home.getAction(e)) {
        case 'project':
            ScratchAudio.sndFX('keydown.wav');
            if (md5 && (md5 == 'newproject')) {
                Home.createNewProject();
            } else if (md5) {
                iOS.setfile('homescroll.sjr', gn('wrapc')!.scrollTop, function () {
                    doNext();
                });
            }
            break;
        case 'delete':
            ScratchAudio.sndFX('cut.wav');
            Project.thumbnailUnique(Home.actionTarget.thumb!, Home.actionTarget.id, function (isUnique) {
                if (isUnique) {
                    iOS.remove(Home.actionTarget!.thumb!, iOS.trace);
                }
            });
            iOS.setfield(iOS.database, Home.actionTarget.id, 'deleted', 'YES', Home.removeProjThumb);
            break;
        default:
            if (Home.actionTarget && (Home.actionTarget.childElementCount > 2)) {
                const actionChild = Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1] as HTMLElement;
                actionChild.style.visibility = 'hidden';
            }
            break;
        }
        function doNext () {
            iOS.analyticsEvent('lobby', 'existing_project_edited');
            window.location.href = 'editor.html?pmd5=' + md5 + '&mode=edit';
        }
    }

    static createNewProject () {
        iOS.analyticsEvent('lobby', 'project_created');
        var obj: Record<string, string> = {};
        var prefix = Localization.localize('NEW_PROJECT_PREFIX');
        obj.name = Home.getNextName(prefix || 'Project');
        obj.version = version || '1.0.0';
        obj.mtime = (new Date()).getTime().toString();
        IO.createProject(obj, Home.gotoEditor);
    }

    static gotoEditor (md5: unknown) {
        if (!md5 || md5 === -1 || md5 === 0 || md5 === '0') {
            // Project creation failed — stay on lobby
            console.error('Project creation failed, md5:', md5); // eslint-disable-line no-console
            return;
        }
        iOS.setfile('homescroll.sjr', gn('wrapc')!.scrollTop, function () {
            doNext(md5);
        });
        function doNext (md5: unknown) {
            window.location.href = 'editor.html?pmd5=' + md5 + '&mode=edit';
        }
    }

    // Project names are given by reading the DOM elements of existing projects...
    static getNextName (name: string) {
        var pn: string[] = [];
        var div = gn('scrollarea')!;
        for (var i = 0; i < div.childElementCount; i++) {
            const child = div.childNodes[i] as HTMLElement;
            if (child.id == 'newproject') {
                continue;
            }
            pn.push(div.childNodes[i].childNodes[1].childNodes[0].textContent!);
        }
        var n = 1;
        while (pn.indexOf(name + ' ' + n) > -1) {
            n++;
        }
        return name + ' ' + n;
    }

    static removeProjThumb () {
        if (Home.actionTarget && Home.actionTarget.parentNode) {
            Home.actionTarget.parentNode.removeChild(Home.actionTarget);
        }
        Home.actionTarget = null;
    }

    static getAction (e: MouseEvent) {
        if (!Home.actionTarget) {
            return 'none';
        }
        var shown = false;
        if (Home.actionTarget.childElementCount > 2) {
            const actionChild = Home.actionTarget.childNodes[Home.actionTarget.childElementCount - 1] as HTMLElement;
            shown = actionChild.style.visibility == 'visible';
        }
        if (e && shown) {
            var t = e.target;
            if ((t as HTMLElement).getAttribute('class') == 'closex') {
                return 'delete';
            }
        }
        return 'project';
    }

    //////////////////////////
    // Gather projects
    //////////////////////////

    static displayYourProjects () {
        iOS.getfile('homescroll.sjr', gotScrollsState);
        function gotScrollsState (str: string) {
            var num = Number(atob(str));
            scrollvalue = (num.toString() == 'NaN') ? 0 : num;
            var json: SqlPayload = {};
            json.cond = 'deleted = ? AND version = ? AND gallery IS NULL';
            json.items = ['name', 'thumbnail', 'id', 'isgift'];
            json.values = ['NO', version];
            json.order = 'ctime desc';
            IO.query(iOS.database, json, Home.displayProjects);
        }
    }

    static displayProjects (str: string) {
        var data = JSON.parse(str);
        var div = gn('scrollarea')!;
        while (div.childElementCount > 0) {
            div.removeChild(div.childNodes[0]);
        }
        Home.emptyProjectThumbnail(div);
        for (var i = 0; i < data.length; i++) {
            Home.addProjectLink(div, data[i]);
        }
        setTimeout(function () {
            Lobby.busy = false;
        }, 1000);
        if (gn('wrapc')!) {
            gn('wrapc')!.scrollTop = scrollvalue;
        }
    }

    static addProjectLink (parent: HTMLElement, aa: { id?: string; name?: string; isgift?: string; thumbnail?: unknown }) {
        var data = IO.parseProjectData(aa);
        var id = data.id;
        var th = data.thumbnail;
        if (!th) {
            return;
        }
        var thumb = (typeof th === 'string') ? JSON.parse(th) : th;
        // Page-count badge assets only exist for p1..p4 — clamp larger projects
        var pc = Math.min(thumb.pagecount ? thumb.pagecount : 1, 4);
        var tb = newHTML('div', 'projectthumb', parent);
        tb.setAttribute('id', String(id));
        tb.type = 'projectthumb';
        tb.thumb = thumb.md5;
        var mt = newHTML('div', 'aproject p' + pc, tb);
        Home.insertThumbnail(mt, 192, 144, thumb);
        var label = newHTML('div', 'projecttitle', tb);
        var txt = newHTML('h4', undefined, label);
        txt.textContent = data.name as string;

        var bow = newHTML('div', 'share', tb);
        var ribbonHorizontal = newHTML('div', 'ribbonHorizontal', tb);
        var ribbonVertical = newHTML('div', 'ribbonVertical', tb);

        if (data.isgift != '0') {
            // If it's a gift, show the bow and ribbon
            bow.style.visibility = 'visible';
            ribbonHorizontal.style.visibility = 'visible';
            ribbonVertical.style.visibility = 'visible';
        }

        newHTML('div', 'closex', tb);
    }

    static insertThumbnail (p: HTMLElement, w: number, h: number, data: { md5?: string; pagecount?: number }) {
        var md5 = data.md5;
        var img = newHTML('img', undefined, p) as HTMLImageElement;
        if (md5) {
            IO.getAsset(md5, drawMe);
        }
        function drawMe (url: string) {
            img.src = url;
        }
    }
}

class Events {
    static getTargetPoint (e: MouseEvent & { touches?: TouchList; changedTouches?: TouchList }) {
        if (isTouch) {
            if (e.touches && (e.touches.length > 0)) {
                return {
                    x: e.touches[0].pageX,
                    y: e.touches[0].pageY
                };
            } else if (e.changedTouches) {
                return {
                    x: e.changedTouches[0].pageX,
                    y: e.changedTouches[0].pageY
                };
            }
        }
        return {
            x: e.clientX,
            y: e.clientY
        };
    }
}
