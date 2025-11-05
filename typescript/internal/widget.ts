import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class WIDGET {
    private Server: ExtensionManager;
    private statusBar: vscode.StatusBarItem;
    private statusIcon: 'debug-stop' | 'debug-pause' | 'eye-watch' | 'eye-closed' | 'warning' = 'debug-stop';
    private options: {
        label: string;
        script: string;
    }[];
    private bin: string;

    constructor(core: ExtensionManager) {
        this.Server = core;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = `${this.Server.ID}.action.command`;

        this.bin = this.Server.W_BRIDGE.RootBinary;
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

        this.Server.Context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => { this.refresh(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => { this.refresh(); }),
            vscode.workspace.onDidOpenTextDocument(() => { this.refresh(); }),
            vscode.commands.registerCommand(this.statusBar.command, async () => {
                const picked = await vscode.window.showQuickPick(this.options.map((o) => `${o.label}`), {
                    placeHolder: this.Server.IDCAP + ': Server Command Palette.'
                });
                if (!picked) { return; }

                const script = this.options.find(o => o.label === picked)?.script;
                if (script) {
                    const terminal = vscode.window.createTerminal({ name: `${this.Server.IDCAP}: ${picked}` });
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
        if (this.Server.ExtentionStatus) {
            this.statusIcon = (this.Server.IsServerWatchingEditorFile()) ? "eye-watch" : "eye-closed";
        } else {
            this.statusIcon = this.Server.W_BRIDGE.spawnAlive() ? "debug-pause" : "debug-stop";
        };

        const errlen = this.Server.W_DIAGNOSTICS.serverDiagnostic.length;
        this.statusBar.text = `$(${this.statusIcon}) ${this.Server.IDCAP} $(warning) ${errlen}`;
        this.statusBar.backgroundColor = errlen ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
        this.statusBar.tooltip = this.Server.W_SANDBOX.url;
        this.statusBar.show();
    };

    dispose() {
        this.statusBar.dispose();
    }

}