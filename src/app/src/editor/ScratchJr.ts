import Project from './ui/Project';
import type Sprite from './engine/Sprite';
import type Scripts from './ui/Scripts';
import type Stage from './engine/Stage';
import type Page from './engine/Page';
import type BlockArg from './blocks/BlockArg';
import type Block from './blocks/Block';
import ScratchAudio from '../utils/ScratchAudio';
import Paint from '../painteditor/Paint';
import Prims from './engine/Prims';
import Undo from './ui/Undo';
import Alert from './ui/Alert';
import Palette from './ui/Palette';
import Record from './ui/Record';
import IO from '../iPad/IO';
import iOS from '../iPad/iOS';
import UI from './ui/UI';
import Menu from './blocks/Menu';
import Library from './ui/Library';
import Grid from './ui/Grid';
import ScriptsPane from './ui/ScriptsPane';
import Events from '../utils/Events';
import BlockSpecs from './blocks/BlockSpecs';
import Runtime from './engine/Runtime';
import Localization from '../utils/Localization';
import {libInit, gn, scaleMultiplier, newHTML,
    isAndroid, getUrlVars, CSSTransition3D, frame} from '../utils/lib';

const bridge = window.scratchjr!;

// Named-form access
const namedForms = document.forms as unknown as {
    editable: HTMLFormElement & { field: HTMLInputElement };
    activetextbox: HTMLFormElement & { typing: HTMLInputElement };
    projectname: HTMLFormElement & { myproject: HTMLInputElement };
};

let workingCanvas = document.createElement('canvas');
let workingCanvas2 = document.createElement('canvas');
// BlockArg carries two keypad/field expandos (oldvalue, delta) the class does not declare
type ActiveFocusArg = BlockArg & { oldvalue?: string; delta: number };
let activeFocus: ActiveFocusArg | undefined;
let changed = false;
// Our behavior for story-starters are slightly different from changed
// e.g. moving a script around doesn't "start a story" while we would want it
// to save a normal user project.
let storyStarted = false;
let runtime: Runtime;
let stage: Stage;
let inFullscreen = false;
let keypad: HTMLElement;
let textForm: HTMLFormElement;
let editfirst = false;
let stagecolor: string;
let defaultSprite: string;

///////////////////////////////////////////
//Layers definitions for the whole site
///////////////////////////////////////////

//layaring variables
let layerTop = 10;
let layerAboveBottom = 4;
let dragginLayer = 7000;

let currentProject: string | undefined;
let editmode: string;

let isDebugging = false;
let time: number;
let userStart = false;
let onHold = false;
let shaking: HTMLElement | undefined;
let stopShaking: ((b: HTMLElement) => void) | undefined;
let version: string;

let autoSaveEnabled = true;
let autoSaveSetInterval: number | null = null;

let onBackButtonCallback: Array<() => void> = [];

export default class ScratchJr {
    static get workingCanvas () {
        return workingCanvas;
    }

    static get workingCanvas2 () {
        return workingCanvas2;
    }

    static get activeFocus () {
        return activeFocus;
    }

    static set activeFocus (newActiveFocus: ActiveFocusArg | undefined) {
        activeFocus = newActiveFocus;
    }

    static set changed (newChanged: boolean) {
        changed = newChanged;
    }

    static set storyStarted (newStoryStarted: boolean) {
        storyStarted = newStoryStarted;
    }

    static get runtime () {
        return runtime;
    }

    static get stage () {
        return stage;
    }

    static set stage (newStage: Stage) {
        stage = newStage;
    }

    static get inFullscreen () {
        return inFullscreen;
    }


    static get stagecolor () {
        return stagecolor;
    }

    static get defaultSprite () {
        return defaultSprite;
    }

    static get layerTop () {
        return layerTop;
    }

    static get layerAboveBottom () {
        return layerAboveBottom;
    }

    static get dragginLayer () {
        return dragginLayer;
    }

    static get currentProject () {
        return currentProject;
    }

    static set currentProject (newValue: string | undefined) {
        currentProject = newValue;
    }

    static get editmode () {
        return editmode;
    }

    static set editmode (newEditmode: string) {
        editmode = newEditmode;
    }

    static set time (newTime: number) {
        time = newTime;
    }

    static set userStart (newUserStart: boolean) {
        userStart = newUserStart;
    }

