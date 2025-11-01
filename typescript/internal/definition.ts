import vscode from 'vscode';
import { ExtensionManager } from '../activate';
import AnalyzeLocation from '../helpers/location';

export class DEFINITION {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    dispose() {
        return;
    }

    // Goto Definition 

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
        if (!this.Server.WorkspaceFolder || !(this.Server.isFileTargetedFile() || this.Server.isCssTargetedFile())) { return undefined; }

        const attachables = this.Server.getAttachables();

        const wordRange = document.getWordRangeAtPosition(position, this.Server.SymClassRgx);
        const atValPair = this.Server.getTagAtValPairRanges().some(r => r.valRange.contains(position)) || !wordRange;
        const isWordInTrackedRange = this.Server.isCssTargetedFile() || atValPair;
        if (!isWordInTrackedRange) { return undefined; }

        const word = document.getText(wordRange);
        console.log(`Looking for definition of: ${word}`);

        if (attachables[word]?.declarations) {
            const declaration = attachables[word].declarations[0];
            if (typeof declaration !== "string") { return undefined; }
            const location = AnalyzeLocation(declaration);
            if (location === undefined) { return undefined; }

            const definitionLocation = new vscode.Location(
                vscode.Uri.joinPath(vscode.Uri.file(this.Server.WorkspaceFolder.uri.fsPath), location.filepath),
                location.definitionRange,
            );
            return definitionLocation;
        }


        return undefined;
    }
}