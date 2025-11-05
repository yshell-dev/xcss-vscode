
import path from 'path';
import vscode from 'vscode';

import { existsSync } from 'fs';
import { t_ManifestGlobal, t_ManifestLocal, } from './types';

import { BRIDGE } from './bridge';
import { WIDGET } from './internal/widget';
import { PALETTE } from './internal/palette';
import { CSSREFERENCE } from './internal/css-refer';
import { DEFINITION } from './internal/definition';
import { FORMATTING } from './internal/formatting';
import { INTELLISENSE } from './internal/intellisense';
import { DIAGNOSTICS } from './internal/diagnostics';
import { DECORATIONS } from './editor';
import { SANDBOX } from './internal/sandbox';
import { FILETOGGLE } from './internal/file-toggle';
import { FOLDRANGE } from './internal/fold-range';
import { SUMMON } from './internal/summon';
import { FILELOCAL } from './file-local';

const ID = "xcss";

export class ExtensionManager {
    readonly ID = ID;
    readonly IDCAP = this.ID.toLocaleUpperCase();
    readonly SymClassRgx = /[\w/$_-]+/i;;
    readonly DeveloperMode: boolean = existsSync(path.resolve(__dirname, "..", "core", "source"));
    get config(): vscode.WorkspaceConfiguration { return vscode.workspace.getConfiguration(this.ID); };

    // External Workers
    public W_SUMMON: SUMMON;
    public W_BRIDGE: BRIDGE;
    public W_WIDGET: WIDGET;
    public W_SANDBOX: SANDBOX;
    public W_PALETTE: PALETTE;
    public W_FOLDRANGE: FOLDRANGE;
    public W_FORMATTING: FORMATTING;
    public W_DEFINITION: DEFINITION;
    public W_FILETOGGLE: FILETOGGLE;
    public W_DIAGNOSTICS: DIAGNOSTICS;
    public W_DECORATIONS: DECORATIONS;
    public W_CSSREFERENCE: CSSREFERENCE;
    public W_INTELLISENSE: INTELLISENSE;

    // Environment Declared
    public Local: FILELOCAL | undefined;
    public Context: vscode.ExtensionContext;
    public WorkspaceFolder: vscode.WorkspaceFolder | undefined;

    // Activity Flags
    private F_ExtnActivated = true;
    get ExtentionStatus() { return this.F_ExtnActivated; }

    // Editor Specifics
    public Global!: t_ManifestGlobal;
    public Locals: Record<string, FILELOCAL> = {};

    reset = (): void => {
        this.Global = {
            fileAttrs: {},
            environment: "",
            customtags: [],
            switchmap: {},
            hashrules: {},
            constants: {},
            symclasses: {},
            attributemap: {},
            diagnostics: [],
        };

        this.W_DIAGNOSTICS?.clear();
    };

    pause = (): void => {
        this.F_ExtnActivated = false;
        this.reset();
    };

    respawn = (): void => {
        this.W_BRIDGE.kill();
        this.reset();
        this.spawn();
    };

    spawn = (): void => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        this.WorkspaceFolder = workspaceFolder;
        const workpath = workspaceFolder.uri.fsPath;

