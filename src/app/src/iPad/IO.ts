import JSZip from 'jszip';

import iOS from './iOS.js';
import MediaLib from './MediaLib.js';
import {setCanvasSize, drawThumbnail, gn} from '../utils/lib';
import Lobby from '../lobby/Lobby';
import SVG2Canvas from '../utils/SVG2Canvas';

const database = 'projects';
const collectLibraryAssets = false;

// jszip 3.10 typings removed the deprecated sync APIs (load/asText/asBinary);
// they still exist at runtime. Cast once for the sync share-import path.
interface LegacyZipArchive {
    load(data: string, options: { base64: boolean }): void;
    forEach(callback: (relativePath: string, file: LegacyZipEntry) => void): void;
    generate(options: { compression: string }): unknown;
}

interface LegacyZipEntry {
    dir: boolean;
    asText(): string;
    asBinary(): string;
}

// Project row bag as passed between the lobby/editor and the projects table.
// All fields optional: callers construct partial bags and JSON bags are
// structurally compatible (Record<string, unknown>).
interface ProjectRecord {
    name?: string;
    version?: string;
    deleted?: string;
    isgift?: string;
    json?: unknown;
    thumbnail?: unknown;
    id?: string;
    mtime?: string;
}

// Sharing state
let zipFile: JSZip | null = null;
let zipAssetsExpected = 0;
let zipAssetsActual = 0;
let zipFileName = '';
let shareName = '';

export default class IO {
    static get zipFileName () {
        return zipFileName;
    }

    static get shareName () {
        return shareName;
    }

    /**
     * Synchronous requests are normally not recommended, but in this case we're
     * going to file URLs so this should be okay.
     */
    static requestSynchronous (url: string) {
        var request = new XMLHttpRequest();
        request.open('GET', url, false);
        request.send(null);
        if (request.status === 0 || request.status === 200) {
            return request.responseText;
        } else {
            // Failed synchronous loading
            return '';
        }
    }

    static requestFromServer (url: string, whenDone: (result: string) => void) {
      
        iOS.waitForInterface(function() {
        	iOS.gettextresource(url, whenDone);
        });
        
    }

    static getThumbnail (str: string, w: number | string, h: number | string, destw?: number, desth?: number) {
        str = str.replace(/>\s*</g, '><');
        var xmlDoc = new DOMParser().parseFromString(str, 'text/xml');
        var extxml = document.importNode(xmlDoc.documentElement, true);
        if (extxml.childNodes[0].nodeName == '#comment') {
            extxml.removeChild(extxml.childNodes[0]);
        }
        var srccnv = document.createElement('canvas');
        setCanvasSize(srccnv, Number(w), Number(h));
        var ctx = srccnv.getContext('2d')!;
        for (var i = 0; i < extxml.childElementCount; i++) {
            SVG2Canvas.drawLayer(extxml.childNodes[i] as Element, ctx);
        }
        if (!destw || !desth) {
            return srccnv.toDataURL('image/png');
        }
        var cnv = document.createElement('canvas');
        setCanvasSize(cnv, destw, desth);
        drawThumbnail(srccnv, cnv);
        return cnv.toDataURL('image/png');
    }

    // in iOS casting an svg url in a img.src works except when the SVG has images.
    // This code avoids that bug
    // also when in debug mode you need to get the base64 to avoid sandboxing issues
    static getAsset (md5: string, fcn: (data: string) => void) { // returns either a link or a base64 dataurl
        if (MediaLib.keys[md5]) {
            fcn(MediaLib.path + md5); return;
        } // just url link assets do not have photos
        if (md5.indexOf('/') > -1) {
            IO.requestFromServer(md5, gotit); // get url contents
            return;
        }
        if ((IO.getExtension(md5) == 'png') && iOS.path) {
            fcn(iOS.path + md5); // only if it is not in debug mode
        } else {
            iOS.getmedia(md5, nextStep);
        } // get url contents

        function gotit (str: string) {
            var base64 = IO.getImageDataURL(md5, btoa(str));
            if (str.indexOf('xlink:href') < 0) {
                fcn(md5); // does not have embedded images
            } else {
                IO.getImagesInSVG(str, function () {
                    fcn(base64);
                });
            } // base64 dataurl
        }

        function nextStep (dataurl: string) { // iOS 7 requires to read the internal base64 images before returning contents
            var str = atob(dataurl);
            if ((str.indexOf('xlink:href') < 0) && iOS.path) {
                fcn(iOS.path + md5); // does not have embedded images
            } else {
                var base64 = IO.getImageDataURL(md5, dataurl);
                IO.getImagesInSVG(str, function () {
                    fcn(base64);
                }); // base64 dataurl
            }
        }
    }

