import vscode from 'vscode';
import { SERVER } from '../server';
import { t_TrackRange } from '../types';

export class DIAGNOSTICS {
    private Core: SERVER;
    public diagnosticCollection: vscode.DiagnosticCollection;


    constructor(core: SERVER) {
        this.Core = core;
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection(core.Ed_Id);
        this.Core.Ed_Context.subscriptions.push(this.diagnosticCollection);
    }

    dispose() {
        this.clear();
        this.diagnosticCollection.dispose();
    }

    clear() {
        this.diagnosticCollection.clear();
    }

    createError(range: vscode.Range, message: string) {
        const d = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Error
        );
        d.source = this.Core.Ed_Id;
        return d;
    }

    createWaring(range: vscode.Range, message: string) {
        const d = new vscode.Diagnostic(
            range,
            message,
            vscode.DiagnosticSeverity.Warning
        );
        d.source = this.Core.Ed_Id;
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

    lspDiagnostic(): Record<string, vscode.Diagnostic[]> {
        const dmap: Record<string, vscode.Diagnostic[]> = {};
        for (const diagnostic of this.Core.StyleManifest.diagnostics) {
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
            if (!(
                this.Core.Ed_Editor &&
                this.Core.Ed_WorkspaceFolder && (
                    this.Core.isFileTargetedFile() ||
                    this.Core.isCssTargetedFile()
                )
            )) {
                return;
            }

            const diagnosticMap = this.lspDiagnostic();
            if (!diagnosticMap[this.Core.filePath]) {
                diagnosticMap[this.Core.filePath] = [];
            }
            
            const thisDiags: vscode.Diagnostic[] = diagnosticMap[this.Core.filePath];
            const assignables = this.Core.getAssignables();
            const attachables = this.Core.getAttachables();
            this.Core.getTagRanges().forEach(tag => {
                tag.cache.hashrules.forEach(i => {
                    if (!this.Core.FileManifest.hashrules[i.attr]) {
                        thisDiags.push(this.createError(i.attrRange, "Invalid Hashrule."));
                    }
                });
                const symclasses = tag.cache.composes.reduce((a, i) => {
                    if (!i.attr.endsWith('&')) {
                        a.push(i);
                    }
                    return a;
                }, [] as t_TrackRange[]);

                symclasses.forEach(i => {
                    const declarations = attachables[i.attr]?.declarations;
                    if (declarations && declarations.length > 1) {
                        thisDiags.push(this.createError(i.attrRange, "Definitions in multiple locations."));
                    }
                    if (assignables[i.attr]) {
                        thisDiags.push(this.createError(i.attrRange, "Assignable rule cannot be reused for declaration."));
                    }
                    if (i.attr.includes("$---")) {
                        thisDiags.push(this.createWaring(i.attrRange, "Symclass identifier shoundn't start with '---'."));
                    }
                });

                if (symclasses.length === 0 && tag.cache.composes.length) {
                    thisDiags.push(this.createError(tag.range, "Symclass missing in declaration scope."));
                } else if (symclasses.length > 1) {
                    symclasses.forEach(i => {
                        thisDiags.push(this.createError(i.attrRange, "Multiple Symclasses found in declaration scope."));
                    });
                };
            });

            const workspace_uri = this.Core.Ed_WorkspaceFolder.uri;
            Object.entries(diagnosticMap).forEach(([p, d]) => {
                const fileuri = vscode.Uri.joinPath(workspace_uri, p);
                this.diagnosticCollection.set(fileuri, d);
            });
        } catch (error) {
            vscode.window.showErrorMessage(`unexpected Error: ${error}`);
        }
    }

}