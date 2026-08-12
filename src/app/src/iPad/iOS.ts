import {isiOS, gn} from '../utils/lib';
import IO from './IO.js';
import Lobby from '../lobby/Lobby';
import Alert from '../editor/ui/Alert';
import ScratchAudio from '../utils/ScratchAudio';
import AppUsage from '../utils/AppUsage';

//////////////////////////////////////////////////
//  Tablet interface functions
//////////////////////////////////////////////////

// This file and object are named "iOS" for legacy reasons.
// But, it is also used for the AndroidInterface. All function calls here
// are mapped to Android/iOS native calls.

let path: string | undefined;
let camera: string | undefined;
let database = 'projects';
let mediacounter = 0;
let tabletInterface: TabletBridge | null = null;

export default class iOS {
    // Referenced by ScratchJr.stopServer but never defined anywhere in the
    // codebase (pre-existing missing method).
    static stopserver: (fcn?: unknown) => void;

    // Getters/setters for properties used in other classes
    static get path (): string {
        return path!;
    }

    static set path (newPath: string | undefined) {
        path = newPath;
    }

    static get camera (): string {
        return camera!;
    }

    static get database () {
        return database;
    }

    // Wait for the tablet interface to be injected into the webview
    static waitForInterface (fcn: () => void) {
        // Already loaded the interface
        if (tabletInterface != null) {
            fcn();
            return;
        }

        // Android device
        if (typeof AndroidInterface !== 'undefined') {
            tabletInterface = AndroidInterface as unknown as TabletBridge;
            if (fcn) {
                fcn();
            }
            return;
        }

        // iOS device - might not be loaded yet
        if (typeof (window.tablet) != 'object') {
            // Come back in 100ms
            setTimeout(function () {
                iOS.waitForInterface(fcn);
            }, 100);
        } else {
            // All set to run commands
            tabletInterface = window.tablet;
            if (fcn) {
                fcn();
            }
        }
    }

    // Database functions
    static async stmt(json: unknown, fcn?: (result: unknown) => void) {
        var result = await tabletInterface!.database_stmt(JSON.stringify(json));
        if (typeof (fcn) !== 'undefined') {
            fcn(result);
        }
    }

    static async query(json: unknown, fcn: (result: string) => void) {
        var result = await tabletInterface!.database_query(JSON.stringify(json));
        if (typeof (fcn) !== 'undefined') {
            fcn(result as string);
        }
    }

    static setfield (db: string, id: string, fieldname: string, val: string | number | boolean | null, fcn?: (result: unknown) => void) {
        var json: SqlPayload = {};
        var keylist = [fieldname + ' = ?', 'mtime = ?'];
        json.values = [val, (new Date()).getTime().toString()];
        json.stmt = 'update ' + db + ' set ' + keylist.toString() + ' where id = ' + id;
        iOS.stmt(json, fcn);
    }

    // IO functions

    static async cleanassets(ft: string, fcn: () => void) {
        await tabletInterface!.io_cleanassets(ft); fcn();
    }

    static async getmedia(file: string, fcn: (data: string) => void) {
        mediacounter++;
        var nextStep = async function (file: string, key: number, whenDone: (data: string) => void) {
            var result = await tabletInterface!.io_getmedialen(file, String(key));
            iOS.processdata(String(key), 0, result, '', whenDone);
        };
        nextStep(file, mediacounter, fcn);
    }

    static async getmediadata(key: string, offset: number, len: number, fcn?: (result: string) => void) {
        var result = await tabletInterface!.io_getmediadata(key, offset, len);
        if (fcn) {
            fcn(result as string);
        }
    }

    static async processdata(key: string, off: number, len: number, oldstr: string, fcn: (str: string) => void) {
        if (len == 0) {
            iOS.getmediadone(key);
            fcn(oldstr);
            return;
        }
        var newlen = (len < 100000) ? len : 100000;
        iOS.getmediadata(key, off, newlen, function (str) {
            iOS.processdata(key, off + newlen, len - newlen, oldstr + str, fcn);
        });
    }

    static async getsettings(fcn: (settings: string) => void) {
        var result = await tabletInterface!.io_getsettings();
        if (fcn) {
            fcn(result);
        }
    }

	
    static async getmediadone(file: string, fcn?: (result: unknown) => void) {
        var result = await tabletInterface!.io_getmediadone(file);
        if (fcn) {
            fcn(result);
        }
    }

	

    static async setmedia(str: string, ext: string, fcn?: (result: string) => void) {
        var result = await tabletInterface!.io_setmedia(str, ext);
        if (fcn) {
            fcn(result as string);
        }
    }

    static async setmedianame(str: string, name: string, ext: string, fcn?: (result: unknown) => void) {
        var result = await tabletInterface!.io_setmedianame(str, name, ext);
        if (fcn) {
            fcn(result);
        }
    }

    static async getmd5(str: string, fcn?: (result: string | null) => void) {
        var result = await tabletInterface!.io_getmd5(str);
        if (fcn) {
            fcn(result);
        }
    }

    static async remove(str: string, fcn?: (result: unknown) => void) {
        var result = await tabletInterface!.io_remove(str);
        if (fcn) {
            fcn(result);
        }
    }

    static async getfile(str: string, fcn?: (result: string) => void) {
        var result = await tabletInterface!.io_getfile(str);
        if (fcn) {
            fcn(result);
        }
    }

		
	static async gettextresource(filename: string, fcn?: (result: string) => void) {
        var result = await tabletInterface!.io_gettextresource(filename);
        if (fcn) {
            fcn(result);
        }
    }

    static async setfile(name: string, str: string | number, fcn?: (result: unknown) => void) {
        var result = await tabletInterface!.io_setfile(name, btoa(String(str)));
        if (fcn) {
            fcn(result);
        }
    }

