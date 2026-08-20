const asar = require('@electron/asar');
const p = 'out/ScratchJr-win32-x64/resources/app.asar';
const sep = '\\';
const settings = asar.extractFile(p, ['src', 'app', 'settings.json'].join(sep)).toString();
console.log('maxPages in packaged settings:', JSON.parse(settings).maxPages);
const css = asar.extractFile(p, ['src', 'app', 'css', 'editor.css'].join(sep)).toString();
console.log('pagescc scrollable in packaged CSS:', css.includes('overflow-y: auto'));
