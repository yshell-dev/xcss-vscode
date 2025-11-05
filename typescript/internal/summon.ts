
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
        const document = editor.document;
        const local = this.Server.GetLocal(editor.document);
        if (!local) { return; }

        const attachables = local.getSymclasses();
        const selection = editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : document.getWordRangeAtPosition(selection.active, this.Server.SymClassRgx);
        const fragment = document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = local.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

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