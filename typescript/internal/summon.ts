
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
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }
        const ref = this.Server.ReferDocument(editor.document);
        if (!ref) { return; }

        const selection = editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : editor.document.getWordRangeAtPosition(selection.active, this.Server.SymClassRgx);
        const fragment = editor.document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = ref.local.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

        const attachables = ref.local.attachables;
        if (attachables[fragment]?.summon) {
            await editor.edit(editBuilder => {
                editBuilder.insert(tagRange.range.end, '\n' + attachables[fragment].summon);
            }, { undoStopBefore: true, undoStopAfter: true });
        }
    };


    dispose() {
        this.previewPanal?.dispose();
    }
}