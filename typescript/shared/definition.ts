import vscode from 'vscode';
import { ExtensionManager } from '../activate';

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
        if (!this.Server.Ed_WorkspaceFolder || !(this.Server.isFileTargetedFile() || this.Server.isCssTargetedFile())) { return undefined; }

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

            let filePath = declaration;


            const definitionPosition = new vscode.Position(definitionLine, definitionChar);

            const definitionLocation = new vscode.Location(
                vscode.Uri.joinPath(vscode.Uri.file(this.Server.Ed_WorkspaceFolder.uri.fsPath), filePath),
                new vscode.Range(definitionPosition, definitionPosition)
            );
            return definitionLocation;
        }

        return undefined;
    }
}