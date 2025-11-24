import vscode from 'vscode';
import { ExtensionManager } from '../activate';
import { t_TrackRange } from '../types';
import AnalyzeLocation from '../helpers/location';

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

    serverRefresh() {
        const workspace_uri = this.Server.WorkspaceUri;
        if (!workspace_uri) { return; }

        const dmap: Record<string, vscode.Diagnostic[]> = {};
        for (const diagnostic of this.Server.Global.diagnostics || []) {
            for (const source of diagnostic.sources || []) {
                const parsed = AnalyzeLocation(source);
                if (!parsed) { continue; }

                const arr = dmap[parsed.filepath] || [];
                arr.push(this.createError(parsed.definitionRange, diagnostic.message));
                dmap[parsed.filepath] = arr;
            };
        };

        this.serverDiagnostics.clear();
        for (const p of Object.keys(dmap)) {
            const fileuri = vscode.Uri.joinPath(workspace_uri, p);
            this.serverDiagnostics.set(fileuri, dmap[p]);
        }
    }

    // Diagnostics
    clientRefresh() {
        try {
            const workspace_uri = this.Server.WorkspaceUri;
            if (!workspace_uri) { return; }

            const diagnosticMap: Record<string, vscode.Diagnostic[]> = {};
            const hashrules = this.Server.GetHashrules();

            for (const editor of vscode.window.visibleTextEditors) {
                const ref = this.Server.ReferDocument(editor.document);

                const thisDiags: vscode.Diagnostic[] = [];
                const assignables = ref.local.assignables;
                const attachables = ref.local.attachables;
                for (const tag of ref.local.tagranges) {
                    for (const i of tag.cache.hashrules) {
                        if (!hashrules[i.attr]) {
                            thisDiags.push(this.createWaring(i.attrRange, "Invalid Hashrule."));
                        }
                    }
                    const symclasses: t_TrackRange[] = [];
                    for (const i of tag.cache.composerRanges) {
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
                            thisDiags.push(this.createWaring(i.attrRange, "Assignable cannot be reused for declaration."));
                        }
                        if (i.attr.includes("$---")) {
                            thisDiags.push(this.createWaring(i.attrRange, "Symclass identifier shoundn't start with '---'."));
                        }
                    }

                    if (symclasses.length === 0 && tag.cache.composerRanges.length) {
                        thisDiags.push(this.createError(tag.range, "Symclass missing in declaration scope."));
                    } else if (symclasses.length > 1) {
                        for (const i of symclasses) {
                            thisDiags.push(this.createWaring(i.attrRange, "Multiple Symclasses found in declaration scope."));
                        }
                    };
                }

                if (thisDiags.length) {
                    diagnosticMap[ref.relpath] = thisDiags;
                }
            }

            this.clientDiagnostics.clear();
            for (const p of Object.keys(diagnosticMap)) {
                const fileuri = vscode.Uri.joinPath(workspace_uri, p);
                this.clientDiagnostics.set(fileuri, diagnosticMap[p]);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`unexpected Error: ${error}`);
        }
    }

}