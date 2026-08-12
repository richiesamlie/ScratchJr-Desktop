import {preprocessAndLoadCss} from './src/utils/lib';
import Localization from './src/utils/Localization';
import AppUsage from './src/utils/AppUsage';
import iOS from './src/iPad/iOS.js';
import IO from './src/iPad/IO.js';
import MediaLib from './src/iPad/MediaLib.js';

import {indexMain} from './src/entry/index';
import {homeMain} from './src/entry/home';
import {editorMain} from './src/entry/editor';
import {gettingStartedMain} from './src/entry/gettingstarted';
import {inappInterfaceGuide, inappAbout, inappBlocksGuide, inappPaintEditorGuide} from './src/entry/inapp';

function loadSettings (settingsRoot, whenDone) {
	IO.requestFromServer(settingsRoot + 'settings.json', (result) => {
		window.Settings = JSON.parse(result);
		whenDone();
	});
}


// App-wide entry-point
window.onload = () => loadPage(document.body.dataset.scratchjrPage || window.scratchJrPage).catch((err) => console.error('loadPage failed:', err));



export async function loadPage(page) {
	// Function to be called after settings, locale strings, and Media Lib
	// are asynchronously loaded. This is overwritten per HTML page below.
	let entryFunction = () => {};

	// Root directory for includes. Needed in case we are in the inapp-help
	// directory (and root becomes '../')
	let root = './';

	// Load CSS and set root/entryFunction for all pages
	switch (page) {
	default:
	case 'index':
		// Index page (splash screen)
		await preprocessAndLoadCss('css', 'css/font.css');
		await preprocessAndLoadCss('css', 'css/base.css');
		await preprocessAndLoadCss('css', 'css/start.css');
		await preprocessAndLoadCss('css', 'css/thumbs.css');
		/* For parental gate. These CSS properties should be refactored */
		await preprocessAndLoadCss('css', 'css/editor.css');
		entryFunction = () => iOS.waitForInterface(indexMain);
		break;
	case 'home':
		// Lobby pages
		await preprocessAndLoadCss('css', 'css/font.css');
		await preprocessAndLoadCss('css', 'css/base.css');
		await preprocessAndLoadCss('css', 'css/lobby.css');
		await preprocessAndLoadCss('css', 'css/thumbs.css');
		entryFunction = () => iOS.waitForInterface(homeMain);
		break;
	case 'editor':
		// Editor pages
		await preprocessAndLoadCss('css', 'css/font.css');
		await preprocessAndLoadCss('css', 'css/base.css');
		await preprocessAndLoadCss('css', 'css/editor.css');
		await preprocessAndLoadCss('css', 'css/editorleftpanel.css');
		await preprocessAndLoadCss('css', 'css/editorstage.css');
		await preprocessAndLoadCss('css', 'css/editormodal.css');
		await preprocessAndLoadCss('css', 'css/librarymodal.css');
		await preprocessAndLoadCss('css', 'css/paintlook.css');
		entryFunction = () => iOS.waitForInterface(editorMain);
		break;
	case 'gettingStarted':
		// Getting started video page
		await preprocessAndLoadCss('css', 'css/font.css');
		await preprocessAndLoadCss('css', 'css/base.css');
		await preprocessAndLoadCss('css', 'css/gs.css');
		entryFunction = () => iOS.waitForInterface(gettingStartedMain);
		break;
	case 'inappAbout':
		// About ScratchJr in-app help frame
		await preprocessAndLoadCss('style', 'inapp/style/about.css');
		entryFunction = () => inappAbout();
		//root = '../';
		break;
	case 'inappInterfaceGuide':
		// Interface guide in-app help frame
		await preprocessAndLoadCss('style', 'inapp/style/interface.css');
		entryFunction = () => inappInterfaceGuide();
	//	  root = '../';
		break;
	case 'inappPaintEditorGuide':
		// Paint editor guide in-app help frame
		await preprocessAndLoadCss('style', 'inapp/style/paint.css');
		entryFunction = () => inappPaintEditorGuide();
	//  root = '../';
		break;
	case 'inappBlocksGuide':
		// Blocks guide in-app help frame
		await preprocessAndLoadCss('style', 'inapp/style/blocks.css');
		entryFunction = () => inappBlocksGuide();
    //	  root = '../';
		break;
	}

	// Start up sequence
	// Load settings from JSON
	loadSettings(root, () => {
		// Load locale strings from JSON
		Localization.includeLocales(root, () => {
			// Load Media Lib from JSON
			MediaLib.loadMediaLib(root, () => {
				entryFunction();
			});
		});
		// Initialize currentUsage data
		AppUsage.initUsage();
	});
}
