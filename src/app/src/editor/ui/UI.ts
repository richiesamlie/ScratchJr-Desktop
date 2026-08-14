//////////////////////////////////////
//  General UI Layout
/////////////////////////////////////

import ScratchJr from '../ScratchJr';
import BlockSpecs from '../blocks/BlockSpecs';
import Alert from './Alert';
import Project from './Project';
import Thumbs from './Thumbs';
import Palette from './Palette';
import type Sprite from '../engine/Sprite';
import type Page from '../engine/Page';
import Grid from './Grid';
import Stage from '../engine/Stage';
import ScriptsPane from './ScriptsPane';
import Undo from './Undo';
import Library from './Library';
import iOS from '../../iPad/iOS';
import IO from '../../iPad/IO';
import MediaLib from '../../iPad/MediaLib';
import Paint from '../../painteditor/Paint';
import Events from '../../utils/Events';
import Localization from '../../utils/Localization';
import ScratchAudio from '../../utils/ScratchAudio';
import {frame, gn, localx, newHTML, scaleMultiplier, getIdFor, isTouch, newDiv,
    newTextInput, isAndroid, getDocumentWidth, getDocumentHeight, setProps, globalx} from '../../utils/lib';

// Named-form access: document.forms.projectname.myproject
const namedForms = document.forms as unknown as Record<string, HTMLFormElement & Record<string, HTMLInputElement>>;

let projectNameTextInput: (HTMLInputElement & { oldvalue: string }) | null = null;
let info: HTMLElement | null = null;
let okclicky: HTMLElement | null = null;
let infoBoxOpen = false;

export default class UI {
    // Static DOM handles
    static nextpage: HTMLElement;
    static prevpage: HTMLElement;

    static get infoBoxOpen () {
        return infoBoxOpen;
    }
    
    static layout () {
        UI.topSection();
        UI.middleSection();
        UI.BottomSection();
        UI.fullscreenControls();
        UI.createFormForText(frame);
        ScratchJr.setupKeypad();
        ScratchJr.setupEditableField();
        UI.aspectRatioAdjustment();
    }

    // Helps debug on Android 4.2 by enabling the user to type in a
    // JavaScript expression and evaluate the output and render to console.log.
    /*static addDebugControl () {
        var div = newHTML('div', 'debug', document.body);
        setProps(div.style, {
            position: 'absolute',
            left: '0px',
            top: '0px',
            width: '64px',
            height: '64px',
            background: 'red',
            zIndex: 30000
        });
        div.onmousedown = function (e) {
            console.log(eval(prompt('Enter Debug JavaScript')));
        };
    }*/

    /** Tweak some elements depending on aspect ratio */
    static aspectRatioAdjustment () {
        var library = gn('library')!;
        var pages = gn('pages')!;
        var stage = gn('stage')!;
        var topsection = gn('topsection')!;
        var pagecc = gn('pagecc')!;
        var scripts = gn('scripts')!;
        if (!library || !pages || !stage) {
            return;
        }

        var leftPanel = library.parentNode as HTMLElement;
        var rightPanel = pages.parentNode as HTMLElement;
        var stageframe = gn('stageframe')!;

        // Clear previous adjustments
        library.style.transform = '';
        pages.style.transform = '';
        if (topsection) { topsection.style.height = ''; }
        if (leftPanel) { leftPanel.style.height = ''; }
        if (rightPanel) { rightPanel.style.height = ''; rightPanel.style.width = ''; rightPanel.style.top = ''; }
        if (stageframe) { stageframe.style.height = ''; }
        if (pagecc) { pagecc.style.height = ''; pagecc.style.width = ''; }
        if (pages) { pages.style.width = ''; }
        if (scripts) { scripts.style.height = ''; }

        var docWidth = getDocumentWidth();
        var docHeight = getDocumentHeight();
        var aspect = docWidth / docHeight;
        if (aspect <= 1.45) {
            return;
        }

        // Make storyboard wider but keep clear from stage controls.
        var newRightWidth = Math.round(docHeight * 0.225);
        if (rightPanel) {
            rightPanel.style.width = newRightWidth + 'px';
        }
        pages.style.width = newRightWidth + 'px';
        if (pagecc) {
            pagecc.style.width = newRightWidth + 'px';
        }

        // --- Horizontal balancing ---
        var stageBox = stage.getBoundingClientRect();
        var libraryBox = library.getBoundingClientRect();
        var pagesBox = pages.getBoundingClientRect();
        var leftGap = stageBox.left - (libraryBox.left + libraryBox.width);
        var rightGap = pagesBox.left - (stageBox.left + stageBox.width);
        var desiredGap = Math.min(130, Math.round(docWidth * 0.07));

        var libraryShift = Math.max(0, Math.round(leftGap - desiredGap));
        var pagesShift = Math.max(0, Math.round(rightGap - desiredGap));

        libraryShift = Math.min(libraryShift, Math.round(docWidth * 0.16));
        pagesShift = Math.min(pagesShift, Math.round(docWidth * 0.10));

        if (libraryShift > 0) {
            library.style.transform = 'translateX(' + libraryShift + 'px)';
        }
        if (pagesShift > 0) {
            pages.style.transform = 'translateX(-' + pagesShift + 'px)';
        }

        // --- Vertical balance ---
        // Reserve enough room for the coding workspace before sizing the stage.
        // This is especially important on wide desktop windows where a fixed
        // minimum stage height can otherwise squeeze scripts into a tiny strip.
        var blockspalette = gn('blockspalette')!;
        var desiredScriptsHeight = Math.max(260, Math.round(docHeight * 0.30));
        var maxTopHeight = docHeight - blockspalette.offsetHeight - desiredScriptsHeight;
        var targetTopHeight = Math.round(docHeight * 0.57);
        targetTopHeight = Math.min(Math.max(420, targetTopHeight), maxTopHeight);
        if (topsection) { topsection.style.height = targetTopHeight + 'px'; }
        if (leftPanel) { leftPanel.style.height = targetTopHeight + 'px'; }
        var rightPanelTop = Math.round(12 * scaleMultiplier);
        if (rightPanel) {
            rightPanel.style.top = rightPanelTop + 'px';
            rightPanel.style.height = Math.max(200, targetTopHeight - rightPanelTop) + 'px';
        }
        if (stageframe) { stageframe.style.height = targetTopHeight + 'px'; }
        if (pagecc) {
            var pagesVisibleHeight = Math.max(0, pages.offsetHeight - pagecc.offsetTop - Math.round(12 * scaleMultiplier));
            pagecc.style.height = pagesVisibleHeight + 'px';
        }
        if (scripts) {
            var scriptsHeight = Math.max(220, docHeight - scripts.offsetTop);
            if (ScriptsPane.scroll) {
                ScriptsPane.resizeScripts(scriptsHeight);
                if (ScratchJr.stage && ScratchJr.stage.currentPage) {
                    ScriptsPane.scroll!.refresh();
                }
            }
        }
    }