    static get onHold () {
        return onHold;
    }

    static set onHold (newOnHold: boolean) {
        onHold = newOnHold;
    }

    static get shaking () {
        return shaking;
    }

    static set shaking (newShaking: HTMLElement | undefined) {
        shaking = newShaking;
    }

    static get stopShaking () {
        return stopShaking;
    }

    static set stopShaking (newStopShaking: ((b: HTMLElement) => void) | undefined) {
        stopShaking = newStopShaking;
    }

    static get version () {
        return version;
    }

    static get onBackButtonCallback () {
        return onBackButtonCallback;
    }

    static appinit (v: string) {
        stagecolor = window.Settings!.stageColor;
        defaultSprite = window.Settings!.defaultSprite;
        version = v;
        document.body.scrollTop = 0;
        time = Date.now();
        var urlvars = getUrlVars();
        iOS.hascamera();
        ScratchJr.log('starting the app');
        BlockSpecs.initBlocks();
        Project.loadIcon = document.createElement('img');
        Project.loadIcon.src = 'assets/loading.png';
        ScratchJr.log('blocks init', ScratchJr.getTime(), 'sec', BlockSpecs.loadCount);
        currentProject = urlvars.pmd5;
        editmode = urlvars.mode;
        libInit();
        Project.init();
        ScratchJr.log('Start ui init', ScratchJr.getTime(), 'sec');
        Project.setProgress(10);
        ScratchAudio.init();
        Library.init();
        Paint.init();
        Record.init();
        Prims.init();
        runtime = new Runtime();
        Undo.init();
        ScratchJr.editorEvents();
        Project.load(currentProject);
        Events.init();
        if (window.Settings!.autoSaveInterval > 0) {
            autoSaveSetInterval = window.setInterval(function () {
                const projectWithSaving = Project as unknown as { saving: boolean };
        if (autoSaveEnabled && !onHold && !projectWithSaving.saving && !UI.infoBoxOpen) {
                    ScratchJr.saveProject(null, function () {
                        Alert.close();
                    });
                }
            }, window.Settings!.autoSaveInterval);
        }
    }

    // Event handler for when a story is started
    // When called and enabled, this will trigger sample projects to save copies
    // Here for debugging, run-time filtering, etc.
    static storyStart (_eventName: string) {
        // console.log("Story started: " + eventName);
        storyStarted = true;
    }

    static editorEvents () {
        document.ongesturestart = undefined;
        document.onmousemove = function (e: MouseEvent) {
            e.preventDefault();
        };
        window.onmousedown = ScratchJr.unfocus;
        window.onmouseup = null;
    }

    static unfocus (evt?: Event) {
        if (Palette.helpballoon) {
            Palette.helpballoon.parentNode!.removeChild(Palette.helpballoon);
            Palette.helpballoon = null;
        }
        if (namedForms.editable) {
            if (evt && (evt.target == namedForms.editable.field)) {
                return;
            } // block is being edit
        }
        if (namedForms.activetextbox) {
            if (evt && (evt.target == namedForms.activetextbox.typing)) {
                return;
            } // stage text box
        }
        if (namedForms.projectname) {
            if (evt && (evt.target == namedForms.projectname.myproject)) {
                return;
            } // infobox text box
        }
        if (document.activeElement!.tagName.toLowerCase() == 'input') {
            (document.activeElement! as HTMLElement).blur();
        }
        ScratchJr.clearSelection();
        ScratchJr.blur();
    }

    static clearSelection () {
        if (shaking) {
            stopShaking!(shaking);
        }
    }

    static blur () {
        if (ScratchAudio.firstTime) {
            ScratchAudio.firstClick();
        }
        ScratchJr.editDone();
        Menu.closeMyOpenMenu();
    }

    static getSprite () {
        if (!stage.currentPage.currentSpriteName) {
            return undefined;
        }
        if (!gn(stage.currentPage.currentSpriteName)!) {
            return undefined;
        }
        return gn(stage.currentPage.currentSpriteName)!.owner;
    }

    static gestureStart (e: Event) {
        e.preventDefault();
        if (ScratchAudio.firstTime) {
            ScratchAudio.firstClick();
        }
    }

    static log (...args: unknown[]) {
        if (!isDebugging) {
            return;
        }
        console.log(args); //eslint-disable-line no-console
    }

