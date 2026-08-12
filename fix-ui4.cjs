const fs = require('fs');

function patch(file, pairs) {
    let s = fs.readFileSync(file, 'utf8');
    let ok = 0;
    for (const [from, to] of pairs) {
        if (s.includes(from)) { s = s.split(from).join(to); ok++; }
        else console.error('MISS in', file, ':', JSON.stringify(from.slice(0, 60)));
    }
    fs.writeFileSync(file, s);
    console.log(file, '- applied', ok, '/', pairs.length);
}

// ---- Scripts.ts: remove duplicates, block casts ----
patch('src/app/src/editor/ui/Scripts.ts', [
    ['    flowCaret: Block | null;\n    spr: Sprite;\n    dragList: Block[];\n    sc: HTMLElement;\n    available: boolean;\n    findingGroup: boolean;\n    insideCShape: boolean;\n    magnitude: number;\n',
     '    flowCaret: Block | null;\n    spr: Sprite;\n    dragList: Block[];\n    sc: HTMLElement;\n'],
    ['        if (ths.owner.isCaret) {', '        if ((ths.owner as Block).isCaret) {'],
    ['    static spr (spr) {\n', '    static spr (spr?) {\n'], // no-op guard
]);

// ---- Events.ts: startDrag athold optional ----
patch('src/app/src/utils/Events.ts', [
    ['    static startDrag (e, c, atstart, atend, atdrag, atclick, athold) {', '    static startDrag (e, c, atstart, atend, atdrag, atclick, athold?) {'],
]);

// ---- Stage.ts: mascotData + sprAttr ----
patch('src/app/src/editor/engine/Stage.ts', [
    ['        var sprAttr = UI.mascotData();', '        var sprAttr: Record<string, unknown> = UI.mascotData();'],
    ['        var sprAttr = {', '        var sprAttr: Record<string, unknown> = {'],
]);

// ---- Page.ts: recreateObject optional pageId flag ----
patch('src/app/src/editor/ui/Project.ts', [
    ['    static recreateObject (page, name, data, whenDone, pageidflag) {', '    static recreateObject (page, name, data, whenDone, pageidflag?) {'],
    ['    static recreatePage (name, data, fcn) {', '    static recreatePage (name, data, fcn?) {'],
]);
