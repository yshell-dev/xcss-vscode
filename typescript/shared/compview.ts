import vscode from 'vscode';
import { SERVER } from '../server';

export class COMPVIEW {
    private Core: SERVER;
    public previewPanal: vscode.WebviewPanel | undefined;

    constructor(core: SERVER) {
        this.Core = core;
    }

    clear() {
        if (this.previewPanal) {
            this.previewPanal.dispose();
        }
    }

    dispose() {
        this.clear();
    };


    open = async () => {

        this.Core.RequestManifest(true);

        if (this.previewPanal) {
            this.previewPanal.reveal(vscode.ViewColumn.Active);
        } else if (this.Core.FileManifest.webviewport > 0) {
            this.previewPanal = vscode.window.createWebviewPanel(
                this.Core.FileManifest.webviewurl,
                this.Core.Ed_Id + ' Component Sandbox',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                },
                {
                    enableScripts: true,
                    localResourceRoots: [
                        this.Core.Ed_Uri,
                        this.Core.Ed_WorkspaceFolder?.uri || this.Core.Ed_Uri
                    ]
                }
            );

            vscode.env.asExternalUri(
                vscode.Uri.parse(this.Core.FileManifest.webviewurl)
            );

            this.previewPanal.onDidDispose(() => {
                this.previewPanal = undefined;
            }, null, this.Core.Ed_Context.subscriptions);

            this.previewPanal.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <body style="margin:0;padding:0;">
                    <iframe 
                    src="${this.Core.FileManifest.webviewurl}" 
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
}