    // Sound functions

    static registerSound (dir: string, name: string, fcn?: (result: unknown) => void) {
        var result = tabletInterface!.io_registersound(dir, name);
        if (fcn) {
            fcn(result);
        }
    }

    static playSound (name: string, fcn?: (result: unknown) => void) {
        var result = tabletInterface!.io_playsound(name);
        if (fcn) {
            fcn(result);
        }
    }

    static stopSound (name: string, fcn?: (result: unknown) => void) {
        var result = tabletInterface!.io_stopsound(name);
        if (fcn) {
            fcn(result);
        }
    }

    // Web Wiew delegate call backs

    static soundDone (name: string) {
        ScratchAudio.soundDone(name);
    }

    static sndrecord (fcn?: (result: unknown) => void) {
        var result = tabletInterface!.recordsound_recordstart();
        if (fcn) {
            fcn(result);
        }
    }

    static recordstop (fcn?: (result: unknown) => void) {
        var result = tabletInterface!.recordsound_recordstop();
        if (fcn) {
            fcn(result);
        }
    }

    static volume (fcn?: (result: number) => void, err?: unknown) {
        var result = tabletInterface!.recordsound_volume();
        if (fcn) {
            fcn(result);
        }
    }

    static startplay (fcn?: (result: number) => void) {
        // Native returns the playback duration; the Electron stub returns void
        var result = tabletInterface!.recordsound_startplay() as unknown as number;
        if (fcn) {
            fcn(result);
        }
    }

    static stopplay (fcn?: (result: unknown) => void) {
        var result = tabletInterface!.recordsound_stopplay();
        if (fcn) {
            fcn(result);
        }
    }

    static recorddisappear (b: string, fcn?: (result: unknown) => void) {
        var result = tabletInterface!.recordsound_recordclose(b as unknown as boolean);
        if (fcn) {
            fcn(result);
        }
    }

    // Record state
    static askpermission () {
        if (isiOS) {
            tabletInterface!.askForPermission();
        }
    }

    // camera functions

    static hascamera () {
        camera = tabletInterface!.scratchjr_cameracheck() as string;
    }

    static startfeed (data: unknown, fcn?: (result: unknown) => void) {
        var str = JSON.stringify(data);
        var result = tabletInterface!.scratchjr_startfeed(str);
        if (fcn) {
            fcn(result);
        }
    }

    static stopfeed (fcn?: (result: unknown) => void) {
        var result = tabletInterface!.scratchjr_stopfeed();
        if (fcn) {
            fcn(result);
        }
    }

    static choosecamera (mode: string, fcn: unknown) {
        var result = tabletInterface!.scratchjr_choosecamera(mode);
        if (fcn) {
            (fcn as (result: unknown) => void)(result);
        }
    }

    static captureimage (fcn: unknown) {
        // Legacy: callers pass a callback name string; the bridge expects a function
        tabletInterface!.scratchjr_captureimage(fcn as () => void);
    }

    static hidesplash (fcn?: () => void) {
        if (isiOS) {
            tabletInterface!.hideSplash();
        }
        if (fcn) {
            fcn();
        }
    }

    static trace (str: unknown) {
        console.log(str); // eslint-disable-line no-console
    }

    static parse (str: string) {
        console.log(JSON.parse(str)); // eslint-disable-line no-console
    }

    static tracemedia (str: string) {
        console.log(atob(str)); // eslint-disable-line no-console
    }

    ignore () {
    }

    ///////////////
    // Sharing
    ///////////////


    // Called on the JS side to trigger native UI for project sharing.
    // fileName: name for the file to share
    // emailSubject: subject text to use for an email
    // emailBody: body HTML to use for an email
    // shareType: 0 for Email; 1 for Airdrop
    // b64data: base-64 encoded .SJR file to share

    static sendSjrToShareDialog (fileName: string, emailSubject: string, emailBody: string, shareType: string, b64data: string) {
        const bridge = tabletInterface as unknown as {
            sendSjrUsingShareDialog: (fileName: string, emailSubject: string, emailBody: string, shareType: string, b64data: string) => void;
        };
        bridge.sendSjrUsingShareDialog(fileName, emailSubject, emailBody, shareType, b64data);
    }

    // Called on the Objective-C side.  The argument is a base64-encoded .SJR file,
    // to be unzipped, processed, and stored.
    static loadProjectFromSjr (b64data: string) {
        try {
            IO.loadProjectFromSjr(b64data);
        } catch (err) {
            var errorMessage = 'Couldn\'t load share -- project data corrupted. ' + (err as Error).message;
            Alert.open(gn('frame')!, gn('frame')!, errorMessage, '#ff0000');
            console.log(err); // eslint-disable-line no-console
            return 0;
        }
        return 1;
    }

    // Name of the device/iPad to display on the sharing dialog page
    // fcn is called with the device name as an arg
    static deviceName (fcn: (name: string) => void) {
        fcn(tabletInterface!.deviceName());
    }

    static analyticsEvent (category: string, action: string, label?: string, value?: number) {
        if (!value) {
            value = 1;
        }
        let usageLabel = label ? AppUsage.currentUsage + label : AppUsage.currentUsage;
        tabletInterface!.analyticsEvent(category, action, usageLabel, value);
    }

    // Web Wiew delegate call backs

    static pageError (desc: string) {
        console.log('XCODE ERROR:', desc); // eslint-disable-line no-console
        if (window.location.href.indexOf('home.html') > -1) {
            if (Lobby.errorTimer) {
                Lobby.errorLoading(desc);
            }
        }
    }
}

// Expose iOS methods for ScratchJr tablet sharing callbacks
window.iOS = iOS;
