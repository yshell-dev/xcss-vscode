import vscode from 'vscode';
import { SERVER } from '../server';

export class STATUSBAR {
    private Core: SERVER | undefined;
    private statusBar: vscode.StatusBarItem;
    private statusIcon: 'debug-stop' | 'debug-pause' | 'eye-watch' | 'eye-closed' | 'warning' = 'debug-stop';
    private identifier: string;
    private options: {
        label: string;
        script: string;
    }[];
    private bin: string;

    constructor(core: SERVER) {
        this.Core = core;
        this.identifier = this.Core.Ed_IdCap;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = `${this.Core.Ed_Id}.terminal.command`;

        this.bin = this.Core.W_EVENTSTREAM.RootBinary;
        this.options = [
            { label: 'Docs', script: "" },
            { label: 'Init/Verify', script: 'init' },
            { label: 'Debug', script: 'debug' },
            { label: 'Watch', script: 'preview -w' },
            { label: 'Preview', script: 'preview' },
        ];
        this.options.forEach((s, i) => {
            s.label = `${i}. Terminal Command: ${s.label}`;
            s.script = `${this.bin} ${s.script}`;
        });

        this.Core.Ed_Context.subscriptions.push(
            vscode.window.onDidChangeActiveTextEditor(() => { this.refresh(); }),
            vscode.workspace.onDidChangeWorkspaceFolders(() => { this.refresh(); }),
            vscode.workspace.onDidOpenTextDocument(() => { this.refresh(); }),
            vscode.commands.registerCommand(this.statusBar.command, async () => {
                const picked = await vscode.window.showQuickPick(this.options.map((o) => `${o.label}`), {
                    placeHolder: this.identifier + ': Core Command Palette.'
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

    bg_error = new vscode.ThemeColor("#b93d3dff");

    refresh() {
        if (!this.Core) {
            return;
        }
        if (this.Core.isExtenActivated()) {
            this.statusIcon = (this.Core.FileManifest.assistfile) ? "eye-watch" : "eye-closed";
        } else {
            this.statusIcon = this.Core.W_EVENTSTREAM.Spawn_IsAlive ? "debug-pause" : "debug-stop";
        };

        const errlen = this.Core.StyleManifest.diagnostics.length;
        this.statusBar.text = `$(${this.statusIcon}) ${this.identifier} $(warning) ${errlen}`;
        this.statusBar.backgroundColor = errlen ? this.bg_error : undefined;
        this.statusBar.tooltip = this.Core.FileManifest.webviewurl;
        this.statusBar.show();
    };

    dispose() {
        this.statusBar.dispose();
    }

}