    static getTime () {
        return (Date.now() - time) / 1000;
    }

    static isSampleOrStarter () {
        return editmode == 'look' || editmode == 'storyStarter';
    }
    static isEditable () {
        return editmode != 'look';
    }

    // Called when ScratchJr is brought back to focus
    // Here, we fix up some UI elements that may not have been properly shut down when the app was paused.
    // Note that on Android Lollipop and up we have much more limited
    // opportunity to save progress, etc. before the app is
    // paused, and so we just suspend the whole webview and then restore it here.
    static onResume () {
        // no nothing special, for now.
        if (Record.dialogOpen) {
            Record.recordError();
        }

        // Re-enable autosaves
        autoSaveEnabled = true;
        autoSaveSetInterval = window.setInterval(function () {
            const projectWithSaving = Project as unknown as { saving: boolean };
        if (autoSaveEnabled && !onHold && !projectWithSaving.saving && !UI.infoBoxOpen) {
                ScratchJr.saveProject(null, function () {
                    Alert.close();
                });
            }
        }, window.Settings!.autoSaveInterval);
    }

    static onPause () {
        autoSaveEnabled = false;
        window.clearInterval(autoSaveSetInterval!);
    }

    static saveProject (e: Event | null, onDone: () => void) {
        if (ScratchJr.isEditable() && editmode == 'storyStarter' && storyStarted && !Project.error) {
            iOS.analyticsEvent('samples', 'story_starter_edited', Project.metadata!.name as string);
            // Localize sample project names
            var sampleName = Localization.localize('SAMPLE_' + Project.metadata!.name);
            // Get the new project name
            IO.uniqueProjectName({
                name: sampleName
            }, function (jsonData: any) {
                var newName = jsonData.name;
                Project.metadata!.name = newName;
                // Create the new project
                IO.createProject({
                    name: newName,
                    version: version,
                    mtime: (new Date()).getTime().toString()
                }, function (md5: unknown) {
                    // Save project data
                    currentProject = md5 as string;
                    // Switch out of story-starter mode to avoid creating new projects
                    editmode = 'edit';
                    Project.prepareToSave(currentProject, onDone);
                });
            }, true);
        } else if (ScratchJr.isEditable() && currentProject && !Project.error && changed) {
            Project.prepareToSave(currentProject, onDone);
        } else {
            if (onDone) {
                onDone();
            }
        }
    }

    static saveAndFlip (e: Event){
        onHold = true;
        ScratchJr.stopStripsFromTop(e);
        ScratchJr.unfocus(e);
        ScratchJr.saveProject(e, ScratchJr.flippage);
    }

    static flippage () {
        Alert.close();
        iOS.cleanassets('wav', doNext);
        function doNext () {
            iOS.cleanassets('svg', ScratchJr.switchPage);
        }
    }

    static switchPage () {
        window.location.href = ScratchJr.getGotoLink();
    }

    static getGotoLink () {
        if (editmode == 'storyStarter') {
            if (!storyStarted) {
                return 'home.html?place=help';
            } else {
                return 'home.html?place=home';
            }
        }

        if (!currentProject) {
            return 'home.html?place=home';
        }

        if (Project.metadata!.gallery == 'samples') {
            return 'home.html?place=help';
        } else {
            return 'home.html?place=home&timestamp=' + new Date().getTime();
        }
    }

    static updateRunStopButtons () {
        var isOff = runtime.inactive();
        if (inFullscreen) {
            gn('go')!.className = isOff ? 'go on presentationmode' : 'go off presentationmode';
            UI.updatePageControls();
        } else {
            gn('go')!.className = isOff ? 'go on' : 'go off';
            Grid.updateCursor();
        }
        if (ScratchJr.getSprite()) {
            if (isOff && !inFullscreen) {
                (ScratchJr.getSprite() as Sprite).select();
            } else {
                (ScratchJr.getSprite() as Sprite).unselect();
            }
        }
        if (isOff && userStart) {
            stage.currentPage.updateThumb();
            //	ScratchJr.log ('total time', ScratchJr.getTime(), 'sec');
            userStart = false;
        }
    }

    static runStrips (e: Event) {
        ScratchJr.stopStripsFromTop(e);
        ScratchJr.unfocus(e);
        ScratchJr.startGreenFlagThreads();
        userStart = true;
    //  time = (new Date()) - 0;
    }

