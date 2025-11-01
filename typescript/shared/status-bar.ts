import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class STATEWIDGET {
    private Server: ExtensionManager | undefined;
    private statusBar: vscode.StatusBarItem;
    private statusIcon: 'debug-stop' | 'debug-pause' | 'eye-watch' | 'eye-closed' | 'warning' = 'debug-stop';
    private identifier: string;
    private options: {
        label: string;
        script: string;
    }[];
    private bin: string;

    constructor(core: ExtensionManager) {
        this.Server = core;
        this.identifier = this.Server.IDCAP;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = `${this.Server.ID}.action.command`;

        this.bin = this.Server.W_EVENTSTREAM.RootBinary;
        this.options = [
            { label: 'Docs', script: "" },
            { label: 'Watch', script: 'preview -w' },
            { label: 'Debug', script: 'debug' },
            { label: 'Preview', script: 'preview' },
            { label: 'Init/Verify', script: 'init' },
        ];
        this.options.forEach((s, i) => {
            s.label = `${i}. Terminal Command: ${s.label}`;
            s.script = `${this.bin} ${s.script}`;
        });

        this.Server.Ed_Context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => { this.refresh(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => { this.refresh(); }),
            vscode.workspace.onDidOpenTextDocument(() => { this.refresh(); }),
            vscode.commands.registerCommand(this.statusBar.command, async () => {
                const picked = await vscode.window.showQuickPick(this.options.map((o) => `${o.label}`), {
                    placeHolder: this.identifier + ': Server Command Palette.'
                });
                if (!picked) { return; }

                const script = this.options.find(o => o.label === picked)?.script;
                if (script) {
                    const terminal = vscode.window.createTerminal({ name: `${this.identifier}: ${picked}` });
                    terminal.show();
                    terminal.sendText(script);
                }
            }),
        );
    }


    refresh() {
        if (!this.Server) {
            return;
        }
        if (this.Server.isExtenActivated()) {
            this.statusIcon = (this.Server.FileManifest.assistfile) ? "eye-watch" : "eye-closed";
        } else {
            this.statusIcon = this.Server.W_EVENTSTREAM.spawnAlive() ? "debug-pause" : "debug-stop";
        };

        const errlen = this.Server.StyleManifest.diagnostics.length;
        this.statusBar.text = `$(${this.statusIcon}) ${this.identifier} $(warning) ${errlen}`;
        this.statusBar.backgroundColor = errlen ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
        this.statusBar.tooltip = this.Server.FileManifest.webviewurl;
        this.statusBar.show();
    };

    dispose() {
        this.statusBar.dispose();
    }

}