    static topSection () {
        var div = newHTML('div', 'topsection', frame);
        div.setAttribute('id', 'topsection');
        if (ScratchJr.isEditable()) {
            UI.addProjectInfo();
        }
        UI.leftPanel(div);
        UI.stageArea(div);
        UI.rightPanel(div);
    }

    static leftPanel (div: HTMLElement) {
        // sprite library
        var sl = newHTML('div', 'leftpanel', div);
        var flip = newHTML('div', 'flipme', sl);
        flip.setAttribute('id', 'flip');
        flip.onmousedown = function (evt: MouseEvent) {
            ScratchJr.saveAndFlip(evt);
        }; // move to project
        UI.layoutLibrary(sl);
    }

    static middleSection () {
        var bp = newHTML('div', 'blockspalette', frame);
        bp.setAttribute('id', 'blockspalette');
        Palette.setup(bp);
        Undo.setup(bp);
    }

    static BottomSection () {
        ScriptsPane.createScripts(frame);
    }

    static addProjectInfo () {
        info = newHTML('div', 'info', frame);
        info!.setAttribute('id', 'projectinfo');
        var infobox = newHTML('div', 'infobox fade', frame);
        infobox.setAttribute('id', 'infobox');
        okclicky = newHTML('div', 'paintdone', infobox);
        newHTML('div', 'infoboxlogo', infobox);
        var nameField = UI.addEditableName(infobox);
        var staticinfo = newHTML('div', 'fixedinfo', infobox);
        var author = newHTML('div', 'infolabel', staticinfo);
        author.setAttribute('id', 'deviceName');

        if (window.Settings!.shareEnabled) {
            // Sharing
            var shareButtons = newHTML('div', 'infoboxShareButtons', infobox);

            var shareEmail = newHTML('div', 'infoboxShareButton', shareButtons);
            shareEmail.id = 'infoboxShareButtonEmail';
            shareEmail.textContent = Localization.localize('SHARING_BY_EMAIL');

            if (isAndroid) {
                shareEmail.style.margin = 'auto';
            } else {
                shareEmail.style.float = 'left';
            }

            if (!isAndroid) {
                var shareAirdrop = newHTML('div', 'infoboxShareButton', shareButtons);
                shareAirdrop.id = 'infoboxShareButtonAirdrop';
                shareAirdrop.textContent = Localization.localize('SHARING_BY_AIRDROP');
                shareAirdrop.style.float = 'right';
                shareAirdrop.onmousedown = function (e: MouseEvent) {
                    UI.parentalGate(e, function (e: MouseEvent) {
                        UI.infoDoShare(e, nameField, shareLoadingGif, 1);
                    });
                };
            }

            iOS.deviceName(function (name) {
                gn('deviceName')!.textContent = name;
            });

            var shareLoadingGif = newHTML('img', 'infoboxShareLoading', shareButtons) as HTMLImageElement;
            shareLoadingGif.src = './assets/ui/loader.png';

            shareEmail.onmousedown = function (e: MouseEvent) {
                UI.parentalGate(e, function (e: MouseEvent) {
                    UI.infoDoShare(e, nameField, shareLoadingGif, 0);
                });
            };
        }

        info!.onmousedown = UI.showInfoBox;
        okclicky!.onmousedown = function (evt) {
            UI.hideInfoBox(evt, nameField);
        };
    }