    static startGreenFlagThreads () {
        ScratchJr.resetSprites();
        ScratchJr.startCurrentPageStrips(['onflag', 'ontouch']);
    }

    static startCurrentPageStrips (list: string[]) {
        var page = stage.currentPage.div;
        for (var i = 0; i < page.childElementCount; i++) {
            var spr = page.childNodes[i].owner as Sprite;
            if (!spr) {
                continue;
            }
            if (!gn(spr.id + '_scripts')!) {
                continue;
            } // text case
            ScratchJr.startScriptsFor(spr, list);
        }
    }

    static startScriptsFor (spr: Sprite, list: string[]) {
        var sc = gn(spr.id + '_scripts')!;
        const scriptsOwner = sc.owner as Scripts;
        var topblocks = scriptsOwner.getBlocksType(list);
        for (var j = 0; j < topblocks.length; j++) {
            var b = topblocks[j];
            runtime.addRunScript(spr, b);
        }
    }

    static stopStripsFromTop (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.unfocus(e);
        ScratchJr.stopStrips();
        userStart = false;
    }

    static stopStrips () {
        runtime.stopThreads();
        stage.currentPage.updateThumb();
    }

    static resetSprites () {
        stage.resetPage(stage.currentPage);
    }

    static fullScreen (e: Event) {
        if (gn('full')!.className == 'fullscreen') {
            onBackButtonCallback.push(function () {
                var fakeEvent = document.createEvent('TouchEvent');
                (fakeEvent as TouchEvent & { initTouchEvent: () => void }).initTouchEvent();
                ScratchJr.quitFullScreen(fakeEvent);
            });

            ScratchJr.enterFullScreen(e);
        } else {
            ScratchJr.quitFullScreen(e);
        }
    }

    static displayStatus (type: string) {
        var ids = ['topsection', 'blockspalette', 'scripts', 'flip', 'projectinfo'];
        for (var i = 0; i < ids.length; i++) {
            if (gn(ids[i])!) {
                gn(ids[i])!.style.display = type;
            }
        }
    }

    static enterFullScreen (e: Event) {
        if (onHold) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.unfocus(e);
        ScratchJr.displayStatus('none');
        inFullscreen = true;
        UI.enterFullScreen();
        iOS.analyticsEvent('editor', 'full_screen_entered');
        document.body.style.background = 'black';
    }

    static quitFullScreen (e: Event) {
        //  time = (new Date()) - 0;
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.displayStatus('block');
        inFullscreen = false;
        UI.quitFullScreen();
        onBackButtonCallback.pop();
        document.body.style.background = 'white';
    }

    /////////////////////////////////////////
    //UI calls
    /////////////////////////////////////////

    static getActiveScript () {
        var str = stage.currentPage.currentSpriteName + '_scripts';
        return gn(str)!;
    }

    static getBlocks () {
        return (ScratchJr.getActiveScript().owner as Scripts).getBlocks();
    }

    /////////////////////////////////////////////////
    //Setup editable field


    static setupEditableField () {
        textForm = newHTML('form', 'textform', frame) as HTMLFormElement;
        textForm.name = 'editable';
        var ti = newHTML('input', 'textinput', textForm) as HTMLInputElement;
        ti.name = 'field';
        ti.onkeypress = function (evt: KeyboardEvent) {
            handleKeyPress(evt);
        };
        textForm.onsubmit = function (evt: Event) {
            submitOverride(evt);
        };
        function handleKeyPress (e: KeyboardEvent) {
            var key = e.keyCode || e.which;
            if (key == 13) {
                submitOverride(e);
            }
        }
        function submitOverride (e: Event) {
            e.preventDefault();
            e.stopPropagation();
            var input = e.target as HTMLInputElement; // the editable field input
            input.blur();

            // Hitting enter does not trigger editDone()
            // so you need to pop the queue here.
            onBackButtonCallback.pop();
        }
        ti.maxLength = 50;
        ti.onfocus = ScratchJr.handleTextFieldFocus;
        ti.onblur = ScratchJr.handleTextFieldBlur;
    }

    /////////////////////////////////////////////////
    //Argument Clicked


