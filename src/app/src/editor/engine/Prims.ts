import ScratchJr from '../ScratchJr';
import ScratchAudio from '../../utils/ScratchAudio';
import type Sound from '../../utils/Sound';
import Grid from '../ui/Grid';
import Vector from '../../geom/Vector';
import {gn} from '../../utils/lib';
import type Thread from './Thread';
import type {BlockLike} from './Thread';
import type Sprite from './Sprite';
import type Scripts from '../ui/Scripts';

let tinterval = 1;
let hopList = [-48, -30, -22, -14, -6, 0, 6, 14, 22, 30, 48];

export default class Prims {
    // Attached by ScratchJr.js at startup (block implementations)
    static Bigger: (strip: Thread) => void;
    static Smaller: (strip: Thread) => void;
    static SetColor: (strip: Thread) => void;
    static time: number;
    static table: Record<string, (strip: Thread) => void>;

    static get hopList () {
        return hopList;
    }

    static init () {
        Prims.table = {
            done: Prims.Done,
            missing: Prims.Ignore,
            onflag: Prims.Ignore,
            onmessage: Prims.Ignore,
            onclick: Prims.Ignore,
            ontouch: Prims.OnTouch,
            onchat: Prims.Ignore,
            repeat: Prims.Repeat,
            forward: Prims.Forward,
            back: Prims.Back,
            up: Prims.Up,
            down: Prims.Down,
            left: Prims.Left,
            right: Prims.Right,
            home: Prims.Home,
            setspeed: Prims.SetSpeed,
            message: Prims.Message,
            setcolor: Prims.SetColor,
            bigger: Prims.Bigger,
            smaller: Prims.Smaller,
            wait: Prims.Wait,
            caretcmd: Prims.Ignore,
            caretstart: Prims.Ignore,
            caretend: Prims.Ignore,
            caretrepeat: Prims.Ignore,
            gotopage: Prims.GotoPage,
            endstack: Prims.DoNextBlock,
            stopall: Prims.StopAll,
            stopmine: Prims.StopMine,
            forever: Prims.Forever,
            hop: Prims.Hop,
            show: Prims.Show,
            hide: Prims.Hide,
            playsnd: Prims.playSound,
            playusersnd: Prims.playSound,
            grow: Prims.Grow,
            shrink: Prims.Shrink,
            same: Prims.Same,
            say: Prims.Say
        };
    }

    static Done (strip: Thread) {
        if (strip.oldblock != null) {
            strip.oldblock.unhighlight();
        }
        strip.oldblock = null;
        strip.isRunning = false;
    }

    static setTime (strip: Thread) {
        strip.time = Date.now();
    }

    static showTime (strip?: Thread) {
        //var time = ((new Date()) - strip.time) / 1000;
        // 	ScratchJr.log (strip.thisblock.blocktype, time, "sec") ;
    }

    static DoNextBlock (strip: Thread) {
        strip.waitTimer = tinterval * 10;
        strip.thisblock = strip.thisblock.next!;
    }

    static StopAll () {
        ScratchJr.stopStrips();
    }

    static StopMine (strip: Thread) {
        var spr = strip.spr;
        for (var i = 0; i < ScratchJr.runtime.threadsRunning.length; i++) {
            if ((ScratchJr.runtime.threadsRunning[i].spr == spr)
                 && (ScratchJr.runtime.threadsRunning[i].thisblock != strip.thisblock)) {
                ScratchJr.runtime.threadsRunning[i].stop(true);
            }
        }
        strip.thisblock = strip.thisblock.next!;
        ScratchJr.runtime.yield = true;
    }

    static playSound (strip: Thread) {
        var b = strip.thisblock;
        var name = b.getSoundName(strip.spr.sounds) as string;
        //	console.log ('playSound', name);
        if (!strip.audio) {
            var snd = (ScratchAudio.projectSounds as Record<string, Sound>)[name];
            if (!snd) {
                strip.thisblock = strip.thisblock.next!;
                return;
            }
            strip.audio = snd;
            snd.play();
        //	console.log ("playSound", snd, strip.audio, snd.source.playbackState);
        }
        if (strip.audio && strip.audio.done()) {
            strip.audio.clear();
            strip.thisblock = strip.thisblock.next!;
            strip.audio = undefined;
        }
        strip.waitTimer = tinterval * 4;
    }

