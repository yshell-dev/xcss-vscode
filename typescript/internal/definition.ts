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
        if (!this.Server.WorkspaceUri) { return; }
        const ref = this.Server.ReferDocument(document);

        const range = document.getWordRangeAtPosition(position, this.Server.SymClassRgx);
        const word = document.getText(range);
        const isWordInTrackedRange = ref.local.RangeFilter().some(r => r.valRange.contains(position));

        if (!isWordInTrackedRange) { return undefined; }
        const symclasses = ref.local.attachables;
        console.log(`Looking for definition of: ${word}`);

        if (symclasses[word]?.declarations) {
            const declaration = symclasses[word].declarations[0];
            if (typeof declaration !== "string") { return undefined; }
            const location = AnalyzeLocation(declaration);
            if (location === undefined) { return undefined; }

            const definitionLocation = new vscode.Location(
                vscode.Uri.joinPath(vscode.Uri.file(this.Server.WorkspaceUri.fsPath), location.filepath),
                location.definitionRange,
            );
            return definitionLocation;
        }


        return undefined;
    }
}