    static getImagesInSVG (str: string, whenDone: () => void) {
        str = str.replace(/>\s*</g, '><');
        if (str.indexOf('xlink:href') < 0) {
            whenDone(); // needs this in case of reading a PNG in debug mode
        } else {
            loadInnerImages(str, whenDone);
        }

        function loadInnerImages (str: string, whenDone: () => void) {
            var xmlDoc: Document | null = new DOMParser().parseFromString(str, 'text/xml');
            var extxml: HTMLElement | null = document.importNode(xmlDoc.documentElement, true);
            if (extxml!.childNodes[0].nodeName == '#comment') {
                extxml!.removeChild(extxml!.childNodes[0]);
            }
            var images = IO.getImages(extxml!, []);
            var imageCount = images.length;
            for (var i = 0; i < images.length; i++) {
                var dataurl = images[i].getAttribute('xlink:href');
                var svgimg = document.createElement('img');
                svgimg.src = dataurl!;
                if (!svgimg.complete) {
                    svgimg.onload = function () {
                        readToLad();
                    };
                } else {
                    readToLad();
                }
            }

            function readToLad () {
                imageCount--;
                if (imageCount < 1) {
                    extxml = null;
                    xmlDoc = null;
                    whenDone();
                }
            }
        }
    }

    static getImages (p: HTMLElement, res: HTMLElement[]) {
        for (var i = 0; i < p.childNodes.length; i++) {
            var elem = p.childNodes[i];
            if (elem.nodeName == 'metadata') {
                continue;
            }
            if (elem.nodeName == 'defs') {
                continue;
            }
            if (elem.nodeName == 'sodipodi:namedview') {
                continue;
            }
            if (elem.nodeName == '#comment') {
                continue;
            }
            if (elem.nodeName == 'image') {
                res.push(elem as HTMLElement);
            }
            if (elem.nodeName == 'g') {
                IO.getImages(elem as HTMLElement, res);
            }
        }
        return res;
    }
    static getImageDataURL (md5: string, data: string) {
        var header = '';
        switch (IO.getExtension(md5)) {
        case 'svg': header = 'data:image/svg+xml;base64,';
            break;
        case 'png': header = 'data:image/png;base64,';
            break;
        }
        return header + data;
    }

    static getObject (md5: string, fcn: (obj: string) => void) {
        if (md5.indexOf('/') > -1) {
            var gotit = function (str: string) {
                fcn(str);
            };
            IO.requestFromServer(md5, gotit);
        } else {
            IO.getObjectinDB(database, md5, fcn);
        }
    }

    static getObjectinDB (db: string, md5: string, fcn: (obj: string) => void) {
        var json: SqlPayload = {};
        json.stmt = 'select * from ' + db + ' where id = ?';
        json.values = [md5];
        iOS.query(json, fcn);
    }

    static setMedia (data: string, type: string, fcn?: (result: string) => void) {
        iOS.setmedia(btoa(data), type, fcn);
    }

    static query (type: string, obj: SqlPayload, fcn: (result: string) => void) {
        var json: SqlPayload = {};
        json.stmt = 'select ' + obj.items!.toString() + ' from ' + type
            + ' where ' + obj.cond! + (obj.order ? ' order by ' + obj.order : '');
        json.values = obj.values;
        iOS.query(json, fcn);
    }