    static parentalGate (evt: MouseEvent | null, callback: (e: MouseEvent) => void) {
        ScratchAudio.sndFX('tap.wav');
        var pgFrame = newHTML('div', 'parentalgate', gn('frame')!);

        var pgCloseButton = newHTML('div', 'paintdone', pgFrame);
        pgCloseButton.onmousedown = function () {
            parentalGateClose(false);
        };

        var pgProblem = newHTML('div', 'parentalgateproblem', pgFrame);
        var pgChoiceA = newHTML('div', 'parentalgatechoice', pgFrame);
        var pgChoiceB = newHTML('div', 'parentalgatechoice', pgFrame);
        var pgChoiceC = newHTML('div', 'parentalgatechoice', pgFrame);

        var problems: Array<[string, string, string, string, number]> = [
            // Problem, Choice A, Choice B, Choice C, Correct choice #
            ['30 + 7', '37', '9', '28', 0],
            ['22 + 3', '18', '25', '3', 1],
            ['91 + 1', '32', '74', '92', 2],
            ['30 + 4', '34', '59', '12', 0],
            ['48 + 1', '9', '49', '20', 1],
            ['32 + 6', '23', '99', '38', 2],
            ['53 + 4', '57', '12', '90', 0],
            ['26 + 3', '17', '29', '8', 1],
            ['71 + 1', '58', '14', '72', 2],
            ['11 + 8', '19', '23', '67', 0]
        ];

        var problemChoice = Math.floor(Math.random() * problems.length);
        var theProblem = problems[problemChoice];

        pgProblem.textContent = theProblem[0];
        pgChoiceA.textContent = theProblem[1];
        pgChoiceB.textContent = theProblem[2];
        pgChoiceC.textContent = theProblem[3];

        pgChoiceA.onmousedown = function () {
            parentalGateClose(theProblem[4] == 0);
        };
        pgChoiceB.onmousedown = function () {
            parentalGateClose(theProblem[4] == 1);
        };
        pgChoiceC.onmousedown = function () {
            parentalGateClose(theProblem[4] == 2);
        };


        var pgExplain = newHTML('div', 'parentalgateexplain', pgFrame);
        pgExplain.textContent = Localization.localize('PARENTAL_GATE_EXPLANATION');

        function parentalGateClose (success: boolean) {
            ScratchAudio.sndFX('exittap.wav');
            gn('frame')!.removeChild(pgFrame);
            if (success) {
                callback(evt as MouseEvent);
            }
        }
    }

    /*
    +    Save the project, including the new name, then package the project and send native-side for sharing
    +
    +    evt: reference to touch event triggering share
    +    nameField: reference to the project rename field
    +    shareLoadingGif: reference to HTML element to show during packaging/loading and hide for completion
    +    shareType: which dialog to show - 0 for email; 1 for airdrop
    + */

    static infoDoShare (evt: MouseEvent, nameField: HTMLInputElement, shareLoadingGif: HTMLElement, shareType: number) {
        ScratchAudio.sndFX('tap.wav');
        shareLoadingGif.style.visibility = 'visible';
        nameField.blur(); // Hide the keyboard for name changes

        setTimeout(saveAndShare, 500); // 500ms delay to wait for loading GIF to show and keyboard to hide

        iOS.analyticsEvent('editor', 'share_button', (shareType == 0) ? 'email' : 'airdrop');

        function saveAndShare () {
            // Save the project's new name
            UI.handleTextFieldSave(true);

            // Save any changes made to the project
            ScratchJr.onHold = true; // Freeze the editing UI
            ScratchJr.stopStripsFromTop(evt);

            Project.prepareToSave(ScratchJr.currentProject!, function () {
                Alert.close();

                // Package the project as a .sjr file
                IO.zipProject(ScratchJr.currentProject!, function (contents: string) {
                    ScratchJr.onHold = false; // Unfreeze the editing UI
                    var emailSubject = Localization.localize('SHARING_EMAIL_SUBJECT', {
                        PROJECT_NAME: IO.shareName
                    });
                    // iOS signature declares string; the bridge receives the numeric share type (0 email / 1 airdrop)
                    iOS.sendSjrToShareDialog(IO.zipFileName, emailSubject, Localization.localize('SHARING_EMAIL_TEXT'), shareType as unknown as string, contents);

                    shareLoadingGif.style.visibility = 'hidden';
                });
            });
        }
    }


    static addEditableName (p: HTMLElement) {
        var pname = newHTML('form', 'projectname', p) as HTMLFormElement;
        pname.name = 'projectname';
        pname.id = 'title';
        pname.onsubmit = function (evt: SubmitEvent) {
            submitChange(evt);
        };
        var ti = newHTML('input', 'pnamefield', pname) as HTMLInputElement & { oldvalue: string };
        projectNameTextInput = ti;
        ti.name = 'myproject';
        ti.maxLength = 30;
        ti.onkeypress = null;
        ti.autocomplete = 'off';
        ti.autocorrect = false;
        ti.onblur = null;
        ti.onfocus = function (e: FocusEvent) {
            e.preventDefault();
            ti.oldvalue = ti.value;
            if (isAndroid) {
                AndroidInterface.scratchjr_setsoftkeyboardscrolllocation(
                    ti.getBoundingClientRect().top * devicePixelRatio,
                    ti.getBoundingClientRect().bottom * devicePixelRatio
                );
                AndroidInterface.scratchjr_forceShowKeyboard();
            }
        };
        ti.onkeypress = function (evt: KeyboardEvent) {
            handleNamePress(evt);
        };
        function handleNamePress (e: KeyboardEvent) {
            var key = e.keyCode || e.which;
            if (key == 13) {
                submitChange(e);
            }
        }
        function submitChange (e: Event) {
            e.preventDefault();
            var input = e.target as HTMLElement;
            input.blur();
        }
        return ti;
    }

    static handleTextFieldSave (dontHide?: boolean) {
        // Handle story-starter mode project
        if (ScratchJr.isEditable() && ScratchJr.editmode == 'storyStarter' && !Project.error) {
            iOS.analyticsEvent('samples', 'story_starter_edited', Project.metadata!.name as string);
            // Get the new project name
            var sampleName = Localization.localize('SAMPLE_' + Project.metadata!.name);
            IO.uniqueProjectName({
                name: sampleName
            }, function (jsonData) {
                var newName = jsonData.name;
                Project.metadata!.name = newName;
                // Create the new project
                IO.createProject({
                    name: newName,
                    version: ScratchJr.version,
                    mtime: (new Date()).getTime().toString()
                }, function (md5: unknown) {
                    Project.metadata!.id = md5;
                    ScratchJr.currentProject = md5 as string;
                    ScratchJr.editmode = 'edit';
                    Project.metadata!.gallery = '';
                    UI.finishTextFieldSave(dontHide);
                });
            });
        } else {
            UI.finishTextFieldSave(dontHide);
        }
    }

