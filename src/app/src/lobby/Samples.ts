//////////////////////////////////////////////////
// Samples Screen
//////////////////////////////////////////////////

import Lobby from './Lobby.js';
import IO from '../iPad/IO';
import iOS from '../iPad/iOS';
import MediaLib from '../iPad/MediaLib';
import ScratchAudio from '../utils/ScratchAudio';
import Localization from '../utils/Localization';
import {gn, newHTML} from '../utils/lib';

let frame: HTMLElement;
// Should ScratchJr projects be saved when the sample project is changed?
// Enabled for the PBS version; disabled for the ScratchJr version
// window.Settings.useStoryStarters

export default class Samples {
    static init () {
        frame = gn('htmlcontents')!;
        gn('tabicon')!.onmousedown = Samples.playHowTo;
        var div = newHTML('div', 'samples off', frame);
        div.setAttribute('id', 'samples');
        Samples.display('samples');
    }

    ////////////////////////////
    // Show Me How
    ////////////////////////////

    static playHowTo (e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        ScratchAudio.sndFX('tap.wav');
        window.location.href = 'gettingstarted.html?place=help';
    }

    ////////////////////////////
    // Learn Samples
    ////////////////////////////

    static display (key: string) {
        var files = MediaLib[key as keyof typeof MediaLib] as string[];
        var div = gn(key)!;
        for (var i = 0; i < files.length; i++) {
            Samples.addLink(div, i, files[i]);
            Samples.requestFromServer(i, files[i], displayThumb);
        }
        function displayThumb (pos: number, str: string) {
            var mt = gn('sample-' + pos)!;
            var data = IO.parseProjectData(JSON.parse(str)[0]);
            var name = mt.childNodes[1];

            // Localize sample project names
            var sampleName = (typeof data.name === 'string') ? data.name : '';
            sampleName = Localization.localize('SAMPLE_' + sampleName);

            name.textContent = sampleName;
            var cnv = mt.childNodes[0].childNodes[1];
            Samples.insertThumbnail(cnv as HTMLElement, data.thumbnail as { md5?: string; pagecount?: number });
            mt.onclick = function (evt) {
                Samples.loadMe(evt, mt);
            };
        }
        setTimeout(Samples.show, 10);
    }

    static show () {
        Lobby.busy = false;
        (frame.parentNode as HTMLElement).scrollTop = 0;
        gn('samples')!.className = 'samples on';
    }

    static loadMe (e: MouseEvent, mt: HTMLElement) {
        e.preventDefault();
        e.stopPropagation();
        ScratchAudio.sndFX('tap.wav');
        iOS.analyticsEvent('samples', 'sample_opened', mt.textContent);
        var md5 = mt.md5;
        window.location.href = 'editor.html?pmd5=' + md5 + '&mode='
            + ((window.Settings!.useStoryStarters) ? 'storyStarter' : 'look');
    }

    static insertThumbnail (img: HTMLElement, data: { md5?: string; pagecount?: number }) {
        var md5 = data.md5;
        if (md5) {
            img.style.backgroundImage = 'url(\'' + md5 + '\')';
        }
    }

    static addLink (parent: HTMLElement, pos: number, md5: string) {
        var tb = newHTML('div', 'samplethumb', parent) as ThumbElement;
        tb.setAttribute('id', 'sample-' + pos);
        tb.md5 = md5;
        tb.type = 'samplethumb';
        var mt = newHTML('div', 'thumb pos' + pos, tb);
        newHTML('div', 'woodframe', mt);
        newHTML('div', 'sampleicon', mt);
        var name = newHTML('p', undefined, tb);
        name.textContent = 'Sample ' + pos;
    }

    static requestFromServer (pos: number, url: string, whenDone: (pos: number, str: string) => void) {
        var xmlrequest = new XMLHttpRequest();
        xmlrequest.addEventListener('error', transferFailed, false);
        xmlrequest.onreadystatechange = function () {
            if (xmlrequest.readyState == 4) {
                whenDone(pos, xmlrequest.responseText);
            }
        };
        xmlrequest.open('GET', url, true);
        xmlrequest.send(null);
        function transferFailed (e: Event) {
            e.preventDefault();
            e.stopPropagation();
            // Failed loading
        }
    }
}
