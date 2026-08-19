import BlockSpecs from './BlockSpecs';
import BlockArg from './BlockArg';
import ScratchJr from '../ScratchJr';
import type Sprite from '../engine/Sprite';
import {setProps, setCanvasSize, scaleMultiplier, dprCenterTransform} from '../../utils/lib';

// Block dimensions (in unscaled pixels)
const BLOCK_WIDTH_REPEAT = 176;
const BLOCK_WIDTH_GOTOPAGE = 86;
const BLOCK_WIDTH_START_END = 84;
const BLOCK_WIDTH_DEFAULT = 76;
const BLOCK_HEIGHT_REPEAT = 82;
const BLOCK_HEIGHT_DEFAULT = 66;

export default class Block {
    // Instance state built by the constructor and shape-drawing helpers
    div: HTMLElement;
    blockshape: HTMLCanvasElement;
    spec!: unknown[];
    isReporter!: boolean;
    blocktype!: string;
    icon: unknown;
    image!: HTMLImageElement;
    aStart!: boolean;
    anEnd!: boolean;
    cShape!: boolean;
    prev!: Block;
    next!: Block;
    inside!: Block;
    isCaret!: boolean;
    type!: string;
    arg!: BlockArg;
    daddy!: Block;
    scale!: number;
    repeatCounter!: number;
    originalCount!: number;
    threads!: unknown[];
    min!: number;
    max!: number;
    hrubberband!: number;
    vrubberband!: number;
    shadow!: HTMLCanvasElement;
    shadowimg!: HTMLImageElement;
    shine!: HTMLCanvasElement;
    blockicon!: HTMLCanvasElement;
    inpalette!: boolean;
    done!: boolean;

