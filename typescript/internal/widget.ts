import vscode from 'vscode';
import { ExtensionManager } from '../activate';

export class WIDGET {
    private Server: ExtensionManager;
    private statusBar: vscode.StatusBarItem;
    private statusIcon: 'debug-stop' | 'debug-pause' | 'eye-watch' | 'eye-closed' | 'warning' = 'debug-stop';
    private options: {
        label: string;
        content: string;
        type: string;
    }[];

    constructor(core: ExtensionManager) {
        this.Server = core;
        this.statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
        this.statusBar.command = `${this.Server.ID}.action.command`;

        this.options = [
            { type: "command", label: 'Docs', content: "" },
            { type: "command", label: 'Watch', content: 'preview -w' },
            { type: "command", label: 'Debug', content: 'debug' },
            { type: "command", label: 'Preview', content: 'preview' },
            { type: "command", label: 'Init/Verify', content: 'init' },
            { type: "redirect", label: 'Git Reposiory.', content: "https://github.com/yshelldev/xcss-pacakge" },
            { type: "redirect", label: 'Spin My Flavour.', content: "https://github.com/yshelldev/xcss-scaffold." },
            { type: "redirect", label: 'Get a walkthorugh..', content: "https://github.com/yshelldev/xcss-tutorial" },
            { type: "redirect", label: 'Sponsor Our Project Today.', content: "https://github.com/sponsors/yshelldev/dashboard" },
        ];
        this.options.forEach((s, i) => {
            switch (s.type) {
                case "command":
                    s.label = `${i}. Run Command: ${s.label}`;
                    break;
                case "redirect":
                    s.label = `${i}. Explore & Support: ${s.label}`;
                    break;
            }
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
                const option = this.options.find(o => o.label === picked);

                if (option) {
                    switch (option.type) {
                        case "command": {
                            const terminal = vscode.window.createTerminal({ name: `${this.Server.IDCAP}: ${picked}` });
                            terminal.show();
                            terminal.sendText(this.Server.W_BRIDGE.FindBinpath() + " " + option.content);
                        }; break;
                        case "redirect": {
                            const link = vscode.Uri.parse(option.content);
                            vscode.env.openExternal(link);
                        }; break;
                    }
                }
            }),
        );
    }


    refresh() {
        if (!this.Server) {
            return;
        }
        if (this.Server.ExtensionStatus) {
            const ref = this.Server.ReferDocument();
            this.statusIcon = ref.watching ? "eye-watch" : "eye-closed";
        } else {
            this.statusIcon = this.Server.W_BRIDGE.spawnAlive() ? "debug-pause" : "debug-stop";
        };

        const errlen = this.Server.W_DIAGNOSTICS.serverRefresh.length;
        this.statusBar.text = `$(${this.statusIcon}) ${this.Server.IDCAP} $(warning) ${errlen}`;
        this.statusBar.backgroundColor = errlen ? new vscode.ThemeColor('statusBarItem.errorBackground') : undefined;
        this.statusBar.tooltip = this.Server.W_SANDBOX.url;
        this.statusBar.show();
    };

    dispose() {
        this.statusBar.dispose();
    }

}