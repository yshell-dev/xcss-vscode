import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class SANDBOX {
    public url = "";
    private Server: ExtensionManager;
    public States: Record<string, string | boolean> = {};
    public previewPanal: vscode.WebviewPanel | undefined;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    filepath = "";
    symclass = "";
    refresh = (force = false) => {
        const live = Boolean(this.States['live-preview-option-live-cursor']);
        const editor = vscode.window.activeTextEditor;

        if ((live || force) && editor) {
            const doc = editor.document;
            const ref = this.Server.ReferDocument(editor.document);
            const wordRange = doc.getWordRangeAtPosition(editor.selection.active, this.Server.SymClassRgx);
            const wordString = doc.getText(wordRange);
            const cursorword = wordString.startsWith("-$") ? wordString.replace("-$", "$") : wordString;
            this.symclass = cursorword;
            this.filepath = ref.relpath;
        }

        return { filepath: this.filepath, symclass: this.symclass };
    };

    Open = async () => {
        this.refresh(true);
        this.Server.RequestManifest();

        if (this.previewPanal) {
            this.previewPanal.reveal(vscode.ViewColumn.Active);
        } else if (this.Server.W_BRIDGE.SessionPort > 0) {
            this.previewPanal = vscode.window.createWebviewPanel(
                this.url,
                this.Server.IDCAP + ' Component Sandbox',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                },
                {
                    enableScripts: true,
                    localResourceRoots: [
                        this.Server.Context.extensionUri,
                        this.Server.WorkspaceUri || this.Server.Context.extensionUri,
                    ]
                }
            );

            vscode.env.asExternalUri(
                vscode.Uri.parse(this.url)
            );

            this.previewPanal.onDidDispose(() => {
                this.previewPanal = undefined;
            }, null, this.Server.Context.subscriptions);

            this.previewPanal.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <body style="margin:0;padding:0;">
                    <iframe 
                    src="${this.url}" 
                    style="
                        width:100%;
                        height:100%;
                        border:none;
                        top: 0;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        position: absolute;
                    "> </iframe>
                </body>
            </html>
            `;
        }

        return;
    };

    dispose() {
        this.previewPanal?.dispose();
    }
}