    static finishTextFieldSave (dontHide?: boolean) {
        var ti = projectNameTextInput!;
        var pname = (ti.value.length == 0) ? ti.oldvalue : ti.value.substring(0, ti.maxLength);
        if (Project.metadata!.name != pname) {
            ScratchJr.storyStart('UI.handleTextFieldSave');
        }
        Project.metadata!.name = pname;
        ScratchJr.changed = true;
        iOS.setfield(iOS.database, Project.metadata!.id as string, 'name', pname);
        if (!dontHide) {
            ScratchAudio.sndFX('exittap.wav');
            gn('infobox')!.className = 'infobox fade';
        }
    }

    static showInfoBox (e: Event) {
        infoBoxOpen = true;
        e.preventDefault();
        e.stopPropagation();
        if (Paint.saving) {
            return;
        }
        if (ScratchJr.onHold) {
            return;
        }

        // Prevent button from thrashing
        setTimeout(function () {
            projectNameTextInput!.onblur = function () {
                if (isAndroid) {
                    AndroidInterface.scratchjr_forceHideKeyboard();
                }
            };
        }, 500);
        projectNameTextInput!.onblur = function () {
            if (ScratchJr.isEditable()) {
                namedForms.projectname.myproject.focus();
            }
        };
        info!.onmousedown = null;

        ScratchJr.onBackButtonCallback.push(function () {
            var e2 = document.createEvent('TouchEvent');
            (e2 as TouchEvent & { initTouchEvent: () => void }).initTouchEvent();
            e2.preventDefault();
            e2.stopPropagation();
            UI.hideInfoBox(e2);
        });

        ScratchAudio.sndFX('entertap.wav');
        ScratchJr.stopStrips();
        if (!Project.metadata!.ctime) {
            Project.metadata!.mtime = (new Date()).getTime();
            Project.metadata!.ctime = UI.formatTime((new Date()).getTime());
        }

        if (ScratchJr.isEditable()) {
            namedForms.projectname.myproject.value = Project.metadata!.name;
        } else {
            gn('pname')!.textContent = String(Project.metadata!.name);
        }
        gn('infobox')!.className = 'infobox fade in';
        if (ScratchJr.isEditable()) {
            setTimeout(function () {
                //(document.forms["projectname"]["myproject"]).focus();
            }, 500);
        }
    }

    static formatTime (unixtime: number) {
        var date = new Date(unixtime);
        var year = date.getFullYear();
        var month = date.getMonth() + 1;
        var day = date.getDate();
        var hour = date.getHours();
        var min = date.getMinutes();
        var sec = date.getSeconds();
        return year + '-' + month + '-' + day + ' ' + hour + ':' + min + ':' + sec;
    }

    static hideInfoBox (e: Event, dontHide?: unknown) { // unused flag; legacy callers pass the nameField element
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.onBackButtonCallback.pop();

        // Prevent button thrashing
        setTimeout(function () {
            info!.onmousedown = UI.showInfoBox;
        }, 500);

        if (ScratchJr.isEditable()) {
            namedForms.projectname.myproject.blur();
            UI.handleTextFieldSave();
        } else {
            ScratchAudio.sndFX('exittap.wav');
            gn('infobox')!.className = 'infobox fade';
        }
        infoBoxOpen = false;
    }

    //////////////////////////////////////
    //   Library
    /////////////////////////////////////

    static layoutLibrary (sl: HTMLElement) {
        var sprites = newHTML('div', 'thumbpanel', sl);
        sprites.setAttribute('id', 'library');
        //scrolling area
        var p = newHTML('div', 'spritethumbs', sprites);
        p.onscroll = function () {
            UI.updateSpriteScroll();
        };
        var div = newHTML('div', 'spritecc', p);
        div.setAttribute('id', 'spritecc');
        div.onmousedown = UI.spriteThumbsActions;

        // scrollbar
        var sb = newHTML('div', 'scrollbar', sprites);
        sb.setAttribute('id', 'scrollbar');
        var sbthumb = newHTML('div', 'sbthumb', sb);
        sbthumb.setAttribute('id', 'sbthumb');

        // new sprite
        if (ScratchJr.isEditable()) {
            var ns = newHTML('div', 'addsprite', sprites);
            ns.onmousedown = UI.addSprite;
        }
    }

    static mascotData (page?: Page) {
        var sprAttr: Record<string, unknown> = {
            flip: false,
            angle: 0,
            shown: true,
            type: 'sprite',
            scale: 0.5,
            defaultScale: 0.5,
            speed: 2,
            dirx: 1,
            diry: 1,
            sounds: ['pop.mp3'],
            homex: 240,
            homey: 180,
            xcoor: 240,
            ycoor: 180,
            homeshown: true,
            homeflip: false,
            homescale: 0.5,
            scripts: []
        };
        sprAttr.page = page;
        sprAttr.md5 = ScratchJr.defaultSprite;
        var catkey = (MediaLib.keys as Record<string, { name: string }>)[sprAttr.md5 as string].name;
        sprAttr.id = getIdFor(catkey);
        sprAttr.name = catkey;
        return sprAttr;
    }

    //////////////////////////////////////
    // Scrolling
    //////////////////////////////////////