    static Say (strip: Thread) {
        var b = strip.thisblock;
        var s = strip.spr;
        var str = b.getArgValue() as string;
        if (strip.count < 0) {
            strip.count = Math.max(30, Math.round(str.length / 8) * 30); // 7 chars per seconds;
            s.openBalloon(str);
            Prims.setTime(strip);
        } else {
            var count = strip.count;
            count--;
            if (count < 0) {
                strip.count = -1;
                s.closeBalloon();
                Prims.showTime(strip);
                strip.thisblock = strip.thisblock.next!;
            } else {
                strip.waitTimer = tinterval;
                strip.count = count;
            }
        }
    }

    static GotoPage (strip: Thread) {
        var b = strip.thisblock;
        var n = Number(b.getArgValue());
        if (strip.count < 0) {
            strip.count = 2; // delay for a 10th of a second
            Prims.setTime(strip);
        } else {
            var count = strip.count;
            count--;
            if (count < 0) {
                strip.count = -1;
                Prims.showTime(strip);
                ScratchJr.stage.gotoPage(n);
            } else {
                strip.waitTimer = tinterval;
                strip.count = count;
            }
        }
    }

    static Forever (strip: Thread) {
        strip.thisblock = strip.firstBlock.aStart ? strip.firstBlock.next! : strip.firstBlock;
        ScratchJr.runtime.yield = true;
    }

    static Repeat (strip: Thread) {
        var b = strip.thisblock;
        var n = Number(b.getArgValue());
        if (n < 1) {
            n = 1;
        }
        if (b.repeatCounter! < 0) {
            b.repeatCounter = n;
        }
        if (b.repeatCounter == 0) {
            b.repeatCounter = -1;
            strip.thisblock = strip.thisblock.next!;
            strip.waitTimer = tinterval;
        } else {
            strip.stack.push(strip.thisblock);
            b.repeatCounter!--;
            strip.thisblock = strip.thisblock.inside!;
            ScratchJr.runtime.yield = true;
        }
    }

    static Ignore (strip: Thread) {
        strip.thisblock = strip.thisblock.next!;
    }

    static Wait (strip: Thread) {
        var n = Number(strip.thisblock.getArgValue());
        strip.waitTimer = Math.round(n * 3.125); // thenth of a second
        Prims.setTime(strip);
        strip.thisblock = strip.thisblock.next!;
    }

    static Home (strip: Thread) {
        var spr = strip.spr;
        spr.goHome();
        strip.waitTimer = tinterval;
        strip.thisblock = strip.thisblock.next!;
    }

    static SetSpeed (strip: Thread) {
        var s = strip.spr;
        var num = Number(strip.thisblock.getArgValue()); // 0 - 1 - 2
        s.speed = 2 ** num; // eslint-disable-line no-restricted-properties
        strip.waitTimer = tinterval;
        strip.thisblock = strip.thisblock.next!;
    }

    static Hop (strip: Thread) {
        if (strip.count < 0) { // setup the hop
            strip.count = hopList.length;
            Prims.setTime(strip);
        }
        Prims.hopTo(strip);
    }

    static hopTo (strip: Thread) {
        var s = strip.spr;
        var b = strip.thisblock;
        var n = Number(b.getArgValue());
        var count = strip.count;
        count--;
        if (count < 0) {
            strip.count = -1;
            strip.vector = {
                x: 0,
                y: 0
            };
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
        } else {
            strip.vector = {
                x: 0,
                y: hopList[count]
            };
            var dy = s.ycoor - strip.vector.y / 5 * n;
            if (dy < 0) {
                dy = 0;
            }
            if (dy >= (360 - Grid.size)) {
                dy = (360 - Grid.size);
            }
            s.setPos(s.xcoor + strip.vector.x, dy);
            strip.waitTimer = tinterval + Math.floor(2 ** (2 - Math.floor(s.speed / 2)) / 2); // eslint-disable-line no-restricted-properties
            strip.count = count;
        }
    }