    static deleteobject (type: string, id: string, fcn?: (result: unknown) => void) {
        var json: SqlPayload = {};
        json.stmt = 'delete from ' + type + ' where id = ?';
        json.values = [id];
        iOS.stmt(json, fcn);
    }

    ////////////////////////
    // projects
    ///////////////////////
    /*
        +[id] =>  // SQL ID creates this
        [deleted] =>
        [name] =>
        [json] => project data
        [thumb] =>
        [mtime] => modification time
    */

    static createProject (obj: ProjectRecord, fcn?: (result: unknown) => void) {
        var json: SqlPayload = {};
        var keylist = ['name', 'version', 'deleted', 'mtime', 'isgift'];
        var values = '?,?,?,?,?';
        var mtime = (new Date()).getTime().toString();
        var isGift = obj.isgift ? obj.isgift : '0';
        var projVersion = obj.version || window.Settings?.scratchJrVersion || '1.0.0';
        json.values = [obj.name || 'Project', projVersion, 'NO', mtime, isGift];
        if (obj.json) {
            addValue('json', JSON.stringify(obj.json));
        }
        if (obj.thumbnail) {
            addValue('thumbnail', JSON.stringify(obj.thumbnail));
        }
        json.stmt = 'insert into ' + database + ' (' + keylist.toString() + ') values (' + values + ')';
        iOS.stmt(json, fcn);
        function addValue (key: string, str: string) {
            keylist.push(key);
            values += ',?';
            json.values!.push(str);
        }
    }

    static saveProject (obj: ProjectRecord, fcn?: (result: unknown) => void) {
        try {
            var json: SqlPayload = {};
            var keylist = ['version = ?', 'deleted = ?', 'name = ?', 'json = ?', 'thumbnail = ?', 'mtime = ?'];
            var projVersion = obj.version || window.Settings?.scratchJrVersion || '1.0.0';
            json.values = [projVersion, obj.deleted || 'NO', obj.name || 'Project', JSON.stringify(obj.json),
                JSON.stringify(obj.thumbnail), (new Date()).getTime().toString()];
            json.stmt = 'update ' + database + ' set ' + keylist.toString() + ' where id = ?';
            json.values.push(obj.id!);
            iOS.stmt(json, fcn);
        } catch (e) {
            if (fcn) {
                fcn(-1);
            }
        }
    }

    // Since saveProject is changing the modified time of the project,
    // let's just simply update the isgift flag in a separate function...
    static setProjectIsGift (obj: ProjectRecord, fcn?: (result: unknown) => void) {
        var json: SqlPayload = {};
        var keylist = ['isgift = ?'];
        json.values = [obj.isgift!];
        json.stmt = 'update ' + database + ' set ' + keylist.toString() + ' where id = ?';
        json.values.push(obj.id!);
        iOS.stmt(json, fcn);
    }

    static getExtension (str: string) {
        return str.substring(str.indexOf('.') + 1, str.length);
    }

    static getFilename (str: string) {
        return str.substring(0, str.indexOf('.'));
    }

    static parseProjectData (data: Record<string, unknown>): Record<string, unknown> {
        var res: Record<string, unknown> = {};
        for (var key in data) {
            res[key.toLowerCase()] = data[key];
        }
        return res;
    }

    //////////////////
    // Sharing
    ////////////////////

