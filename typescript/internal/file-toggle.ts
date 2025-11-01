import vscode from 'vscode';
import { ExtensionManager } from '../activate';
import path from 'path';
import fs from 'fs/promises';

export class FILETOGGLE {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    public previewPanal: vscode.WebviewPanel | undefined;

    CommandFileToggle = async () => {
        async function fileExists(filePath: string): Promise<boolean> {
            try {
                await fs.access(filePath);
                return true;
            } catch {
                return false;
            }
        }

        try {
            let switchpath = this.Server.filePath;

            if (this.Server.filePath !== "") {
                for (const k of Object.keys(this.Server.GlobalManifest.switchmap)) {
                    if (this.Server.filePath.startsWith(k)) {
                        switchpath = this.Server.filePath.replace(k, this.Server.GlobalManifest.switchmap[k]);
                    }
                }
            };
            const filePath = path.join(this.Server.WorkspaceFolder?.uri.fsPath || '.', (switchpath)) || "";
            if (filePath) {
                if (await fileExists(filePath)) {
                    const targetUri = vscode.Uri.file(filePath);
                    await vscode.commands.executeCommand('vscode.open', targetUri, {
                        viewColumn: vscode.ViewColumn.Active
                    });
                    return;
                } else if (path.extname(filePath) === `.${this.Server.ID}`) {
                    vscode.window.showErrorMessage(`Toggle unavailable for *.${this.Server.ID} files: ${filePath}`);
                    return;
                } else {
                    vscode.window.showErrorMessage(`Corresponding file not found: ${filePath}`);
                    return;
                }
            }
            vscode.window.showErrorMessage('File is not in any source or target directory defined.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to switch: ${errorMessage}`);
        }
    };

    dispose() {
        this.previewPanal?.dispose();
    }
}