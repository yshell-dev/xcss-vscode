import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class SANDBOX {
    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    public previewPanal: vscode.WebviewPanel | undefined;
    OpenSandbox = async () => {

        this.Server.RequestManifest(true);

        if (this.previewPanal) {
            this.previewPanal.reveal(vscode.ViewColumn.Active);
        } else if (this.Server.W_BRIDGE.WebviewPort > 0) {
            this.previewPanal = vscode.window.createWebviewPanel(
                this.Server.W_BRIDGE.WebviewUrl,
                this.Server.IDCAP + ' Component Sandbox',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                },
                {
                    enableScripts: true,
                    localResourceRoots: [
                        this.Server.Context.extensionUri,
                        this.Server.WorkspaceFolder?.uri || this.Server.Context.extensionUri,
                    ]
                }
            );

            vscode.env.asExternalUri(
                vscode.Uri.parse(this.Server.W_BRIDGE.WebviewUrl)
            );

            this.previewPanal.onDidDispose(() => {
                this.previewPanal = undefined;
            }, null, this.Server.Context.subscriptions);

            this.previewPanal.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <body style="margin:0;padding:0;">
                    <iframe 
                    src="${this.Server.W_BRIDGE.WebviewUrl}" 
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