        this.W_BRIDGE.start(workpath, ["server"]);
    };

    public dispose() {
        this.reset();
    }

    constructor(
        context: vscode.ExtensionContext,
    ) {
        this.reset();
        this.Context = context;

        this.W_SUMMON = new SUMMON(this);
        this.W_BRIDGE = new BRIDGE(this);
        this.W_WIDGET = new WIDGET(this);
        this.W_PALETTE = new PALETTE(this);
        this.W_SANDBOX = new SANDBOX(this);
        this.W_FOLDRANGE = new FOLDRANGE(this);
        this.W_DEFINITION = new DEFINITION(this);
        this.W_FORMATTING = new FORMATTING(this);
        this.W_FILETOGGLE = new FILETOGGLE(this);
        this.W_DIAGNOSTICS = new DIAGNOSTICS(this);
        this.W_DECORATIONS = new DECORATIONS(this);
        this.W_CSSREFERENCE = new CSSREFERENCE(this);
        this.W_INTELLISENSE = new INTELLISENSE(this);

        const autoRefresh = setInterval(() => { this.RequestManifest(); }, 250);

        this.Context.subscriptions.push(
            { dispose() { autoRefresh.close(); } },

            this.W_SUMMON,
            this.W_BRIDGE,
            this.W_WIDGET,
            this.W_PALETTE,
            this.W_SANDBOX,
            this.W_FOLDRANGE,
            this.W_DEFINITION,
            this.W_FORMATTING,
            this.W_FILETOGGLE,
            this.W_DIAGNOSTICS,
            this.W_DECORATIONS,
            this.W_CSSREFERENCE,
            this.W_INTELLISENSE,

            vscode.languages.registerColorProvider(['*'], this.W_PALETTE),
            vscode.languages.registerFoldingRangeProvider(['*'], this.W_FOLDRANGE),
            vscode.languages.registerDefinitionProvider({ language: '*', scheme: 'file' }, this.W_DEFINITION),
            vscode.languages.registerCompletionItemProvider(['*'], this.W_INTELLISENSE, ...this.W_INTELLISENSE.triggers),

            vscode.commands.registerCommand(`${this.ID}.action.toggle`, this.W_FILETOGGLE.CommandFileToggle),
            vscode.commands.registerCommand(`${this.ID}.editor.format`, this.W_FORMATTING.formatFile),
            vscode.commands.registerCommand(`${this.ID}.action.compview`, this.W_SANDBOX.Open),
            vscode.commands.registerCommand(`${this.ID}.editor.summon`, this.W_SUMMON.SummonStructure),

            vscode.window.onDidChangeWindowState(() => { this.RefreshEditors(); }),
            vscode.window.tabGroups.onDidChangeTabs(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeActiveTextEditor(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeVisibleTextEditors(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeTextEditorSelection(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeTextEditorViewColumn(() => { this.RefreshEditors(); }),

            vscode.workspace.onDidOpenTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidCloseTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidChangeTextDocument(() => { this.RequestManifest(); }),

            vscode.workspace.onDidDeleteFiles(() => { this.W_BRIDGE.StdIOCmd("rebuild"); }),
            vscode.workspace.onDidCreateFiles(() => { this.W_BRIDGE.StdIOCmd("rebuild"); }),

            vscode.commands.registerCommand(`${this.ID}.server.pause`, this.pause),
            vscode.commands.registerCommand(`${this.ID}.server.restart`, this.respawn),
            vscode.commands.registerCommand(`${this.ID}.server.send`, this.W_BRIDGE.interactive),

        );
    }

    RequestManifest = () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !this.F_ExtnActivated || !this.W_BRIDGE.spawnAlive) { this.reset(); return; }

        this.spawn();
        this.WorkspaceFolder = workspaceFolder;

        this.W_BRIDGE.WSStream("manifest-global", {});
        const fileContents = this.RefreshEditors();
        this.W_BRIDGE.WSStream("manifest-locals", { "filemap": fileContents });
    };

    RefreshEditors = () => {
        const fileContents = this.W_DECORATIONS.refresh();
        this.W_DIAGNOSTICS.refresh();
        this.W_WIDGET.refresh();
        this.W_SANDBOX.refresh();
        return fileContents;
    };

    IsServerWatchingEditorFile(document = vscode.window.activeTextEditor?.document) {
        let watching = false;
        let extension = "";
        if (document) {
            const filepath = this.GetDocumentPath(document);
            watching = (this.F_ExtnActivated && Boolean(this.Locals[filepath]));
            extension = path.extname(filepath);
        }
        return { watching, extension };
    }


    UpdateLocalManifest = (locals: Record<string, t_ManifestLocal>) => {
        for (const relpath of Object.keys(locals)) {
            if (!this.Locals[relpath]) {
                this.Locals[relpath] = new FILELOCAL(this);
            }
            const local = locals[relpath];
            this.Locals[relpath].manifest = local;
            for (const s of Object.keys(local.symclasses)) {
                if (this.Global.symclasses[s]) {
                    this.Global.symclasses[s] = local.symclasses[s];
                }
            }
        }
        this.SetLocal();
        this.RefreshEditors(false);
    };

    UpdateGlobalManifest = (global: t_ManifestGlobal) => {
        if (global) { this.Global = global; }
    };

    SetLocal() {
        const local = this.GetLocal();
        if (local) { this.Local = local; }
    }

    GetLocal(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document) {
        if (!document) { return undefined; }
        return this.Locals[this.GetDocumentPath(document)] || undefined;
    }

    GetHashrules(): Record<string, string> {
        return this.Global.hashrules || {};
    }

    GetDocumentPath(document: vscode.TextDocument, relative = false) {
        if (relative) {
            return document.uri.fsPath.slice((this.WorkspaceFolder?.uri.fsPath.length || 0) + 1);
        } else {
            return document.uri.fsPath;
        }
    }

    GetTargetAttributes(document: vscode.TextDocument): string[] {
        return this.Global.fileAttrs[this.GetDocumentPath(document, true)] || [];
    }

    VarFilter(snippet: string, additionals: Record<string, string> = {}): Record<string, string> {
        const vars: Record<string, string> = {};
        for (const k of Object.keys(this.Global.constants)) {
            if (k.startsWith(snippet)) { vars[k] = this.Global.constants[k]; }
        }
        for (const k of Object.keys(additionals)) {
            if (k.startsWith(snippet)) { vars[k] = additionals[k]; }
        }
        return vars;
    }
}


let Manager: ExtensionManager | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
    try {
        Manager = new ExtensionManager(context);
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`${ID.toLocaleUpperCase()} Extension: Failed to activate extension: ${errorMessage}`, error);
        vscode.window.showErrorMessage(`Failed to activate extension: ${errorMessage}`);
    }
}

export function deactivate(): void {
    try {
        Manager?.dispose();
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error(`${ID.toLocaleUpperCase()} Extension: Failed to deactivate extension: ${errorMessage}`, error);
        vscode.window.showErrorMessage(`Failed to deactivate extension: ${errorMessage}`);
    }
}
