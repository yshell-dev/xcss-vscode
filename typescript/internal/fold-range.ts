
import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class FOLDRANGE {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    public previewPanal: vscode.WebviewPanel | undefined;


    // Folding Range Provider

    public provideFoldingRanges(): vscode.FoldingRange[] {
        const A: vscode.FoldingRange[] = [];
        for (const I of this.Server.getTagRanges()) {
            for (const i of I.cache.composes) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.watchtracks) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.comments) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
        }
        return A;
    }


    dispose() {
        this.previewPanal?.dispose();
    }
}