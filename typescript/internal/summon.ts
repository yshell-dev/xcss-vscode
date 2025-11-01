
import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class SUMMON {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    public previewPanal: vscode.WebviewPanel | undefined;


    // Folding Range Provider


    SummonStructure = async () => {
        if (!this.Server.Editor) { return; }

        const attachables = this.Server.getAttachables();
        const document = this.Server.Editor.document;
        const selection = this.Server.Editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : document.getWordRangeAtPosition(selection.active, this.Server.SymClassRgx);
        const fragment = document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = this.Server.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

        if (wordRange && attachables[fragment]?.summon && tagRange) {
            await this.Server.Editor.edit(editBuilder => {
                editBuilder.insert(tagRange.range.end, '\n' + attachables[fragment].summon);
            }, { undoStopBefore: true, undoStopAfter: true });
        }
    };


    dispose() {
        this.previewPanal?.dispose();
    }
}