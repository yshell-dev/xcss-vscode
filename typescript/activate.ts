
import path from 'path';
import vscode from 'vscode';
import fileScanner from './helpers/file-scanner';

import { existsSync } from 'fs';
import { metadataFormat } from './helpers/metadata';
import { m_Metadata, t_GlobalManifest, t_TrackRange, } from './types';

import { BRIDGE } from './bridge';
import { WIDGET } from './internal/widget';
import { PALETTE } from './internal/palette';
import { CSSREFERENCE } from './internal/css-refer';
import { DEFINITION } from './internal/definition';
import { FORMATTING } from './internal/formatting';
import { INTELLISENSE } from './internal/intellisense';
import { DIAGNOSTICS } from './internal/diagnostics';
import { DECORATIONS } from './internal/decorations';
import { SANDBOX } from './internal/sandbox';
import { FILETOGGLE } from './internal/file-toggle';
import { FOLDRANGE } from './internal/fold-range';
import { SUMMON } from './internal/summon';

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
    public Context: vscode.ExtensionContext;
    public Editor: vscode.TextEditor | undefined;
    public WorkspaceFolder: vscode.WorkspaceFolder | undefined;

    // Ranges Saved on Parse
    public filePath = "";
    public fileExtn = "";
    public cursorword = "";

    // Activity Flags
    private F_ManifestMutex = false;
    private F_ExtnActivated = true;
    get ExtentionStatus() { return this.F_ExtnActivated; }

    // Editor Specifics
    public GlobalManifest!: t_GlobalManifest;
    public LocalManifests: Record<string, t_GlobalManifest> = {};
    public SandboxStates: Record<string, string | boolean> = {};

    reset = (): void => {
        this.GlobalManifest = {
            watchfiles: [],
            environment: "",
            customtags: [],
            switchmap: {},
            hashrules: {},
            constants: {},
            symclasses: {},
            attributemap: {},
            diagnostics: [],
        };

        this.cursorword = "";
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
        this.W_CSSREFERENCE = new CSSREFERENCE();
        this.W_INTELLISENSE = new INTELLISENSE(this);

        const autoRefresh = setInterval(() => {
            this.RequestManifest();
        }, 250);


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
            vscode.commands.registerCommand(`${this.ID}.action.compview`, this.W_SANDBOX.OpenSandbox),
            vscode.commands.registerCommand(`${this.ID}.editor.summon`, this.W_SUMMON.SummonStructure),

            vscode.window.onDidChangeWindowState(() => { this.RefreshEditor(); }),
            vscode.window.tabGroups.onDidChangeTabs(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeActiveTextEditor(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeVisibleTextEditors(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeTextEditorSelection(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeTextEditorViewColumn(() => { this.RefreshEditor(); }),

            vscode.workspace.onDidOpenTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidCloseTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidChangeTextDocument(() => { this.RequestManifest(); }),

            vscode.workspace.onDidDeleteFiles(() => { this.W_BRIDGE.stdIoRpc("rebuild"); }),
            vscode.workspace.onDidCreateFiles(() => { this.W_BRIDGE.stdIoRpc("rebuild"); }),

            vscode.commands.registerCommand(`${this.ID}.server.pause`, this.pause),
            vscode.commands.registerCommand(`${this.ID}.server.restart`, this.respawn),
            vscode.commands.registerCommand(`${this.ID}.server.send`, this.W_BRIDGE.interactive),

        );
    }

    RequestManifest = (updateSymclass = this.SandboxStates["livecursor"] as boolean) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !this.F_ExtnActivated) {
            this.reset();
            return;
        }
        this.WorkspaceFolder = workspaceFolder;
        const workpath = workspaceFolder.uri.fsPath;

        const editor = vscode.window.activeTextEditor;
        this.Editor = editor || undefined;
        if (!editor) { return; }

        this.spawn();
        if (!this.W_BRIDGE.spawnAlive) {
            this.reset();
            return;
        }
        this.RefreshEditor();


        const document = editor.document;
        this.filePath = path.relative(workpath, editor.document.uri.fsPath);
        this.fileExtn = editor.document.uri.path.split('.').pop() || '';

        if (updateSymclass) {
            const wordRange = document.getWordRangeAtPosition(editor.selection.active, this.SymClassRgx);
            const wordString = document.getText(wordRange);
            this.cursorword = wordString.startsWith("-$") ? wordString.replace("-$", "$") : wordString;
        }

        this.W_BRIDGE.jsonRpc("fileManifest", {
            filepath: this.filePath,
            content: document.getText(),
            symclass: this.cursorword,
        });
    };

    UpdateFileManifest = (manifest: t_FileManifest) => {
        this.W_CSSREFERENCE.select(manifest.environment);
        this.FileManifest = manifest;
    };

    UpdateStyleManifest = (manifest: t_StyleManifest) => {
        if (this.F_ManifestMutex) { return; }
        this.F_ManifestMutex = true;
        const attachable: Record<string, m_Metadata> = {};
        const assignable: Record<string, m_Metadata> = {};

        try {
            for (const k of Object.keys(manifest.symclasses)) {
                const i = manifest.symclasses[k];
                const v = manifest.symclassData[i];
                if (!v.markdown && k.startsWith('/')) {
                    v.markdown = metadataFormat(k, v, `Attachable`);
                }
                attachable[k] = v;
            }

            for (const k of manifest.assignable) {
                const v = manifest.symclassData[manifest.symclasses[k]];
                if (v.markdown) {
                    v.markdown = `Assignable & ` + v.markdown;
                } else {
                    v.markdown = metadataFormat(k, v, `Attachable`);
                }
                assignable[k] = v;
            }

            this.StyleManifest = manifest;
        } catch (err) {
            this.reset();
            vscode.window.showErrorMessage(`Error updating manifest: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            this.M_attachables = attachable;
            this.M_assignable = assignable;
            this.F_ManifestMutex = false;

            this.RefreshEditor();
        }
    };

    RefreshEditor = () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) { return; }

        const content = editor.document.getText();
        const cursorOffset = editor.document.offsetAt(editor.selection.active);
        this.Rs_TagRanges = fileScanner(content, this.FileManifest.attributes, cursorOffset).TagRanges || [];

        this.W_DECORATIONS.refresh();
        this.W_DIAGNOSTICS.refresh();
        this.W_WIDGET.refresh();
    };

    public getTagAtValPairRanges(tracks = true, comments = true, compose = true): t_TrackRange[] {
        const acc: t_TrackRange[] = [];
        for (const I of this.Rs_TagRanges) {
            if (tracks) {
                for (const i of I.cache.watchtracks) { acc.push(i); }
            }
            if (comments) {
                for (const i of I.cache.comments) { acc.push(i); }
            }
            if (compose) {
                for (const i of I.cache.composes) { acc.push(i); }
            }
        }
        return acc;
    }

    public filterVariables(snippet: string, additionals: Record<string, string> = {}): Record<string, string> {
        const vars: Record<string, string> = {};
        for (const k of Object.keys(this.StyleManifest.constants)) {
            if (k.startsWith(snippet)) { vars[k] = this.StyleManifest.constants[k]; }
        }
        for (const k of Object.keys(additionals)) {
            if (k.startsWith(snippet)) { vars[k] = additionals[k]; }
        }
        return vars;
    }

    public FetchTargetAttributes(editor: vscode.TextEditor): string[] {
        const extension = path.extname(editor?.document)?.slice(1) || "";
        const targetFolder = this.GlobalManifest.attributemap?.[targetFolder]?.[extension] || []

        return [];
    }

    public CheckEditorPathWatching(editor = vscode.window.activeTextEditor) {
        const workpath = this.getWorkspaceFolder();
        if (!workpath || !editor) { return false; }

        const filePath = path.relative(workpath.uri.fsPath, editor.document.uri.fsPath);
        return this.FileManifest.watchfiles.includes(filePath);
    }

    public isCssTargetedFile(): boolean {
        return this.F_ExtnActivated && this.fileExtn === "css" &&
            (this.FileManifest.assistfile || this.CheckEditorPathWatching());
    }

    public isFileTargetedFile(): boolean {
        return this.F_ExtnActivated && this.fileExtn !== "css" &&
            (this.FileManifest.assistfile || this.CheckEditorPathWatching());
    }

    public getAttributes(): string[] {
        return Array.isArray(this.FileManifest.attributes) ? [...this.FileManifest.attributes] : [];
    }

    public getTagRanges() {
        return [...this.Rs_TagRanges];
    }

    public getManifest(): t_FileManifest {
        return { ...this.FileManifest };
    }

    public getHashrules(): Record<string, string> {
        return { ...this.GlobalManifest.hashrules };
    }

    public getAttachables(editor = vscode.window.activeTextEditor): Record<string, m_Metadata> {
        return { ...this.M_attachables };
    }

    public getAssignables(): Record<string, m_Metadata> {
        return { ...this.M_assignable };
    }

    AssistingActive(): boolean {

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
