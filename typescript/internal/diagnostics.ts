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

    // Diagnostics
    refresh() {
        try {
            if (!(this.Core.Ed_Editor && (this.Core.isFileTargetedFile() || this.Core.isCssTargetedFile()))) { return; }
            const documentUri = this.Core.Ed_Editor.document.uri;
            const finalDiagnostics: vscode.Diagnostic[] = [];
            const assignables = this.Core.getAssignables();
            const attachables = this.Core.getAttachables();
            this.Core.getTagRanges().forEach(tag => {
                tag.cache.hashrules.forEach(i => {
                    if (!this.Core.FileManifest.hashrules[i.attr]) {
                        finalDiagnostics.push(this.createError(i.attrRange, "Invalid Hashrule."));
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
                        finalDiagnostics.push(this.createError(i.attrRange, "Definitions in multiple locations."));
                    }
                    if (assignables[i.attr]) {
                        finalDiagnostics.push(this.createError(i.attrRange, "Assignable rule cannot be reused for declaration."));
                    }
                    if (i.attr.includes("$---")) {
                        finalDiagnostics.push(this.createWaring(i.attrRange, "Symclass identifier shoundn't start with '---'."));
                    }
                });

                if (symclasses.length === 0 && tag.cache.composes.length) {
                    finalDiagnostics.push(this.createError(tag.range, "Symclass missing in declaration scope."));
                } else if (symclasses.length > 1) {
                    symclasses.forEach(i => {
                        finalDiagnostics.push(this.createError(i.attrRange, "Multiple Symclasses found in declaration scope."));
                    });
                };
            });

            this.diagnosticCollection.set(documentUri, finalDiagnostics);
        } catch (error) {
            vscode.window.showErrorMessage(`unexpected Error: ${error}`);
        }
    }

}