    static needsScroll () {
        var sc = gn('spritecc')!;
        var p = sc.parentNode as HTMLElement;
        if (((sc.scrollHeight / p.offsetHeight) == 1) || (gn('spritecc')!.childElementCount == 0)) {
            gn('scrollbar')!.setAttribute('class', 'scrollbar off');
        } else {
            gn('scrollbar')!.setAttribute('class', 'scrollbar on');
            UI.updateSpriteScroll();
        }
    }

    static updateSpriteScroll () {
        var sc = gn('spritecc')!;
        var p = sc.parentNode as HTMLElement;
        var dy = -p.scrollTop;
        var top = -dy / (sc.scrollHeight / p.offsetHeight);
        var size = (p.offsetHeight / sc.scrollHeight) * p.offsetHeight;
        var thumb = gn('sbthumb')!;
        thumb.style.height = size + 'px';
        thumb.style.top = top + 'px';
    }

    static spriteInView (spr: Sprite) {
        var sc = gn('spritecc')!;
        var p = sc.parentNode as HTMLElement;
        var achild = spr.thumbnail;
        if (!achild) {
            return;
        }
        var h = p.offsetHeight;
        var scroll = -p.scrollTop;
        var dy = -p.scrollTop;
        if ((achild.offsetTop + achild.offsetHeight + scroll) > h) {
            dy = h - (achild.offsetTop + achild.offsetHeight);
        }
        if (achild.offsetTop <= scroll) {
            dy = achild.offsetTop + scroll;
        }
        if (dy > 0) {
            dy = 0;
        }
        p.scrollTop = -dy;
        UI.needsScroll();
    }

    static resetSpriteLibrary () {
        if (!ScratchJr.getSprite()) {
            return;
        }
        UI.spriteInView(ScratchJr.getSprite() as Sprite);
    }

    ///////////////////////////////////
    // Sprite Thumbs Events
    //////////////////////////////////

    static spriteThumbsActions (e: MouseEvent & { touches?: TouchList }) {
        if (isTouch && e.touches && (e.touches.length > 1)) {
            return;
        }
        if (ScratchJr.onHold) {
            return;
        }
        var t: HTMLElement | null = null;
        var pt = Events.getTargetPoint(e);
        if (window.event) {
            t = window.event.srcElement as HTMLElement;
        } else {
            t = e.target as HTMLElement;
        }
        //	if ((t.nodeName == "INPUT") || (t.nodeName == "FORM")) return;
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.blur();
        t.focus();
        if (t.className == 'brush') {
            UI.putInPaintEditor(e); return;
        }
        var tb = Thumbs.getType(t, 'spritethumb');
        if (!tb) {
            if (ScratchJr.shaking) {
                ScratchJr.clearSelection();
            }
            return;
        }
        var x = localx(t, pt.x);
        if (tb && (x < 70) && ScratchJr.isEditable()) {
            Thumbs.startDragThumb(e, tb);
        } else {
            UI.startSpriteScroll(e, tb);
        }
    }

    static startSpriteScroll (e: MouseEvent, tb: HTMLElement) {
        if (ScratchJr.shaking) {
            ScratchJr.clearSelection();
        }
        if (!tb) {
            return;
        }
        if (gn('scrollbar')!.className == 'scrollbar off') {
            Events.startDrag(e, tb, UI.ignoreEvent, UI.ignoreEvent, UI.ignoreEvent, UI.spriteClicked, ScratchJr.isEditable() ? Thumbs.startCharShaking : undefined);
        } else {
            Events.startDrag(e, tb, UI.prepareToScroll, UI.stopScroll, UI.spriteScolling, UI.spriteClicked, ScratchJr.isEditable() ? Thumbs.startCharShaking : undefined);
        }
    }

    static ignoreEvent (e: MouseEvent | TouchEvent) {
        e.preventDefault();
        e.stopPropagation();
    }

    static prepareToScroll (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        UI.spriteScolling(e, Events.dragthumbnail);
    }

    static stopScroll (e: MouseEvent | TouchEvent) {
        e.preventDefault();
        e.stopPropagation();
        UI.spriteScolling(e, Events.dragthumbnail);
    }

    static spriteScolling (e: MouseEvent | TouchEvent, c?: HTMLElement) {
        var pt = Events.getTargetPoint(e);
        var deltay = Events.dragmousey - pt.y;
        Events.dragmousey = pt.y;
        var sc = gn('spritecc')!;
        var p = sc.parentNode as HTMLElement;
        var dy = -p.scrollTop;
        dy -= deltay;
        if (dy > 0) {
            dy = 0;
        }
        if ((dy + sc.offsetHeight) < p.offsetHeight) {
            dy = p.offsetHeight - sc.offsetHeight;
        }
        p.scrollTop = -dy;
        UI.updateSpriteScroll();
    }

    static spriteClicked (e: MouseEvent | TouchEvent, el: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        var t: HTMLElement | null = null;
        if (window.event) {
            t = window.event.srcElement as HTMLElement;
        } else {
            t = e.target as HTMLElement;
        }
        if (ScratchJr.isEditable() && ScratchJr.getSprite()
            && (((t.className == 'sname') && (el.owner == (ScratchJr.getSprite() as Sprite).id))
            || (t.className == 'brush'))) {
            UI.putInPaintEditor(e);
            return;
        }
        if (el.className.indexOf('shakeme') < 0) {
            el.setAttribute('class', 'spritethumb on');
        }
        Thumbs.clickOnSprite(e, el);
    }

    static putInPaintEditor (e: MouseEvent | TouchEvent) {
        ScratchJr.unfocus(e);
        var s = ScratchJr.getSprite() as Sprite;
        if (!s) {
            return;
        }
        ScratchJr.stopStrips();
        Paint.open(false, s.md5, s.id, s.name, s.defaultScale, Math.round(s.w), Math.round(s.h));
    }