    static editArg (e: Event, ti: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        // arg divs carry their BlockArg in the owner expando (BlockArg.createButton)
        const argOwner = ti ? (ti.owner as BlockArg) : undefined;
        if (argOwner && argOwner.isText()) {
            ScratchJr.textClicked(e, ti);
        } else {
            ScratchJr.numberClicked(e, ti);
        }

        onBackButtonCallback.push(function () {
            ScratchJr.editDone();
        });
    }

    static textClicked (e: Event, div: HTMLElement) {
        var b = div.owner as ActiveFocusArg; // b is a BlockArg
        activeFocus = b;
        var pt = b.getScreenPt();
        var sc = ScratchJr.getActiveScript();
        div = sc.parentNode as HTMLElement;
        var w = div.offsetWidth;
        var h = div.offsetHeight;
        var dx = ((pt.x + 480 * scaleMultiplier) > w) ? (w - 486 * scaleMultiplier) : pt.x - 6 * scaleMultiplier;
        var ti = namedForms.editable.field;
        ti.style.textAlign = 'center';
        namedForms.editable.style.left = dx + 'px';
        var top = pt.y + 55 * scaleMultiplier;
        namedForms.editable.style.top = top + 'px';
        if (isAndroid) {
            AndroidInterface.scratchjr_setsoftkeyboardscrolllocation(
                top * window.devicePixelRatio, (top + h) * window.devicePixelRatio
            );
        }
        namedForms.editable.className = 'textform on';
        ti.value = String(b.argValue);
        if (isAndroid) {
            AndroidInterface.scratchjr_forceShowKeyboard();
        }
        ti.focus();
    }

    static handleTextFieldFocus (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        activeFocus!.oldvalue = activeFocus!.input.textContent;
    }

    static handleTextFieldBlur (e: Event) {
        onBackButtonCallback.pop();
        e.preventDefault();
        e.stopPropagation();
        var focus = activeFocus!; // set by textClicked before the field gains focus
        var ti = namedForms.editable.field;
        var str = ti.value.substring(0, ti.maxLength);
        focus.argValue = str;
        focus.setValue(str);
        namedForms.editable.className = 'textform off';
        if (focus.daddy.div.parentNode) {
            var spr = (focus.daddy.div.parentNode.owner as Scripts).spr;
            var action = {
                action: 'scripts',
                where: (spr.div.parentNode!.owner as Page).id,
                who: spr.id
            };
            if (focus.input.textContent != focus.oldvalue) {
                Undo.record(action);
                ScratchJr.storyStart('ScratchJr.handleTextFieldBlur');
            }
        }
        activeFocus = undefined;
        document.body.scrollTop = 0;
        document.body.scrollLeft = 0;
        if (isAndroid) {
            AndroidInterface.scratchjr_forceHideKeyboard();
        }
    }

    /////////////////////////////////////////
    //Numeric keyboard
    /////////////////////////////////////////

    static setupKeypad () {
        keypad = newHTML('div', 'picokeyboard', frame);
        keypad.onmousedown = ScratchJr.eatEvent;
        var pad = newHTML('div', 'insidekeyboard', keypad);
        for (var i = 1; i < 10; i++) {
            ScratchJr.keyboardAddKey(pad, i, 'onekey');
        }
        ScratchJr.keyboardAddKey(pad, '-', 'onekey minus');
        //  ScratchJr.keyboardAddKey (pad, undefined, 'onekey space');
        ScratchJr.keyboardAddKey(pad, '0', 'onekey');
        ScratchJr.keyboardAddKey(pad, undefined, 'onekey delete');
    //  var keym = newHTML("div", 'onkey' ,pad);
   
       
        // special request bugfix - handle keyboard input in the number window.
    	document.addEventListener('keydown', ScratchJr.onNumberKeyDown);
    	 	
    }
    
    static isNumberPadKeyCode(e: KeyboardEvent) {
    	return (isFinite(Number(e.key)) || e.keyCode == 8 /*delete*/ || e.keyCode === 46 /*backspace*/);
    }
    static onNumberKeyDown(e: KeyboardEvent) {
    	
    	
    	if (ScratchJr.isNumberPadKeyCode(e) && document.getElementsByClassName('picokeyboard on').length > 0) {
    	
    	    e.preventDefault();
			e.stopPropagation();
			if (e.keyCode == 8 /*delete*/ || e.keyCode === 46 /*backspace*/) {
				ScratchJr.numEditDelete();
			} else {
				const newChar = e.key;
				var input = activeFocus!.input;
			
				var val = input.textContent;
				if (editfirst) {
					editfirst = false;
					val = '0';
				}
				
				if (val == '0') {
					val = newChar;
				} else {
					val += newChar;
				}
				if ((Number(val).toString() != 'NaN') && ((Number(val) > 99) || (Number(val) < -99))) {
					ScratchAudio.sndFX('boing.wav');
				} else {
					activeFocus!.setValue(val);

				}
			
			}
		
    	}
    	
    }