    static moveInDirection (strip: Thread, vec: {x: number; y: number}, flip?: 'forward' | 'back') {
        var s = strip.spr;
        var num = Number(strip.thisblock.getArgValue()) * 24;
        var distance = Math.abs(num);
        if (flip === 'forward' && s.flip) {
            s.flip = false;
            s.render();
        } else if (flip === 'back' && !s.flip) {
            s.flip = true;
            s.render();
        }
        if (num == 0) {
            strip.thisblock = strip.thisblock.next!;
            strip.waitTimer = flip ? tinterval * 2 ** (2 - Math.floor(s.speed / 2)) : tinterval; // eslint-disable-line no-restricted-properties
            strip.vector = { x: 0, y: 0 };
            strip.distance = -1;
            return;
        }
        if (strip.distance < 0) {
            strip.distance = distance;
            strip.vector = vec;
            Prims.setTime(strip);
        }
        Prims.moveAtSpeed(strip);
    }

    static Down (strip: Thread) {
        Prims.moveInDirection(strip, { x: 0, y: 2 });
    }

    static Up (strip: Thread) {
        Prims.moveInDirection(strip, { x: 0, y: -2 });
    }

    static Forward (strip: Thread) {
        Prims.moveInDirection(strip, { x: 2, y: 0 }, 'forward');
    }

    static Back (strip: Thread) {
        Prims.moveInDirection(strip, { x: -2, y: 0 }, 'back');
    }

    static moveAtSpeed (strip: Thread) {
        var s = strip.spr;
        var distance = strip.distance;
        var num = Number(strip.thisblock.getArgValue()) * 12; // 1/2 cell size since vector is double
        var vector = Vector.scale(strip.vector, s.speed * Math.abs(num) / num);
        distance -= Math.abs(Vector.len(vector));
        if (distance < 0) {
            vector = Vector.scale(strip.vector, strip.distance);
            s.setPos(s.xcoor + vector.x, s.ycoor + vector.y);
            strip.distance = -1;
            strip.vector = {
                x: 0,
                y: 0
            };
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
        } else {
            s.setPos(s.xcoor + vector.x, s.ycoor + vector.y);
            strip.waitTimer = tinterval;
            strip.distance = distance;
        }
    }

    static turn (strip: Thread, direction: number) {
        var s = strip.spr;
        var num = Number(strip.thisblock.getArgValue()) * 30;
        if (strip.count < 0) {
            strip.count = Math.floor(Math.abs(num) / s.speed * 0.25);
            strip.angleStep = direction * s.speed * 4 * Math.abs(num) / num;
            strip.finalAngle = s.angle + direction * num;
            strip.finalAngle = strip.finalAngle % 360;
            if (strip.finalAngle < 0) {
                strip.finalAngle += 360;
            }
            if (strip.finalAngle > 360) {
                strip.finalAngle -= 360;
            }
            Prims.setTime(strip);
        }
        Prims.turning(strip);
    }

    static Right (strip: Thread) {
        Prims.turn(strip, 1);
    }

    static Left (strip: Thread) {
        Prims.turn(strip, -1);
    }

    static turning (strip: Thread) {
        var s = strip.spr;
        var count = strip.count;
        count--;
        if (count < 0) {
            strip.count = -1;
            s.setHeading(strip.finalAngle);
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
        } else {
            s.setHeading(s.angle + strip.angleStep);
            strip.waitTimer = tinterval;
            strip.count = count;
        }
    }

    static Same (strip: Thread) {
        var s = strip.spr;
        var n = (s.defaultScale - s.scale) / s.defaultScale * 10;
        if (n == 0) {
            strip.waitTimer = tinterval;
            strip.thisblock = strip.thisblock.next!;
            strip.count = -1;
            strip.distance = -1;
            if (!strip.firstBlock.aStart) {
                s.homescale = s.defaultScale;
            }
            return;
        }
        if (strip.count < 0) {
            strip.distance = s.defaultScale * Math.abs(n) / n * s.speed;
            strip.count = Math.floor(5 * Math.floor(Math.abs(n)) / s.speed);
            Prims.setTime(strip);
            if (!strip.firstBlock.aStart) {
                s.homescale = s.defaultScale;
            }
        }
        if (strip.count == 0) {
            strip.count = -1;
            s.noScaleFor();
            strip.distance = -1;
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
        } else {
            s.changeSizeBy(strip.distance * 2);
            strip.waitTimer = tinterval;
            strip.count = strip.count - 1;
        }
    }