    ///////////////////////////////
    // Setup Stage Variables
    //////////////////////////////

    static stageArea (inner: HTMLElement) {
        var outerDiv = newHTML('div', 'centerpanel', inner);
        var div = newHTML('div', 'stageframe', outerDiv);
        div.setAttribute('id', 'stageframe');
        ScratchJr.stage = new Stage(div);
        Grid.init(div);
        if (ScratchJr.isEditable()) {
            UI.creatTopBarClicky(div, 'addtext', 'addText', UI.addText);
            UI.creatTopBarClicky(div, 'setbkg', 'changeBkg', UI.addBackground);
        }
        UI.creatTopBarClicky(div, 'grid', 'gridToggle off', UI.switchGrid);
        UI.creatTopBarClicky(div, 'go', 'go on', UI.toggleRun);
        UI.creatTopBarClicky(div, 'resetall', 'resetall', UI.resetAllSprites);
        UI.creatTopBarClicky(div, 'full', 'fullscreen', ScratchJr.fullScreen);
        UI.toggleGrid(true);
    }

    static resetAllSprites (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (ScratchJr.onHold) {
            return;
        }
        ScratchAudio.sndFX('tap.wav');
        if (!ScratchJr.runtime.inactive()) {
            ScratchJr.stopStripsFromTop(e);
        }
        ScratchJr.resetSprites();
    }

    static toggleRun (e: MouseEvent) {
        var isOff = ScratchJr.runtime.inactive();
        if (isOff) {
            ScratchJr.runStrips(e);
        } else {
            ScratchJr.stopStripsFromTop(e);
        }
    }

    static switchGrid () {
        ScratchAudio.sndFX('tap.wav');
        UI.toggleGrid(!Grid.hidden);
    }

    static toggleGrid (b: boolean) {
        Grid.hide(b);
        gn('grid')!.className = Grid.hidden ? 'gridToggle off' : 'gridToggle on';
    }

    static creatTopBarClicky (p: HTMLElement, str: string, mstyle: string, fcn: (e: MouseEvent) => void) {
        var toggle = newHTML('div', mstyle, p);
        toggle.onmousedown = fcn;
        toggle.setAttribute('id', str);
    }

    static fullscreenControls () {
        UI.nextpage = newHTML('div', 'nextpage off', frame);
        UI.prevpage = newHTML('div', 'nextpage off', frame);
        UI.nextpage.onmousedown = UI.nextPage;
        UI.prevpage.onmousedown = UI.prevPage;
    }

    static updatePageControls () {
        var n = ScratchJr.stage.pages.indexOf(ScratchJr.stage.currentPage);
        if (n == 0) {
            UI.prevpage.setAttribute('class', 'prevpage off');
        } else {
            UI.prevpage.setAttribute('class', 'prevpage on');
        }
        if (n == (ScratchJr.stage.pages.length - 1)) {
            UI.nextpage.setAttribute('class', 'nextpage off');
        } else {
            UI.nextpage.setAttribute('class', 'nextpage on');
        }
    }

    static nextPage (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        var n = ScratchJr.stage.pages.indexOf(ScratchJr.stage.currentPage);
        n++;
        if (n >= ScratchJr.stage.pages.length) {
            return;
        }
        ScratchJr.stage.setPage(ScratchJr.stage.pages[n], false);
    }

    static prevPage (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        var n = ScratchJr.stage.pages.indexOf(ScratchJr.stage.currentPage);
        if (n < 1) {
            return;
        }
        ScratchJr.stage.setPage(ScratchJr.stage.pages[n - 1], false);
    }

    static enterFullScreen () {
        var w = Math.min(getDocumentWidth(), frame.offsetWidth);
        var h = Math.max(getDocumentHeight(), frame.offsetHeight);
        frame.appendChild(gn('stage')!);
        var list = ['go', 'full'];
        for (var i = 0; i < list.length; i++) {
            gn(list[i])!.className = gn(list[i])!.className + ' presentationmode';
            frame.appendChild(gn(list[i])!);
        }
        const stageOwner = gn('stage')!.owner as Stage;
        var scale = Math.min((w - (136 * scaleMultiplier)) / stageOwner.width, h / stageOwner.height);
        var dx = Math.floor((w - (stageOwner.width * scale)) / 2);
        var dy = Math.floor((h - (stageOwner.height * scale)) / 2);

        ScratchJr.stage.setStageScaleAndPosition(scale, dx / scale, dy / scale);

        stageOwner.currentZoom = Math.floor(scale * 100) / 100;
        gn('stage')!.style.webkitTextSizeAdjust = Math.floor(stageOwner.currentZoom * 100) + '%';
        (document.body.parentNode as HTMLElement).style.background = 'black';
        gn('stage')!.setAttribute('class', 'stage fullscreen');
        UI.nextpage.setAttribute('class', 'nextpage on');
    }

    static quitFullScreen () {
        var div = gn('stageframe')!;
        div.appendChild(gn('stage')!);
        ScratchJr.stage.setStageScaleAndPosition(scaleMultiplier, 46, 74);
        gn('go')!.className = 'go off nopresent';
        div.appendChild(gn('go')!);
        gn('full')!.className = 'fullscreen';
        div.appendChild(gn('full')!);
        const stageOwner = gn('stage')!.owner as Stage;
        stageOwner.currentZoom = 1;
        gn('stage')!.style.webkitTextSizeAdjust = '100%';
        (document.body.parentNode as HTMLElement).style.background = 'none';
        gn('stage')!.setAttribute('class', 'stage normal');
        UI.nextpage.setAttribute('class', 'nextpage off');
        UI.prevpage.setAttribute('class', 'nextpage off');
        ScratchJr.stage.setViewPage(ScratchJr.stage.currentPage);
        Thumbs.updateSprites();
        Thumbs.updatePages();
    }