    static eatEvent (e: Event) {
        e.preventDefault();
        e.stopPropagation();
    }

    static keyboardAddKey (p: HTMLElement, str: number | string | undefined, c: string) {
        var keym = newHTML('div', c, p);
        var mk = newHTML('span', undefined, keym);
        mk.textContent = str ? String(str) : '';
        keym.onmousedown = ScratchJr.numEditKey;
    }


    /////////////////////////////////////////////////
    //Number Clicked


    static numberClicked (e: Event, ti: HTMLElement) {
        var delta = (activeFocus) ? activeFocus.delta : 0;
        if (activeFocus && (activeFocus.type == 'blockarg')) {
            activeFocus.div.className = 'numfield off';
            ScratchJr.numEditDone();
        }
        var b = ti.owner as ActiveFocusArg; // b is a BlockArg
        activeFocus = b;
        activeFocus.delta = delta;
        b.oldvalue = ti.textContent;
        activeFocus.div.className = 'numfield on';
        keypad.className = 'picokeyboard on';
        editfirst = true;
        var p = ti.parentNode!.parentNode!.owner as Block; // the block div owner expando
        if (Number(p.min) < 0) {
            ScratchJr.setMinusKey();
        } else {
            ScratchJr.setSpaceKey();
        }
        if (delta == 0) {
            ScratchJr.needsToScroll(b);
        }
    }

    static needsToScroll (b: BlockArg) {
        // needs scroll
        var look = ScratchJr.getActiveScript(); // look canvas
        var dx = b.daddy.div.left! + b.daddy.div.offsetWidth + look.left!;
        var w = window.innerWidth - keypad.offsetWidth - 10;
        var delta = (dx > w) ? (w - dx) : 0;
        if (delta < 0) {
            var transition = {
                duration: 0.5,
                transition: 'ease-out',
                style: {
                    left: (look.left! + delta) + 'px'
                },
                onComplete: function () {
                    ScriptsPane.scroll!.refresh();
                }
            };
            CSSTransition3D(look, transition);
        }
        activeFocus!.delta = delta;
    }

    static numEditKey (e: Event) {
        e.preventDefault();
        e.stopPropagation();
        var t = e.target as HTMLElement; // keypad keys are div/span elements
        if (!t) {
            return;
        }
        if (t.className == '') {
            t = t.parentNode as HTMLElement;
        }
        if (t.className != 'onekey space') {
            ScratchAudio.sndFX('keydown.wav');
        }
        var c = t.textContent;
        var input = activeFocus!.input;
        if (!c) {
            const parent = t.parentNode as HTMLElement; // keypad key container
            if ((parent.className == 'onekey delete') || (t.className == 'onekey delete')) {
                ScratchJr.numEditDelete();
            }
            return;
        }
        var val = input.textContent;
        if (editfirst) {
            editfirst = false;
            val = '0';
        }
        if ((c == '-') && (val != '0')) {
            ScratchAudio.sndFX('boing.wav');
            return;
        }
        if (val == '0') {
            val = c;
        } else {
            val += c;
        }
        if ((Number(val).toString() != 'NaN') && ((Number(val) > 99) || (Number(val) < -99))) {
            ScratchAudio.sndFX('boing.wav');
        } else {
            activeFocus!.setValue(val);
        }
    }

    static setSpaceKey () {
        const row = keypad.childNodes[0] as HTMLElement; // keypad number row
        const key = row.childNodes[9] as HTMLElement; // tenth key is the space/minus key
        key.className = 'onekey space';
        key.childNodes[0].textContent = '';
    }

    static setMinusKey () {
        const row = keypad.childNodes[0] as HTMLElement; // keypad number row
        const key = row.childNodes[9] as HTMLElement; // tenth key is the space/minus key
        key.className = 'onekey minus';
        key.childNodes[0].textContent = '-';
    }