    static resizeSprite (strip: Thread, direction: number) {
        var s = strip.spr;
        var n = Number(strip.thisblock.getArgValue());
        if (strip.count < 0) {
            strip.distance = s.scale + direction * (10 * n * s.defaultScale) / 100;
            strip.distance = Math.round(strip.distance * 1000) / 1000;
            strip.count = Math.floor(5 * Math.abs(n) / s.speed);
            Prims.setTime(strip);
        }
        if (strip.count == 0) {
            strip.count = -1;
            s.setScaleTo(strip.distance);
            if (!strip.firstBlock.aStart) {
                s.homescale = s.scale;
            }
            strip.distance = -1;
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
        } else {
            s.changeSizeBy(direction * s.defaultScale * 2 * s.speed * Math.abs(n) / n);
            strip.waitTimer = tinterval;
            strip.count = strip.count - 1;
        }
    }

    static Grow (strip: Thread) {
        Prims.resizeSprite(strip, 1);
    }

    static Shrink (strip: Thread) {
        Prims.resizeSprite(strip, -1);
    }

    static fadeSprite (strip: Thread, shown: boolean) {
        var s = strip.spr;
        s.shown = shown;
        if (strip.count < 0) {
            strip.count = s.speed == 4 ? 0 : Math.floor(15 / s.speed);
            Prims.setTime(strip);
        }
        if (strip.count == 0) {
            strip.count = -1;
            s.div.style.opacity = shown ? '1' : '0';
            Prims.showTime(strip);
            strip.thisblock = strip.thisblock.next!;
            if (!strip.firstBlock.aStart) {
                s.homeshown = shown;
            }
        } else {
            var current = Number(s.div.style.opacity);
            var delta = s.speed / 15;
            s.div.style.opacity = String(shown ? Math.min(1, current + delta) : Math.max(0, current - delta));
            strip.waitTimer = tinterval * 2;
            strip.count = strip.count - 1;
        }
    }

    static Show (strip: Thread) {
        Prims.fadeSprite(strip, true);
    }

    static Hide (strip: Thread) {
        Prims.fadeSprite(strip, false);
    }

    static OnTouch (strip: Thread) {
        var s = strip.spr;
        if (s.touchingAny()) {
            strip.stack.push(strip.firstBlock);
            strip.thisblock = strip.thisblock.next!;
        }
        strip.waitTimer = tinterval;
    }

    static Message (strip: Thread) {
        var b = strip.thisblock;
        var pair;
        if (strip.firstTime) {
            var receivers: Array<[Sprite, BlockLike]> = [];
            var msg = b.getArgValue();
            var findReceivers = function (block: BlockLike, s: Sprite) {
                if ((block.blocktype == 'onmessage') && (block.getArgValue() == msg)) {
                    receivers.push([s, block]);
                }
            };
            Prims.applyToAllStrips(['onmessage'], findReceivers);
            var newthreads: Thread[] = [];
            for (var i = 0; i < receivers.length; i++) {
                pair = receivers[i];
                newthreads.push(ScratchJr.runtime.restartThread(pair[0], pair[1], true));
            }
            strip.firstTime = false;
            strip.called = newthreads;
        }

        // after first time
        var done = true;
        for (var j = 0; j < strip.called!.length; j++) {
            if (strip.called![j].isRunning) {
                done = false;
            }
        }

        if (done) {
            strip.called = null;
            strip.firstTime = true;
            strip.thisblock = strip.thisblock.next!;
            strip.waitTimer = tinterval * 2;
        } else {
            ScratchJr.runtime.yield = true;
        }
    }

    static applyToAllStrips (list: string[], fcn: (block: BlockLike, s: Sprite) => void) {
        if (!ScratchJr.stage) {
            return;
        }
        var page = ScratchJr.stage.currentPage;
        if (!page) {
            return;
        }
        if (!page.div) {
            return;
        }
        for (var i = 0; i < page.div.childElementCount; i++) {
            var spr = page.div.childNodes[i].owner as Sprite;
            if (!spr) {
                continue;
            }
            var sc = gn(spr.id + '_scripts')!;
            if (!sc) {
                continue;
            }
            const scriptsOwner = sc.owner as Scripts;
            var topblocks = scriptsOwner.getBlocksType(list);
            for (var j = 0; j < topblocks.length; j++) {
                fcn(topblocks[j], spr);
            }
        }
    }
}