    static zipProject (projectReference: string, finished: (contents: string) => void) {
        IO.getObject(projectReference, function (projectFromDB: string) {
            var projectMetadata: Record<string, string[]> = {
                'thumbnails': [],
                'characters': [],
                'backgrounds': [],
                'sounds': []
            };
            var jsonData = IO.parseProjectData(JSON.parse(projectFromDB)[0]);

            // Collect project assets for inclusion in zip file
            // Parse JSON representations of project data / thumbnail into usable types
            if (typeof jsonData.json == 'string') {
                jsonData.json = JSON.parse(jsonData.json);
            }
            if (typeof jsonData.thumbnail == 'string') {
                jsonData.thumbnail = JSON.parse(jsonData.thumbnail);
            }

            // Method to determine if a particular asset needs to be collected
            // If it does, save the reference in projectMetadata for collection
            var collectAsset = function (assetType: string, md5: string) {
                if (md5 && (typeof md5 !== 'undefined')) {
                    if (md5.indexOf('samples/') < 0) { // Exclude sample assets
                        if (collectLibraryAssets) {
                            // Behavior if we want to collect and package library assets
                            if (projectMetadata[assetType].indexOf(md5) < 0 && MediaLib.sounds.indexOf(md5) < 0) {
                                projectMetadata[assetType].push(md5);
                            }
                        } else {
                            // Otherwise, first check if it's in the library
                            if (md5 && (typeof md5 !== 'undefined')
                                && !MediaLib.keys[md5] && MediaLib.sounds.indexOf(md5) < 0) {
                                if (projectMetadata[assetType].indexOf(md5) < 0) {
                                    projectMetadata[assetType].push(md5);
                                }
                            }
                        }
                    }
                }
            };

            // Project thumbnail
            const thumbnail = jsonData.thumbnail;
            if (thumbnail && typeof thumbnail === 'object' && 'md5' in thumbnail) {
                collectAsset('thumbnails', thumbnail.md5 as string);
            }

            // Nested project JSON (pages -> sprites) is an opaque bag; page/sprite
            // shapes vary by project version, so index it dynamically.
            var projectData = jsonData.json as Record<string, unknown>;

            // Data for each page
            if (projectData && typeof projectData === 'object' && 'pages' in projectData && Array.isArray(projectData.pages)) {
                var pages = projectData.pages;
                for (var p = 0; p < pages.length; p++) {
                    var pageReference = pages[p];
                    var page = projectData[pageReference] as Record<string, unknown>;

                    // Page background
                    collectAsset('backgrounds', page.md5 as string);

                    // Sprites
                    var sprites = page.sprites as string[];
                    for (var s = 0; s < sprites.length; s++) {
                        var spriteReference = sprites[s];
                        var sprite = page[spriteReference] as Record<string, unknown>;

                        if (sprite.type != 'sprite') {
                            continue;
                        }

                        // Sprite image
                        collectAsset('characters', sprite.md5 as string);

                        // Sprite's recorded sounds
                        var sounds = sprite.sounds as string[];
                        for (var snd = 0; snd < sounds.length; snd++) {
                            collectAsset('sounds', sounds[snd]);
                        }
                    }
                }
            }

            // Get the media in projectMetadata and add it to a zip file
            zipFile = new JSZip();
            zipFile!.folder('project');

            var projectDataForZip = JSON.stringify(jsonData);
            zipFile!.file('project/data.json', projectDataForZip, {});

            zipAssetsExpected = 0;
            zipAssetsActual = 0;

            // Generic function for adding media to the zip file
            var addMediaToZip = function (folder: string, md5: string) {
                var addB64ToZip = function (b64data: string) {
                    zipFile!.file('project/' + folder + '/' + md5, b64data, {
                        base64: true,
                        createFolders: true
                    });
                    zipAssetsActual++;
                };
                // Determine if the md5 is a MediaLib file or a user one, and download it appropriately
                // See also, Sprite.getAsset
                if (md5 in MediaLib.keys) {
                    // Library character
                    IO.requestFromServer(MediaLib.path + md5, function (raw) {
                        addB64ToZip(btoa(raw));
                    });
                } else {
                    // User file
                    iOS.getmedia(md5, addB64ToZip);
                }
            };

            // Add each type of media
            for (var j = 0; j < projectMetadata.thumbnails.length; j++) {
                addMediaToZip('thumbnails', projectMetadata.thumbnails[j]);
                zipAssetsExpected++;
            }

            for (var k = 0; k < projectMetadata.characters.length; k++) {
                addMediaToZip('characters', projectMetadata.characters[k]);
                zipAssetsExpected++;
            }

            for (var l = 0; l < projectMetadata.backgrounds.length; l++) {
                addMediaToZip('backgrounds', projectMetadata.backgrounds[l]);
                zipAssetsExpected++;
            }

            for (var m = 0; m < projectMetadata.sounds.length; m++) {
                addMediaToZip('sounds', projectMetadata.sounds[m]);
                zipAssetsExpected++;
            }

            // Now the UI should wait for actual media count to equal expected media count
            // This could pause if getmedia takes a long time, for example,
            // if we have many large sprites or large sounds

            // strip spaces and sanitize filename, including windows reserved names even though
            // kids are unlikely to name their project lpt1 etc.
            var illegalRe = /[\/\?<>\\:\*\|":]/g;
            var controlRe = /[\x00-\x1f\x80-\x9f]/g;  // eslint-disable-line no-control-regex
            var reservedRe = /^\.+$/;
            var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
            var windowsTrailingRe = /[\. ]+$/;

            const projectName = (typeof jsonData.name === 'string') ? jsonData.name : '';
            zipFileName = projectName.replace(/\s*/g, '');
            zipFileName = zipFileName
                .replace(illegalRe, '_')
                .replace(controlRe, '_')
                .replace(reservedRe, '_')
                .replace(windowsReservedRe, '_')
                .replace(windowsTrailingRe, '_');
            shareName = projectName;

            function checkStatus () {
                if ((zipAssetsActual / zipAssetsExpected) == 1) {
                    finished((zipFile as unknown as LegacyZipArchive).generate({
                        'compression': 'STORE'
                    }) as string);
                } else {
                    setTimeout(checkStatus, 200);
                }
            }
            checkStatus();
        });
    }

    static uniqueProjectName (jsonData: ProjectRecord, callback: (jsonData: ProjectRecord) => void, useOne?: boolean) {
        // Ensure the project name is not a duplicate

        // Split project name from trailing number
        // Returns [project name, number]
        // E.g., "Project 2" -> ["Project", 2]
        // "My project" -> ["My project", null];
        var nameAndNumber = function (name: string) {
            var splitName = name.split(' ');
            var lastPart = splitName.pop();
            if (!isNaN(Number(lastPart))) {
                return {
                    'name': splitName.join(' '),
                    'number': parseInt(lastPart as string)
                };
            } else {
                return {
                    'name': name,
                    'number': null
                };
            }
        };

        var giftProjectNameParts = nameAndNumber(jsonData.name!);

        // Get project names already existing in the DB
        var json: SqlPayload = {};
        json.cond = 'deleted = ? AND gallery IS NULL';
        json.items = ['name'];
        json.values = ['NO'];
        IO.query(iOS.database, json, function (existingProjects: string) {
            var newNumber: number | null = null;

            var existingProjectList = JSON.parse(existingProjects);
            for (var i = 0; i < existingProjectList.length; i++) {
                var existingProjectName = IO.parseProjectData(existingProjectList[i]).name;
                var existingProjectNameParts = nameAndNumber(existingProjectName as string);
                if (giftProjectNameParts.name == existingProjectNameParts.name) {
                    if (existingProjectNameParts.number != null) {
                        // "My project 2" -> "My project 3"
                        newNumber = existingProjectNameParts.number + 1;
                    } else {
                        // "My project" -> "My project 2"
                        newNumber = 2;
                    }
                }

            }

            if (newNumber != null && (!giftProjectNameParts.number || newNumber > giftProjectNameParts.number)) {
                // A duplicate project name exists - update it
                jsonData.name = giftProjectNameParts.name + ' ' + newNumber;
            } else if (useOne) {
                jsonData.name = giftProjectNameParts.name + ' 1';
            }
            callback(jsonData);
        });
    }

    // Receive a base64-encoded zip from iOS (upon open a project)
    static loadProjectFromSjr (b64data: string) {
        // Together, these two provide a "progress" indication
        // that lets us know when to refresh the lobby (when sE/sA = 1)
        var saveExpected = 0; // How many assets we expect to save - updated as we process the zip
        var saveActual = 0; // How many assets actually saved - updated as we make IO saves

        var receivedZip = new JSZip() as unknown as LegacyZipArchive;
        receivedZip.load(b64data, {
            'base64': true
        });

        // To store character MD5 -> character name map
        // The character name is stored in the project JSON; when we load
        // the actual SVG asset, we need the associated name for storage in the DB
        var characterNames: Record<string, string> = {};

        // First find the data.json project file
        
        // REVIEW: this used to be recievedZip.filter but was never returning false to filter anything...  
        // switching to forEach instead.
        receivedZip.forEach(function (relativePath, file) { 
            if (file.dir) {
                return;
            }
            var fullName = relativePath.split('/').pop();
            if (fullName == 'data.json') {
                var jsonData = JSON.parse(file.asText());

                // To require an upgrade, change the major version numbers in .html files and here...
                var currentVersion = 1;
                var projectVersion = parseInt(jsonData.version.replace('iOSv', '')) || 0;

                if (projectVersion > currentVersion) {
                    throw new Error('Project created in a new version of ScratchJr. Please upgrade ScratchJr.');
                }

                IO.uniqueProjectName(jsonData, function (jsonData) {
                    jsonData.isgift = '1'; // Project will display with a bow and ribbon
                    IO.createProject(jsonData, function () {});
                });

                // Build map of character filename -> character name
                var projectData = jsonData.json;
                for (var p = 0; p < projectData.pages.length; p++) {
                    var pageReference = projectData.pages[p];
                    var page = projectData[pageReference];
                    for (var s = 0; s < page.sprites.length; s++) {
                        var spriteReference = page.sprites[s];
                        var sprite = page[spriteReference];
                        // Store a database-friendly sprite name
                        if (sprite.type == 'sprite') {
                            characterNames[sprite.md5] = (
                                ((unescape(sprite.name)).replace(/[0-9]/g, '')).replace(/\s*/g, '')
                            );
                        }
                    }
                }
            }
        });

        // Filter out each asset type for storage
        // REVIEW: this used to be recievedZip.filter but was never returning false to filter anything...  
        // switching to forEach instead.
        receivedZip.forEach(function (relativePath, file) { 
            if (file.dir) {
                return;
            }
            saveExpected++; // We expect to save something for each non-directory

            var subFolder = relativePath.split('/')[1]; // should be {backgrounds, characters, thumbnails, sounds}

            // Filename processing
            var fullName = relativePath.split('/').pop()!; // e.g. Cat.svg
            var name = fullName.split('.')[0]; // e.g. Cat
            var ext = fullName.split('.').pop(); // e.g. svg

            if (!name || !ext) {
                return;
            }

            // Don't save items we already have in the MediaLib
            if (fullName in MediaLib.keys) {
                saveActual++;
                return;
            }

            // File data and base64-encoded data
            var data = file.asBinary();
            var b2data = btoa(data);

            if (subFolder == 'thumbnails' || subFolder == 'sounds') {
                // Save these immediately to the filesystem - no additional processing necessary
                iOS.setmedianame(b2data, name, ext, function () {
                    saveActual++;
                });
            } else if (subFolder == 'characters') {
                // This code is messy - needs a refactor sometime for all the database calls/duplication for bkgs...

                // Save the character, generate its thumbnail, and add entry to the database
                iOS.setmedianame(b2data, name, ext, function () { // Saves the SVG
                    // Parse SVG to determine width/height
                    var svgParser = new DOMParser().parseFromString(data, 'text/xml');
                    var width = svgParser.getElementsByTagName('svg')[0].width.baseVal.value;
                    var height = svgParser.getElementsByTagName('svg')[0].height.baseVal.value;
                    var scale = '0.5'; // fixed value - see PaintIO

                    IO.getImagesInSVG(data, gotSVGImages);

                    function gotSVGImages () {
                        var thumbnailDataURL = IO.getThumbnail(data, width, height, 120, 90);

                        var thumbnailPngBase64 = thumbnailDataURL.split(',')[1];

                        var charName = characterNames[fullName];

                        iOS.setmedia(thumbnailPngBase64, 'png', function (thumbnailMD5) {
                            // Sprite thumbnail is saved - save character to the DB

                            // First ensure that this character doesn't already exist in the exact form
                            var json: SqlPayload = {};
                            json.cond = ('ext = ? AND md5 = ? AND altmd5 = ? AND name = ? '
                                + 'AND scale = ? AND width = ? AND height = ?');
                            json.items = ['*'];
                            json.values = ['svg', fullName, thumbnailMD5,
                                charName, scale, width.toString(), height.toString()];
                            json.order = 'ctime desc';
                            IO.query('usershapes', json, function (results) {
                                results = JSON.parse(results);
                                if (results.length == 0) {
                                    // This character doesn't already exist - insert it
                                    var json: SqlPayload = {};
                                    var keylist = ['scale', 'md5', 'altmd5',
                                        'version', 'width', 'height', 'ext', 'name'];
                                    var values = '?,?,?,?,?,?,?,?';
                                    json.values = [scale, fullName, thumbnailMD5, 'iOSv01',
                                        width.toString(), height.toString(), 'svg', charName];
                                    json.stmt = 'insert into usershapes ('
                                        + keylist.toString() + ') values (' + values + ')';

                                    iOS.stmt(json, function () {
                                        saveActual++;
                                    });
                                } else {
                                    saveActual++;
                                }
                            });
                        });
                    }
                });
            } else if (subFolder == 'backgrounds') {
                // Same idea as characters, but the dimensions are fixed
                iOS.setmedianame(b2data, name, ext, function () {
                    IO.getImagesInSVG(data, gotSVGImages);

                    function gotSVGImages () {
                        var thumbnailDataURL = IO.getThumbnail(data, 480, 360, 120, 90);
                        var thumbnailPngBase64 = thumbnailDataURL.split(',')[1];
                        iOS.setmedia(thumbnailPngBase64, 'png', function (thumbnailMD5) {

                            // First ensure that this bg doesn't already exist in the exact form
                            var json: SqlPayload = {};
                            json.cond = 'ext = ? AND md5 = ? AND altmd5 = ?';
                            json.items = ['*'];
                            json.values = ['svg', fullName, thumbnailMD5];
                            json.order = 'ctime desc';
                            IO.query('userbkgs', json, function (results) {
                                results = JSON.parse(results);
                                if (results.length == 0) {
                                    // Background is unique, insert into the library
                                    var json: SqlPayload = {};
                                    var keylist = ['md5', 'altmd5', 'version', 'width', 'height', 'ext'];
                                    var values = '?,?,?,?,?,?';
                                    json.values = [fullName, thumbnailMD5, 'iOSv01', '480', '360', 'svg'];
                                    json.stmt = 'insert into userbkgs (' + keylist.toString()
                                        + ') values (' + values + ')';
                                    iOS.stmt(json, function () {
                                        saveActual++;
                                    });
                                } else {
                                    saveActual++;
                                }
                            });
                        });
                    }
                });
            } else {
                saveActual++; // Ignore this file - someone messed with the SJR...
            }
        });

        // For updating the Lobby UI - if we're on the lobby page when receiving a project, refresh it
        function refreshLobby () {
            if (gn('hometab')! !== null) { // Check if we're on the lobby page
                if (saveActual == saveExpected) {
                    Lobby.setPage('home');
                } else { // Waiting for assets to be saved
                    setTimeout(refreshLobby, 100);
                }
            }
        }
        refreshLobby();
    }
}
