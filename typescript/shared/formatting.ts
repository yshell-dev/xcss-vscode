import vscode from 'vscode';
import formatBlock from '../helpers/formatter';
import { SERVER } from '../server';

export class Formatter {
    private Core: SERVER;

    constructor(Core: SERVER) {
        this.Core = Core;
    }

    dispose() {
        return;
    }

    // Proxy formating Provider

    reactByFold_flag = false;
    fold_1__unfold_0 = false;
    formatTimeout_id: NodeJS.Timeout | undefined = undefined;

    provideDocEdits(document: vscode.TextDocument): vscode.TextEdit[] {
        const edits: vscode.TextEdit[] = [];
        const atValPairs = this.Core.getTagAtValPairRanges().filter(i => !i.attrRange.intersection(i.valRange));

        for (const track of atValPairs) {
            const preAtrribute = document.getText(new vscode.Range(new vscode.Position(track.attrRange.start.line, 0), track.attrRange.start));
            const postRange = new vscode.Range(track.valRange.end, document.lineAt(track.valRange.end.line).range.end);
            const postValue = document.getText(postRange);
            const collitions = atValPairs.reduce((s, t) => { if (postRange.intersection(t.blockRange)) { s++; } return s; }, 0);
            const valIntent = `${preAtrribute.match(/^[\t\s]*/)}`;
            const valBreak = `\n${valIntent}`;
            const valFormatted = formatBlock(track.val.slice(1, -1) || '', valBreak);

            const begin = /^[\t\s]*$/.test(preAtrribute) ? "" : valBreak;
            const end = (/^[\t\s]*$/.test(postValue) || !(collitions < 2)) ? "" : valBreak;

            edits.push(vscode.TextEdit.replace(track.blockRange,
                `${begin}${track.attr}=${track.val[0]}${valFormatted}${track.val[track.val.length - 1]}${end}`
            ));
        }

        return edits;
    }

    formatFile = async (): Promise<void> => {
        if (!this.Core.Ed_Editor) { return; }
        try {
            if (this.reactByFold_flag) {
                await (this.fold_1__unfold_0 ? this.foldRanges : this.unfoldRanges)();
                this.switchToFoldingTrigger(false);
            } else {
                const edits = this.provideDocEdits(this.Core.Ed_Editor.document);
                if (edits.length > 0) {
                    await this.Core.Ed_Editor.edit(editBuilder => { for (const e of edits) { editBuilder.replace(e.range, e.newText); } },
                        { undoStopBefore: true, undoStopAfter: true }
                    );
                }
                this.unfoldRanges();
                this.switchToFoldingTrigger(true);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error formatting file:', errorMessage);
            vscode.window.showErrorMessage(`Failed to format file: ${errorMessage}`);
        }
    };

    switchToFoldingTrigger = async (reset: boolean) => {
        if (reset) {
            this.reactByFold_flag = true;
            this.fold_1__unfold_0 = true;
        } else {
            this.fold_1__unfold_0 = !this.fold_1__unfold_0;
        }
        if (this.formatTimeout_id) { clearTimeout(this.formatTimeout_id); }
        this.formatTimeout_id = setTimeout(() => this.reactByFold_flag = false, 1000);
    };

    foldRanges = async (): Promise<void> => {
        if (vscode.window.activeTextEditor) {
            try {
                await vscode.commands.executeCommand('editor.fold', {
                    ranges: this.Core.provideFoldingRanges(),
                    direction: 'all'
                });
            } catch (error) {
                console.error('Error collapsing ranges:', error);
                vscode.window.showErrorMessage(`Failed to collapse ranges: ${error}`);
            }
        } else {
            vscode.window.showInformationMessage('No active text editor.');
        }
    };

    unfoldRanges = async (): Promise<void> => {
        if (vscode.window.activeTextEditor) {
            try {
                await vscode.commands.executeCommand('editor.unfold', {
                    ranges: this.Core.provideFoldingRanges(),
                    direction: 'all'
                });
            } catch (error) {
                console.error('Error collapsing ranges:', error);
                vscode.window.showErrorMessage(`Failed to collapse ranges: ${error}`);
            }
        } else {
            vscode.window.showInformationMessage('No active text editor.');
        }
    };

}