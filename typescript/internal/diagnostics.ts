import vscode from 'vscode';
import { ExtensionManager } from '../activate';
import { t_TrackRange } from '../types';

export class DIAGNOSTICS {
    private Server: ExtensionManager;
    public clientDiagnostics: vscode.DiagnosticCollection;
    public serverDiagnostics: vscode.DiagnosticCollection;


    constructor(core: ExtensionManager) {
        this.Server = core;
        this.clientDiagnostics = vscode.languages.createDiagnosticCollection(core.ID);
        this.serverDiagnostics = vscode.languages.createDiagnosticCollection(core.ID);
        this.Server.Context.subscriptions.push(this.clientDiagnostics);
        this.Server.Context.subscriptions.push(this.serverDiagnostics);
    }

    dispose() {
        this.clear();
        this.clientDiagnostics.dispose();
    }

    clear() {
        this.clientDiagnostics.clear();
    }

    createError(range: vscode.Range, message: string) {
        const d = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Error
        );
        d.source = this.Server.ID;
        return d;
    }

    createWaring(range: vscode.Range, message: string) {
        const d = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Warning
        );
        d.source = this.Server.ID;
        return d;
    }

    parseSource(source: string) {
        // Match: filepath[:row][:col]
        const match = source.match(/^(.*?)(?::(\d+))?(?::(\d+))?$/);
        if (!match) { return null; };
        const filepath = match[1];
        const row = match[2] ? parseInt(match[2], 10) - 1 : 0;
        const col = match[3] ? parseInt(match[3], 10) - 1 : 0;
        return { filepath, row, col };
    }

    serverDiagnostic(): Record<string, vscode.Diagnostic[]> {
        const dmap: Record<string, vscode.Diagnostic[]> = {};
        for (const diagnostic of this.Server.Global.diagnostics) {
            for (const source of diagnostic.sources) {
                const parsed = this.parseSource(source);
                if (!parsed) { continue; }
                const range = new vscode.Range(parsed.row, parsed.col, parsed.row, parsed.col + 1);
                if (dmap[parsed.filepath]) {
                    dmap[parsed.filepath].push(this.createError(range, diagnostic.message));
                } else {
                    dmap[parsed.filepath] = [this.createError(range, diagnostic.message)];
                }
            };
        };
        return dmap;
    }

    // Diagnostics
    refresh() {
        try {
            if (!this.Server.WorkspaceFolder) { return; }

            const diagnosticMap = this.serverDiagnostic();
            if (!diagnosticMap[this.Server.filePath]) {
                diagnosticMap[this.Server.filePath] = [];
            }
            const hashrules = this.Server.GetHashrules();

            for (const editor of vscode.window.visibleTextEditors) {
                const filepath = editor.document.uri.fsPath;
                const local = this.Server.Locals[filepath];

                const thisDiags: vscode.Diagnostic[] = diagnosticMap[this.Server.filePath];
                const assignables = local.getSymclasses(true);
                const attachables = local.getSymclasses(false);
                for (const tag of local.tagranges) {
                    for (const i of tag.cache.hashrules) {
                        if (!hashrules[i.attr]) {
                            thisDiags.push(this.createWaring(i.attrRange, "Invalid Hashrule."));
                        }
                    }
                    const symclasses: t_TrackRange[] = [];
                    for (const i of tag.cache.composes) {
                        if (!i.attr.endsWith('&')) {
                            symclasses.push(i);
                        }
                    }

                    for (const i of symclasses) {
                        const declarations = attachables[i.attr]?.declarations;
                        if (declarations && declarations.length > 1) {
                            thisDiags.push(this.createWaring(i.attrRange, "Definitions in multiple locations."));
                        }
                        if (assignables[i.attr]) {
                            thisDiags.push(this.createWaring(i.attrRange, "Assignable rule cannot be reused for declaration."));
                        }
                        if (i.attr.includes("$---")) {
                            thisDiags.push(this.createWaring(i.attrRange, "Symclass identifier shoundn't start with '---'."));
                        }
                    }

                    if (symclasses.length === 0 && tag.cache.composes.length) {
                        thisDiags.push(this.createError(tag.range, "Symclass missing in declaration scope."));
                    } else if (symclasses.length > 1) {
                        for (const i of symclasses) {
                            thisDiags.push(this.createWaring(i.attrRange, "Multiple Symclasses found in declaration scope."));
                        }
                    };
                }
            }

            const workspace_uri = this.Server.WorkspaceFolder.uri;
            for (const p of Object.keys(diagnosticMap)) {
                const fileuri = vscode.Uri.joinPath(workspace_uri, p);
                this.clientDiagnostics.set(fileuri, diagnosticMap[p]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`unexpected Error: ${error}`);
        }
    }

}