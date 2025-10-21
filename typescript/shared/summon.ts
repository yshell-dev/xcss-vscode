import { SERVER } from '../server';

export class SUMMON {
    private Core: SERVER;

    constructor(core: SERVER) {
        this.Core = core;
    }

    dispose() {
        return;
    }

    summonStructure = async () => {
        if (!this.Core.Ed_Editor) { return; }

        const attachables = this.Core.getAttachables();
        const document = this.Core.Ed_Editor.document;
        const selection = this.Core.Ed_Editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : document.getWordRangeAtPosition(selection.active, this.Core.SymClassRgx);
        const fragment = document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = this.Core.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

        if (wordRange && attachables[fragment]?.summon && tagRange) {
            await this.Core.Ed_Editor.edit(editBuilder => {
                editBuilder.insert(tagRange.range.end, '\n' + attachables[fragment].summon);
            }, { undoStopBefore: true, undoStopAfter: true });
        }
    };
}