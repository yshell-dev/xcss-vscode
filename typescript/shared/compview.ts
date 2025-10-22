import vscode from 'vscode';
import { SERVER } from '../server';

export class COMPVIEW {
    private Server: SERVER;
    public previewPanal: vscode.WebviewPanel | undefined;

    constructor(core: SERVER) {
        this.Server = core;
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

        this.Server.RequestManifest(true);

        if (this.previewPanal) {
            this.previewPanal.reveal(vscode.ViewColumn.Active);
        } else if (this.Server.FileManifest.webviewport > 0) {
            this.previewPanal = vscode.window.createWebviewPanel(
                this.Server.FileManifest.webviewurl,
                this.Server.Ed_Id + ' Component Sandbox',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                },
                {
                    enableScripts: true,
                    localResourceRoots: [
                        this.Server.Ed_Uri,
                        this.Server.Ed_WorkspaceFolder?.uri || this.Server.Ed_Uri
                    ]
                }
            );

            vscode.env.asExternalUri(
                vscode.Uri.parse(this.Server.FileManifest.webviewurl)
            );

            this.previewPanal.onDidDispose(() => {
                this.previewPanal = undefined;
            }, null, this.Server.Ed_Context.subscriptions);

            this.previewPanal.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <body style="margin:0;padding:0;">
                    <iframe 
                    src="${this.Server.FileManifest.webviewurl}" 
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