    //////////////////////////////////////
    //   Right panel
    /////////////////////////////////////

    static rightPanel (div: HTMLElement) {
        var rp = newHTML('div', 'rightpanel', div);
        var tb = newHTML('div', 'pages', rp);
        tb.setAttribute('id', 'pages');
        var ndiv = newHTML('div', 'pagescc', tb);
        ndiv.setAttribute('id', 'pagecc');
    }

    //////////////////////////////////////
    //   Tools
    /////////////////////////////////////

    static layoutToolbar (div: HTMLElement) {
        var h = 56;
        var w = 66 * 2;
        var tb = newDiv(div, 220, 0, w, h, {
            position: 'absolute'
        });
        tb.setAttribute('id', 'toolbar');
        var addt = newHTML('div', 'addText', tb);
        addt.onmousedown = UI.addText;
        var changebkg = newHTML('div', 'changeBkg', tb);
        changebkg.onmousedown = UI.addBackground;
    }

    static addSprite (e: MouseEvent) {
        if (ScratchJr.onHold) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        var pt = Events.getTargetPoint(e);
        if (pt.x > (globalx(e.target as HTMLElement) + 167)) {
            return;
        }
        ScratchAudio.sndFX('tap.wav');
        ScratchJr.stopStrips();
        ScratchJr.unfocus(e);
        if (Events.dragthumbnail) {
            Events.mouseUp(e);
        }
        Library.open('costumes');
    }

    static addBackground (e: MouseEvent) {
        if (ScratchJr.onHold) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        ScratchJr.stopStrips();
        ScratchJr.unfocus(e);
        if (Events.dragthumbnail) {
            Events.mouseUp(e);
        }
        Library.open('backgrounds');
    }

    static addText (e: MouseEvent) {
        if (ScratchJr.onHold) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (isAndroid) {
            if (gn('textbox')!.style.visibility === 'visible') {
                return;
            }
        }
        ScratchJr.unfocus(e);
        ScratchJr.stage.currentPage.createText();
    }

    //////////////////////////////////
    // Key Handling in TextBox
    //////////////////////////////////

    static createFormForText (p: HTMLElement) {
        var tf = newHTML('div', 'pagetext off', p);
        tf.setAttribute('id', 'textbox');
        if (isAndroid) {
            tf.onmousedown = function (e: MouseEvent) {
                e.preventDefault();
            };
        }
        var activetb = newHTML('form', 'pageform', tf) as HTMLFormElement;
        activetb.name = 'activetextbox';
        activetb.id = 'myform';
        activetb.textsprite = null;
        var field = newTextInput(activetb, 'text');
        field.name = 'typing';
        field.setAttribute('class', 'edittext');
        field.maxLength = 50;
        field.onkeypress = null;
        field.autocomplete = 'off';
        field.autocorrect = false;
        field.onblur = null;
        activetb.onsubmit = null;
        var ta = newHTML('div', 'pagetextactions', tf);
        var clicky = newHTML('div', 'fontsizeText off', ta);
        clicky.setAttribute('id', 'fontsizebutton');
        clicky.onmousedown = UI.openFontSizeMenu;
        var col = newHTML('div', 'changecolorText off', ta);
        col.setAttribute('id', 'fontcolorbutton');

        col.onmousedown = UI.topLevelColor;
        UI.createColorMenu(tf);
        UI.createTextSizeMenu(tf);
    }

    static createColorMenu (div: HTMLElement) {
        var swatchlist = BlockSpecs.fontcolors;
        var spal = newHTML('div', 'textuicolormenu off', div);
        spal.setAttribute('id', 'textcolormenu');
        for (var i = 0; i < swatchlist.length; i++) {
            var colour = newHTML('div', 'textcolorbucket', spal);
            // bucket
            var sf = newHTML('div', 'swatchframe', colour);
            var sc = newHTML('div', 'swatchcolor', sf);
            sc.style.background = swatchlist[i];
            //
            sf = newHTML('div', 'splasharea off', colour);
            Paint.setSplashColor(sf, Paint.splash, swatchlist[i]);
            Paint.addImageUrl(sf, Paint.splashshade);
            colour.onmousedown = UI.setTextColor;
        }
        UI.setMenuTextColor(gn('textcolormenu')!.childNodes[9] as HTMLElement);
    }

    static createTextSizeMenu (div: HTMLElement) {
        var sizes = BlockSpecs.fontsizes;
        var spal = newHTML('div', 'textuifont off', div);
        spal.setAttribute('id', 'textfontsizes');
        for (var i = 0; i < sizes.length; i++) {
            var textuisize = newHTML('div', 'textuisize t' + (i + 1), spal) as HTMLElement & { fs?: number };
            textuisize.fs = sizes[i];
            var sf = newHTML('span', undefined, textuisize);
            sf.textContent = 'A';
            textuisize.onmousedown = UI.setTextSize;
        }
        UI.setMenuTextSize(gn('textfontsizes')!.childNodes[5] as HTMLElement & { fs?: number });
    }

