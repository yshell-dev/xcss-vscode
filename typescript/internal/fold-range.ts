
import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class FOLDRANGE {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    public previewPanal: vscode.WebviewPanel | undefined;


    // Folding Range Provider

    public provideFoldingRanges(document: vscode.TextDocument): vscode.FoldingRange[] {
        const ref = this.Server.ReferDocument(document);

        const A: vscode.FoldingRange[] = [];
        for (const I of ref.local.tagranges) {
            for (const i of I.cache.composerRanges) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.watchingRanges) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.commentsRanges) {
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