    constructor (spec: unknown[], isPalette: boolean, scale: number) {
        this.div = document.createElement('div');

        // Top-level block parent shouldn't accept pointer events
        setProps(this.div.style, {
            pointerEvents: 'none'
        });

        this.setBlockshapeFromSpecs(spec, isPalette, scale);
        this.blockshape = document.createElement('canvas');
        setCanvasSize(this.div, this.getWidth() * this.scale, this.getHeight() * this.scale);
        setCanvasSize(this.blockshape, this.getWidth() * this.scale * window.devicePixelRatio, this.getHeight() * this.scale * window.devicePixelRatio);
        this.addShadow();
        this.div.appendChild(this.blockshape);
        setProps(this.blockshape.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            webkitTransform: dprCenterTransform(this.blockshape.width, this.blockshape.height),
            pointerEvents: 'all'
        });
        this.addHighlight();
        this.drawBlock();
        setCanvasSize(this.div, this.blockshape.width / window.devicePixelRatio, this.blockshape.height / window.devicePixelRatio);
        if (this.isCaret) {
            return;
        }
        this.createArgument();
        this.div.owner = this;
    }

    getWidth () {
        if (this.blocktype == 'repeat') {
            return BLOCK_WIDTH_REPEAT;
        }
        if (this.blocktype == 'gotopage') {
            return BLOCK_WIDTH_GOTOPAGE;
        }
        if (this.aStart || this.anEnd) {
            return BLOCK_WIDTH_START_END;
        }
        return BLOCK_WIDTH_DEFAULT;
    }

    getHeight () {
        if (this.blocktype == 'repeat') {
            return BLOCK_HEIGHT_REPEAT;
        }
        return BLOCK_HEIGHT_DEFAULT;
    }

    setBlockshapeFromSpecs (spec: unknown[], isPalette?: boolean, scale?: number) {
        this.spec = spec;
        this.isReporter = (spec[1] == 'reporter');
        this.blocktype = spec[0] as string;
        this.icon = spec[1];
        this.image = spec[2] as HTMLImageElement;
        this.aStart = (this.blocktype == 'caretstart') || (this.image == BlockSpecs.yellowStart);
        this.anEnd = (this.blocktype == 'caretend')
            || (this.image == BlockSpecs.redEnd)
            || (this.image == BlockSpecs.redEndLong
        );
        this.cShape = (this.blocktype == 'repeat') || (this.blocktype == 'caretrepeat');
        this.prev = null as unknown as Block;
        this.next = null as unknown as Block;
        this.inside = null as unknown as Block;
        this.isCaret = this.blocktype.indexOf('caret') > -1;
        this.type = 'block';
        this.arg = null as unknown as BlockArg;
        this.daddy = null as unknown as Block;
        this.scale = scale || 1;  
        this.repeatCounter = -1;
        this.originalCount = -1;
        this.threads = [];
        this.inpalette = isPalette ?? false;
        this.min = spec[6] as number;
        this.max = spec[7] as number;
        this.shadowimg = (this.spec.length < 9) ? null as unknown as HTMLImageElement : spec[8] as HTMLImageElement;
        this.hrubberband = 0;
        this.vrubberband = 0;
        this.done = false;
    }

    addShadow () {
        this.shadow = document.createElement('canvas');
        this.div.appendChild(this.shadow);
        setProps(this.shadow.style, {
            position: 'absolute',
            left: '1px',
            top: '4px',
            opacity: this.inpalette ? window.Settings!.paletteBlockShadowOpacity : 1,
            visibility: 'hidden',
            webkitTransform: dprCenterTransform(this.blockshape.width, this.blockshape.height),
            pointerEvents: 'all'
        });
        setCanvasSize(this.shadow, this.blockshape.width, this.blockshape.height);
        if (!this.shadowimg) {
            return;
        }
        var ctx = this.shadow.getContext('2d')!;
        var img = this.shadowimg;
        if (!img.complete) {
            var me = this;
        img.onload = function () {
                ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * me.scale * window.devicePixelRatio, img.height * me.scale * window.devicePixelRatio);
            };
        } else {
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * this.scale * window.devicePixelRatio, img.height * this.scale * window.devicePixelRatio);
        }
    }

    lift () {
        this.shadow.style.visibility = 'visible';
    }

    drop () {
        this.shadow.style.visibility = 'hidden';
    }

    addHighlight () {
        // spec[5] is the highlight image slot
        var img = this.spec[5] as HTMLImageElement;
        if (!img) {
            return;
        }
        this.shine = document.createElement('canvas');
        this.div.appendChild(this.shine);
        setCanvasSize(this.shine, this.blockshape.width, this.blockshape.height);
        setProps(this.shine.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            visibility: 'hidden',
            webkitTransform: dprCenterTransform(this.blockshape.width, this.blockshape.height),
            pointerEvents: 'all'
        });
        var ctx = this.shine.getContext('2d')!;
        var me = this;
        if (!img.complete) {
            img.onload = function () {
                ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * me.scale * window.devicePixelRatio, img.height * me.scale * window.devicePixelRatio);
            };
        } else {
            ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, img.width * this.scale * window.devicePixelRatio, img.height * this.scale * window.devicePixelRatio);
        }
    }

    drawBlock () {
        var cnv = this.blockshape;
        var ctx = this.blockshape.getContext('2d')!;
        ctx.clearRect(0, 0, cnv.width, cnv.height);
        var me = this;
        if (!this.image.complete) {
            this.image.onload = function () {
                me.drawBlockType();
            };
        } else {
            this.drawBlockType();
        }
    }

    drawBlockType () {
        var ctx = this.blockshape.getContext('2d')!;
        ctx.drawImage(this.image, 0, 0, this.image.width, this.image.height, 0, 0, this.image.width * this.scale * window.devicePixelRatio, this.image.height * this.scale * window.devicePixelRatio);
        var icnv = document.createElement('canvas');
        this.blockicon = icnv;
        this.div.appendChild(icnv);
        setCanvasSize(icnv, this.blockshape.width, this.blockshape.height);
        setProps(icnv.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            webkitTransform: dprCenterTransform(this.blockshape.width, this.blockshape.height),
            pointerEvents: 'all'
        });
        const iconNode = this.icon;
        if (iconNode && typeof iconNode === 'object' && 'tagName' in iconNode) {
            this.drawIcon();
        }
        this.done = true;
    }

    updateBlock () {
        if (this.arg && this.arg.argType == 'p') {
            this.arg.updateIcon();
        }
    }

    highlight () {
        if (this.blocktype.indexOf('caret') > -1) {
            return;
        }
        if (!this.div.parentNode) {
            return;
        } // deleted block
        const parentNode = this.div.parentNode as HTMLElement;
        if ((parentNode.id != 'palette') && (this.div.parentNode != ScratchJr.getActiveScript())) {
            return;
        }
        this.shine.style.visibility = 'visible';
    }

    unhighlight () {
        if (this.blocktype.indexOf('caret') > -1) {
            return;
        }
        this.shine.style.visibility = 'hidden';
    }

    drawIcon () {
        var dx = 0;
        var dy = 0;
        var ctx = this.blockicon.getContext('2d')!;
        switch (this.blocktype) {
          case 'repeat':
            var w = Math.round(74 * this.scale * window.devicePixelRatio);
            var h = Math.round(65 * this.scale * window.devicePixelRatio);
            setCanvasSize(this.blockicon, w, h);
            dx = 0;
            this.blockicon.style.left = (this.shine.width / window.devicePixelRatio
                - Math.round(this.scale * 77)) + 'px';
            dy = Math.round(this.scale * 14 * window.devicePixelRatio);
            setProps(this.blockicon.style, {
                position: 'absolute',
                webkitTransform: dprCenterTransform(w, h)
            });
            break;
          default:
             break;
        }
        this.drawMyIcon(ctx, dx, dy);
    }

    drawMyIcon (ctx: CanvasRenderingContext2D, dx: number, dy: number) {
        var me = this;
        var icon = this.icon as HTMLImageElement;
        if (!icon.complete) {
            icon.onload = function () {
                ctx.drawImage(icon, 0, 0, icon.width, icon.height, dx, dy, icon.width * me.scale * window.devicePixelRatio, icon.height * me.scale * window.devicePixelRatio);
            };
        } else {
            ctx.drawImage(icon, 0, 0, icon.width, icon.height, dx, dy, icon.width * me.scale * window.devicePixelRatio, icon.height * me.scale * window.devicePixelRatio);
        }
    }

    createArgument () {
        if (this.spec[4] == null) {
            return;
        }
        this.arg = new BlockArg(this);
    }

    getArgValue () {
        if (this.arg == null) {
            return null;
        }
        return this.arg.argValue;
    }

    getSoundName (list: string[]) {
        var val = this.arg.argValue as number;
        if (Number(val).toString() == 'NaN') {
            return val;
        }
        if (list.length <= val) {
            return list[0];
        }
        return list[Number(val)];
    }

    update (spr: Sprite) {
        if (this.arg) {
            this.arg.update(spr);
        }
    }

    setSound (bt: string) {
        var p = this.arg.div;
        p.parentNode!.removeChild(p);
        var icon = this.blockicon;
        icon.parentNode!.removeChild(icon);
        var op = bt;
        var specs = BlockSpecs.defs[op] as unknown[];
        this.setBlockshapeFromSpecs(specs);
        this.drawBlock();
        this.createArgument();
    }

    duplicateBlock (dx: number, dy: number, spr: Sprite) {
        var op = this.blocktype;
        var specs = BlockSpecs.defs[op] as unknown[];
        specs[4] = this.getArgValue();
        var bbx = new Block(specs, false, scaleMultiplier);
        setProps(bbx.div.style, {
            position: 'absolute',
            left: '0px',
            top: '0px'
        });
        bbx.moveBlock(dx, dy);
        bbx.update(spr);
        return bbx;
    }

    resolveDocks (): Array<[string, boolean, number, number]> {
        var w = this.getWidth();
        var h = this.getHeight();
        if (this.aStart) {
            return [['start', true, 0, h / 2], ['flow', false, w - this.notchSize(), h / 2]];
        }
        if (this.anEnd) {
            return [['flow', true, 0, h / 2], ['changestate', false, w - 3, h / 2]];
        }
        if (this.isReporter) {
            return [['input', true, 0, 0], ['input', false, w - this.notchSize(), h / 2]];
        }
        if (this.cShape) {
            return [['flow', true, 0, this.blockshape.height / this.scale / window.devicePixelRatio - 33],
                ['flow', false, 35, this.blockshape.height / this.scale / window.devicePixelRatio - 33],
                ['flow', false, this.blockshape.width / this.scale / window.devicePixelRatio - this.notchSize() - 1,
                    this.blockshape.height / this.scale / window.devicePixelRatio - 33]];
        }
        
        return [['flow', true, 0, h / 2], ['flow', false, w - this.notchSize(), h / 2]];
        
    }

    notchSize () {
        return 11;
    }

    //////////////////////////////////////////
    // Connect / Disconnect
    /////////////////////////////////////////

    connectBlock (myn: number, you: Block, yourn: number) {
        if (this.isConnectedAfterFirst(myn, you, yourn)) {
            return;
        }
        this.connectLast(myn, you, yourn);
        this.setMyDock(myn, you);
        you.setMyDock(yourn, this);
        if (this.cShape && (myn == 1) && this.inside.findLast().anEnd) {
            var theend = this.inside.findLast();
            theend.prev.next = null as unknown as Block;
            var last = this.findLast();
            last.next = theend;
            theend.prev = last;
        }
    }

    getMyDock (dockn: number) {
        var myprops: ('prev' | 'inside' | 'next')[] = this.cShape ? ['prev', 'inside', 'next'] : ['prev', 'next'];
        return this[myprops[dockn]];
    }

    setMyDock (dockn: number, you: Block) {
        var myprops: ('prev' | 'inside' | 'next')[] = this.cShape ? ['prev', 'inside', 'next'] : ['prev', 'next'];
        this[myprops[dockn]] = you;
    }

    getMyDockNum (you: Block) {
        var connections = this.cShape ? [this.prev, this.inside, this.next] : [this.prev, this.next];
        return connections.indexOf(you);
    }

    isConnectedAfterFirst (myn: number, you: Block, yourn?: number) {
        if (myn == 0) {
            return false;
        }
        var prev = you.prev;
        if (prev == null) {
            return false;
        }
        if (this == prev) {
            return false;
        }
        var n = prev.getMyDockNum(you);
        var thefirst = this.findFirst();
        thefirst.connectBlock(0, prev, n);
        return true;
    }

    findLast (): Block {
        if (this.next == null) {
            return this;
        }
        return this.next.findLast();
    }

    findFirst (): Block {
        if (this.prev == null) {
            return this;
        }
        return this.prev.findFirst();
    }

    connectLast (myn: number, you: Block, yourn: number) {
        if (myn != 0) {
            return;
        }
        var yourtail = you.getMyDock(yourn);
        var mylast = this.findLast();
        if (yourtail == mylast) {
            return;
        }
        if (this.cShape && (this.inside == null) && (yourtail != null) && !yourtail.anEnd) {
            var lastone = yourtail.findLast();
            this.inside = yourtail;
            yourtail.prev = this;
            if (lastone.anEnd) {
                mylast.next = lastone;
                var striplast = lastone.prev;
                if (striplast) {
                    striplast.next = null as unknown as Block;
                }
                lastone.prev = mylast;
            }
        } else {
            mylast.next = yourtail;
            if (yourtail == null) {
                return;
            }
            yourtail.prev = mylast;
        }
    }

    detachBlock () {
        var you = this.prev;
        if (you == null) {
            return;
        }
        this.prev = null as unknown as Block;
        if ((you.cShape) && (you.inside == this)) {
            you.inside = null as unknown as Block;
        } else {
            you.next = null as unknown as Block;
        }
    }

    //////////////////////////////////////////
    // Move
    /////////////////////////////////////////

    moveBlock (dx: number, dy: number) {
        this.div.top = dy;
        this.div.left = dx;
        this.div.style.webkitTransform = 'translate3d(' + this.div.left + 'px,' + this.div.top + 'px, 0)';
    }


    /////////////////////////////////
    // Forever and Repeat
    ////////////////////////////////

    // Repeat size 176 by 82

    redrawRepeat () {
        this.redrawShape(this.blockshape, this.image);
        if (this.blocktype.indexOf('caret') < 0) {
            this.redrawShape(this.shadow, this.shadowimg);
        }

        if (this.blocktype.indexOf('caret') > -1) {
            return;
        }
        var dx = this.blockshape.width / window.devicePixelRatio - 78 * this.scale;
        var dy = this.blockshape.height / window.devicePixelRatio - 82 * this.scale;
        this.blockicon.style.left = dx + 'px';
        this.arg.div.style.left = (this.blockshape.width / window.devicePixelRatio - 66 * this.scale) + 'px';
        this.blockicon.style.top = dy + 'px';
        this.arg.div.style.top = (this.blockshape.height / window.devicePixelRatio - 11 * this.scale) + 'px';
    }

    redrawShape (cnv: HTMLCanvasElement, img: HTMLImageElement) {
        setCanvasSize(this.div,
            (92 + this.hrubberband + 84) * this.scale,
            (100 + this.vrubberband) * this.scale);
        var scaleAndRatio = this.scale * window.devicePixelRatio;
        setCanvasSize(cnv,
            (92 + this.hrubberband + 84) * scaleAndRatio,
            (82 + this.vrubberband) * scaleAndRatio);
        setProps(cnv.style, {
            webkitTransform: dprCenterTransform(cnv.width, cnv.height)
        });
        var ctx = cnv.getContext('2d')!;
        // top line
        ctx.drawImage(img, 0, 0, 92, 29, 0, 0, 92 * scaleAndRatio, 29 * scaleAndRatio);
        ctx.drawImage(img, 92, 0, 1, 29, 92 * scaleAndRatio, 0, this.hrubberband * scaleAndRatio, 29 * scaleAndRatio);
        ctx.drawImage(img, 93, 0, img.width - 93, 29, 92 * scaleAndRatio + this.hrubberband * scaleAndRatio, 0, 83 * scaleAndRatio, 29 * scaleAndRatio);

        // height streach
        ctx.drawImage(img, 0, 29, 92, 1, 0, 29 * scaleAndRatio, 92 * scaleAndRatio, this.vrubberband * scaleAndRatio);
        ctx.drawImage(img, 93, 29, img.width - 93, 1, 92 * scaleAndRatio + this.hrubberband * scaleAndRatio, 29 * scaleAndRatio, 83 * scaleAndRatio, this.vrubberband * scaleAndRatio);

        // bottom
        ctx.drawImage(img, 0, 29, 45, 53, 0, 29 * scaleAndRatio + this.vrubberband * scaleAndRatio, 45 * scaleAndRatio, 53 * scaleAndRatio);
        ctx.drawImage(img, 93, 29, img.width - 93, 53, 92 * scaleAndRatio + this.hrubberband * scaleAndRatio, 29 * scaleAndRatio + this.vrubberband * scaleAndRatio, 83 * scaleAndRatio, 53 * scaleAndRatio);
    }
}
