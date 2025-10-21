import vscode from 'vscode';
import { SERVER } from '../server';

const DECLARATION_PATH_REGEX = /^(.*?):(\d+):(\d+)$/;

export class Definitions {
    private Core: SERVER;

    constructor(core: SERVER) {
        this.Core = core;
    }

    dispose() {
        return;
    }

    // Goto Definition 

    async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<vscode.Definition | vscode.LocationLink[] | undefined> {
        if (!this.Core.Ed_WorkspaceFolder || !(this.Core.isFileTargetedFile() || this.Core.isCssTargetedFile())) { return undefined; }

        const attachables = this.Core.getAttachables();

        const wordRange = document.getWordRangeAtPosition(position, this.Core.SymClassRgx);
        const atValPair = this.Core.getTagAtValPairRanges().some(r => r.valRange.contains(position)) || !wordRange;
        const isWordInTrackedRange = this.Core.isCssTargetedFile() || atValPair;
        if (!isWordInTrackedRange) { return undefined; }

        const word = document.getText(wordRange);
        console.log(`Looking for definition of: ${word}`);

        if (attachables[word]?.declarations) {
            const declaration = attachables[word].declarations[0];
            if (typeof declaration !== "string") { return undefined; }

            let definitionLine = 0;
            let definitionChar = 0;
            let filePath = declaration;
            const match = declaration.match(DECLARATION_PATH_REGEX);

            if (match) {
                filePath = match[1];
                definitionLine = parseInt(match[2], 10);
                definitionChar = parseInt(match[3], 10);
            } else {
                const newWord = word.replace(/_/g, () => ' ').replace(/(^|\$)_/, () => '$@');
                const searchWord = newWord.includes('$') ? newWord.slice(newWord.lastIndexOf('$') + 1) : newWord;

                try {
                    const targetUri = vscode.Uri.joinPath(vscode.Uri.file(this.Core.Ed_WorkspaceFolder.uri.fsPath), filePath);
                    const targetDocument = await vscode.workspace.openTextDocument(targetUri);
                    const fileContent = targetDocument.getText();
                    const wordVarients = [
                        `.${searchWord}\t`,
                        `.${searchWord}\n`,
                        `.${searchWord}{`,
                        `.${searchWord} `,
                        ` ${searchWord}\t`,
                        ` ${searchWord}\n`,
                        ` ${searchWord}{`,
                        ` ${searchWord} `,
                        `}${searchWord}\t`,
                        `}${searchWord}\n`,
                        `}${searchWord}{`,
                        `}${searchWord} `,
                        `\n${searchWord}\t`,
                        `\n${searchWord}\n`,
                        `\n${searchWord}{`,
                        `\n${searchWord} `,
                        `\t${searchWord}\t`,
                        `\t${searchWord}\n`,
                        `\t${searchWord}{`,
                        `\t${searchWord} `,
                    ];
                    let indexOfWord = -1;
                    for (const v of wordVarients) {
                        if (indexOfWord === -1 && (fileContent.indexOf(v) !== -1)) { indexOfWord = fileContent.indexOf(v) + 1; }
                    }

                    if (indexOfWord !== -1) {
                        const textBeforeWord = fileContent.substring(0, indexOfWord);
                        definitionLine = (textBeforeWord.match(/\n/g) || []).length;

                        // Handle the case where the match is on the first line
                        if (definitionLine === 0 && textBeforeWord.lastIndexOf('\n') === -1) { definitionChar = indexOfWord; }
                    }
                } catch (error) {
                    console.error(`Error opening or reading file ${filePath}:`, error);
                    return undefined; // Cannot open/read file, so no definition
                }
            }

            const definitionPosition = new vscode.Position(definitionLine, definitionChar);

            const definitionLocation = new vscode.Location(
                vscode.Uri.joinPath(vscode.Uri.file(this.Core.Ed_WorkspaceFolder.uri.fsPath), filePath),
                new vscode.Range(definitionPosition, definitionPosition)
            );
            return definitionLocation;
        }

        return undefined;
    }
}