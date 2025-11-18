
import path from 'path';
import vscode from 'vscode';

import { existsSync } from 'fs';
import { t_Manifest_Mixed, t_ManifestGlobal, t_ManifestLocals, } from './types';

import { BRIDGE } from './bridge';
import { WIDGET } from './internal/widget';
import { PALETTE } from './internal/palette';
import { CSSREFERENCE } from './internal/css-refer';
import { DEFINITION } from './internal/definition';
import { FORMATTING } from './internal/formatting';
import { INTELLISENSE } from './internal/intellisense';
import { DIAGNOSTICS } from './internal/diagnostics';
import { DECORATIONS } from './decorate';
import { SANDBOX } from './internal/sandbox';
import { FILETOGGLE } from './internal/file-toggle';
import { FOLDRANGE } from './internal/fold-range';
import { SUMMON } from './internal/summon';
import { FILELOCAL } from './file-local';

const ID = "xcss";
const PORT = 1248;

export class ExtensionManager {
    readonly ID = ID;
    readonly PORT = PORT;
    readonly IDCAP = this.ID.toLocaleUpperCase();
    readonly SymClassRgx = /[\w/$_-]+/i;;
    readonly DeveloperMode: boolean = existsSync(path.resolve(__dirname, "..", "package", "source"));
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
    public Context: vscode.ExtensionContext;
    public WorkspaceUri: vscode.Uri | undefined;

    // Activity Flags
    private F_ExtnActivated = true;
    get ExtentionStatus() { return this.F_ExtnActivated; }

    // Editor Specifics
    public Global!: t_ManifestGlobal;
    public Locals: Record<string, FILELOCAL> = {};

    reset = (): void => {
        this.Global = {
            fileToAttributes: {},
            environment: "",
            customtags: [],
            switchmap: {},
            hashrules: {},
            constants: {},
            symclasses: {},
            diagnostics: [],
        };

        this.W_DIAGNOSTICS?.clear();
        this.AwaitRequest = false;
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

        this.WorkspaceUri = workspaceFolder.uri;
        const workpath = workspaceFolder.uri.fsPath;

        this.W_BRIDGE.start(workpath, ["server", this.PORT.toString()]);
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

            vscode.commands.registerCommand(`${this.ID}.server.pause`, this.pause),
            vscode.commands.registerCommand(`${this.ID}.server.restart`, this.respawn),
            vscode.commands.registerCommand(`${this.ID}.server.send`, this.W_BRIDGE.interactive),

            vscode.window.onDidChangeWindowState(() => { this.RefreshEditors(); }),
            vscode.window.tabGroups.onDidChangeTabs(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeActiveTextEditor(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeVisibleTextEditors(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeTextEditorSelection(() => { this.RefreshEditors(); }),
            vscode.window.onDidChangeTextEditorViewColumn(() => { this.RefreshEditors(); }),

            vscode.workspace.onDidOpenTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidCloseTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidChangeTextDocument(() => { this.RequestManifest(); }),
        );
    }

    AwaitRequest = false;
    RequestManifest = () => {
        const params = this.RefreshEditors();
        if (this.AwaitRequest) { return; }

        try {
            this.AwaitRequest = true;
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder || !this.F_ExtnActivated || !this.W_BRIDGE.spawnAlive) {
                this.reset();
                return;
            }

            this.spawn();
            this.WorkspaceUri = workspaceFolder.uri;

            this.W_BRIDGE.WSStream("manifest-mixed", params);
        } finally {
            this.AwaitRequest = false;
        }
    };

    RefreshEditors = () => {
        const filemap = this.W_DECORATIONS.refresh();
        this.W_DIAGNOSTICS.clientRefresh();
        this.W_DIAGNOSTICS.serverRefresh();
        this.W_WIDGET.refresh();
        const cursor = this.W_SANDBOX.refresh();
        return { ...cursor, filemap };
    };

    UpdateGlobalManifest = (global: t_ManifestGlobal) => {
        if (global) { this.Global = global; }
    };

    UpdateMixedManifest = (m: t_Manifest_Mixed) => {
        this.UpdateGlobalManifest(m.global);
        this.UpdateLocalsManifest(m.locals);
    };

    UpdateLocalsManifest = (locals: Record<string, t_ManifestLocals>) => {
        for (const relpath of Object.keys(locals)) {
            if (!this.Locals[relpath]) { this.Locals[relpath] = new FILELOCAL(this); }
            const manifest = locals[relpath];
            this.Locals[relpath].updateManifest(manifest);
        }
        this.RefreshEditors();
    };

    ReferDocument(document: vscode.TextDocument | undefined = vscode.window.activeTextEditor?.document) {
        const abspath = document?.uri.fsPath || "";
        let relpath = abspath;
        let attributes: string[] = [];
        let local = new FILELOCAL(this);
        let watching = false;
        let extension = "";

        if (document) {
            const workspacePath = this.WorkspaceUri?.fsPath || "/";
            extension = path.extname(abspath);
            relpath = path.relative(workspacePath, abspath);

            const attrs = this.Global.fileToAttributes[relpath];
            watching = this.F_ExtnActivated && Boolean(attrs);
            attributes = attrs || [];

            if (this.Locals[relpath]) {
                local = this.Locals[relpath];
            } else {
                this.Locals[relpath] = local;
            }
            local.attributes = attributes;
        }

        return { relpath, abspath, watching, extension, local, document };
    }

    GetHashrules(): Record<string, string> {
        return this.Global.hashrules || {};
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