    static validateNumber (val: string | number): number {
        return Number(val);
    }

    static revokeInput (val: string) {
        return val;
    }

    static numEditDelete () {
        var val = activeFocus!.input.textContent;
        if (val.length != 0) {
            val = val.substring(0, val.length - 1);
        }
        if (val.length == 0) {
            val = '0';
        }
        activeFocus!.setValue(val);
    }

    static editDone () {
        if (document.activeElement!.tagName === 'INPUT') {
            (document.activeElement! as HTMLElement).blur();
        }
        if (activeFocus == undefined) {
            return;
        }
        if (activeFocus.type != 'blockarg') {
            return;
        }
        if (activeFocus.isText()) {
            namedForms.editable.field.blur();
        } else {
            ScratchJr.closeNumberEdit();
            onBackButtonCallback.pop();
        }
    }

    static closeNumberEdit () {
        ScratchJr.numEditDone();
        ScratchJr.resetScroll();
        keypad.className = 'picokeyboard off';
        activeFocus!.div.className = 'numfield off';
        activeFocus = undefined;
    }

    static numEditDone () {
        var val: string | number = activeFocus!.input.textContent ?? '';
        if (val == '-') {
            val = 0;
        }
        if (val == '-0') {
            val = 0;
        }
        val = ScratchJr.validateNumber(val);
        var ba = activeFocus!;
        activeFocus!.setValue(parseFloat(String(val)));
        ba.argValue = val;
        if (ba.daddy && ba.daddy.div.parentNode!.owner) {
            var spr = (ba.daddy.div.parentNode!.owner as Scripts).spr;
            if (spr && spr.div.parentNode) {
                var action = {
                    action: 'scripts',
                    where: (spr.div.parentNode!.owner as Page).id,
                    who: spr.id
                };
                if (ba.argValue != ba.oldvalue) {
                    ScratchJr.storyStart('ScratchJr.numEditDone');
                    Undo.record(action);
                }
            }
        }
    }

    static resetScroll () {
        var delta = activeFocus!.delta;
        if (delta < 0) {
            var look = ScratchJr.getActiveScript(); // look canvas
            var transition = {
                duration: 0.5,
                transition: 'ease-out',
                style: {
                    left: (look.left! - delta) + 'px'
                },
                onComplete: function () {
                    ScriptsPane.scroll!.refresh();
                }
            };
            CSSTransition3D(look, transition);
        }
    }

    static validate (str: string, name: string) {
        var str2 = str.replace(/\s*/g, '');
        if (str2.length == 0) {
            return name;
        }
        return str;
    }

    /////////////////
    //Application on the background


    // XXX: does this ever happen?
    // I'm pretty sure this is dead code -TM
    static saveProjectState () {
        ScratchAudio.sndFX('tap.wav');
        if (frame.style.display == 'none') {
            Paint.saveEditState(ScratchJr.stopServer);
        } else {
            ScratchJr.unfocus();
            ScratchJr.stopStrips();
            if (ScratchJr.isEditable() && currentProject && !Project.error && changed) {
                Project.save(currentProject, ScratchJr.stopServer);
            }
        }
    }

    static stopServer () {
        iOS.stopserver(iOS.trace);
    }

    /**
     * The functions that are invokved when the Android back button is clicked.
     * Methods are called from the rear and popped off after each invocation.
     */


    /**
     * Handles updating the UI when the Android back button is clicked.  This
     * method invokes the methods defined at {@link onBackButtonCallback}
     * if not empty, otherwise it invokes {@link ScratchJr.saveAndFlip}.  The
     * back button callback is set by UI components when they initialize a modal
     * or popup, so it is the responsibility of popup components to correctly cleanup
     * the onBackButtonCallback.
     */
    static goBack () {
        if (onBackButtonCallback.length === 0) {
            var e = document.createEvent('TouchEvent') as TouchEvent & { initTouchEvent: () => void };
            e.initTouchEvent();
            e.preventDefault();
            e.stopPropagation();
            ScratchJr.saveAndFlip(e);
        } else {
            var callbackReference = onBackButtonCallback[onBackButtonCallback.length - 1];
            callbackReference();
        }
    }
}

bridge.onAppClose(function() {
    // save the project, then tell electron that it can exit
    ScratchJr.saveProject(null, function () {
        bridge.sendAppClosedAcked();
    });
});
