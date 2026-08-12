const asar = require('@electron/asar');
const p = 'out/ScratchJr-win32-x64/resources/app.asar';
const sep = '\\';
const settings = asar.extractFile(p, sep + 'src' + sep + 'app' + sep + 'settings.json').toString();
console.log('maxPages in packaged settings:', JSON.parse(settings).maxPages);
const css = asar.extractFile(p, sep + 'src' + sep + 'app' + sep + 'css' + sep + 'editor.css').toString();
console.log('pagescc scrollable in packaged CSS:', css.includes('overflow-y: auto'));
