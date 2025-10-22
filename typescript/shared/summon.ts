import { SERVER } from '../server';

export class SUMMON {
    private Server: SERVER;

    constructor(core: SERVER) {
        this.Server = core;
    }

    dispose() {
        return;
    }

    summonStructure = async () => {
        if (!this.Server.Ed_Editor) { return; }

        const attachables = this.Server.getAttachables();
        const document = this.Server.Ed_Editor.document;
        const selection = this.Server.Ed_Editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : document.getWordRangeAtPosition(selection.active, this.Server.SymClassRgx);
        const fragment = document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = this.Server.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

        if (wordRange && attachables[fragment]?.summon && tagRange) {
            await this.Server.Ed_Editor.edit(editBuilder => {
                editBuilder.insert(tagRange.range.end, '\n' + attachables[fragment].summon);
            }, { undoStopBefore: true, undoStopAfter: true });
        }
    };
}