    static setMenuTextColor (t: HTMLElement) {
        const colorNode = t.childNodes[0].childNodes[0] as HTMLElement;
        var c = colorNode.style.backgroundColor;
        for (var i = 0; i < gn('textcolormenu')!.childElementCount; i++) {
            const colorMenuChild = gn('textcolormenu')!.childNodes[i] as HTMLElement;
            const colorDot = colorMenuChild.childNodes[0].childNodes[0] as HTMLElement;
            var mycolor = colorDot.style.backgroundColor;
            if (c == mycolor) {
                (colorMenuChild.childNodes[1] as HTMLElement).setAttribute('class', 'splasharea on');
            } else {
                (colorMenuChild.childNodes[1] as HTMLElement).setAttribute('class', 'splasharea off');
            }
        }
    }

    static setMenuTextSize (t: HTMLElement & { fs?: number }) {
        var c = t.fs;
        for (var i = 0; i < gn('textfontsizes')!.childElementCount; i++) {
            var kid = gn('textfontsizes')!.childNodes[i] as HTMLElement & { fs?: number };
            var fs = kid.fs;
            var ckid = kid.className.split(' ')[1];
            if (c == fs) {
                (gn('textfontsizes')!.childNodes[i] as HTMLElement).className = 'textuisize ' + ckid + ' on';
            } else {
                (gn('textfontsizes')!.childNodes[i] as HTMLElement).className = 'textuisize ' + ckid + ' off';
            }
        }
    }

    /////////////////////////////////////////////////////////
    // Text color and size
    /////////////////////////////////////////////////////////

    static topLevelColor (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (gn('fontcolorbutton')!.className == 'changecolorText on') {
            gn('fontcolorbutton')!.className = 'changecolorText off';
            gn('textcolormenu')!.className = 'textuicolormenu off';
        } else {
            gn('fontsizebutton')!.className = 'fontsizeText off';
            gn('textfontsizes')!.className = 'textuifont off';
            var text = namedForms.activetextbox.textsprite;
            // Legacy: indexOf over the sprite object never matches (always -1)
            var indx = BlockSpecs.fontcolors.indexOf(text as unknown as string);
            if (indx > -1) {
                UI.setMenuTextColor(gn('textcolormenu')!.childNodes[indx] as HTMLElement);
            }
            gn('textcolormenu')!.className = 'textuicolormenu on';
            gn('fontcolorbutton')!.className = 'changecolorText on';
        }
    }

    static setTextColor (e: MouseEvent & { touches?: TouchList }) {
        if (e.touches && (e.touches.length > 1)) {
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        let t: HTMLElement | null = null;
        if (window.event) {
            t = window.event.srcElement as HTMLElement;
        } else {
            t = e.target as HTMLElement;
        }
        var b: boolean | HTMLElement | null = 'textcolorbucket' != t.className;
        while (b) {
            t = t!.parentNode as HTMLElement | null;
            b = t && ('textcolorbucket' != t.className);
        }
        if (!t) {
            return;
        }
        ScratchAudio.sndFX('splash.wav');
        UI.setMenuTextColor(t);
        var text = namedForms.activetextbox.textsprite;
        var c = (t.childNodes[0].childNodes[0] as HTMLElement).style.background;
        text!.setColor!(c);
        const textOwnerPage = text!.div!.parentNode!.owner as Page;
        Undo.record({
            action: 'edittext',
            where: textOwnerPage.id,
            who: text!.id
        });
        ScratchJr.storyStart('UI.setTextColor'); // Record a change for sample projects in story-starter mode
        var ti = namedForms.activetextbox.typing;
        ti.style.color = c;
    }

    static openFontSizeMenu (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (gn('fontsizebutton')!.className == 'fontsizeText on') {
            gn('fontsizebutton')!.className = 'fontsizeText off';
            gn('textfontsizes')!.className = 'textuifont off';
        } else {
            gn('fontcolorbutton')!.className = 'changecolorText off';
            gn('textcolormenu')!.className = 'textuicolormenu off';
            var text = namedForms.activetextbox.textsprite;
            var indx = BlockSpecs.fontsizes.indexOf(text!.fontsize!);
            if (indx > -1) {
                UI.setMenuTextSize(gn('textfontsizes')!.childNodes[indx] as HTMLElement & { fs?: number });
            }
            gn('textfontsizes')!.className = 'textuifont on';
            gn('fontsizebutton')!.className = 'fontsizeText on';
        }
    }

    static setTextSize (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        var t: (HTMLElement & { fs?: number }) | null = null;
        if (window.event) {
            t = window.event.srcElement as HTMLElement;
        } else {
            t = e.target as HTMLElement;
        }
        if (t.nodeName == 'SPAN') {
            t = t.parentNode as HTMLElement | null;
        }
        if (!t) {
            return;
        }
        var ckid = t.className.split(' ')[0];
        if (ckid != 'textuisize') {
            return;
        }
        UI.setMenuTextSize(t);
        var text = namedForms.activetextbox.textsprite;
        text!.setFontSize!(t.fs!);
        const textOwnerPage = text!.div!.parentNode!.owner as Page;
        Undo.record({
            action: 'edittext',
            where: textOwnerPage.id,
            who: text!.id
        });
        ScratchJr.storyStart('UI.setTextSize'); // Record a change for sample projects in story-starter mode
        var ti = namedForms.activetextbox.typing;
        ti.style.fontSize = (t.fs! * scaleMultiplier) + 'px';
        setProps(namedForms.activetextbox.style, {
            height: ((t.fs! + 10) * scaleMultiplier) + 'px'
        });
    }

    ///////////////////////////////////////////
    // UI clear
    /////////////////////////////////////////

    static clear () {
        var costumes = gn('spritecc')!;
        while (costumes.childElementCount > 0) {
            costumes.removeChild(costumes.childNodes[0]);
        }
        var pthumbs = gn('pagecc')!;
        while (pthumbs.childElementCount > 0) {
            pthumbs.removeChild(pthumbs.childNodes[0]);
        }
    }
}
