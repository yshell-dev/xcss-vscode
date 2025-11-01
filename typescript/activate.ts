import fs from 'fs/promises';
import path from 'path';
import vscode from 'vscode';
import fileScanner from './helpers/file-scanner';

import { existsSync } from 'fs';
import { metadataFormat } from './helpers/metadata';
import { t_FileManifest, m_Metadata, t_TagRange, t_TrackRange, t_StyleManifest } from './types';

import { BRIDGE } from './bridge';
import { WIDGET } from './shared/widget';
import { PALETTE } from './shared/palette';
import { CSSREFER } from './shared/css-refer';
import { DEFINITION } from './internal/definition';
import { FORMATTING } from './internal/formatting';
import { INTELLISENSE } from './shared/intellisense';
import { DIAGNOSTICS } from './internal/diagnostics';
import { DECORATIONS } from './internal/decorations';

const ID = "xcss";

export class ExtensionManager {
    readonly ID = ID;
    readonly IDCAP = this.ID.toLocaleUpperCase();
    readonly developerMode: boolean = existsSync(path.resolve(__dirname, "..", "core", "source"));
    readonly statusbarRefreshInterval = 1000;

    private W_DEFINITION: DEFINITION | undefined;
    private W_FORMATTING: FORMATTING | undefined;
    private W_INTELLISENSE: INTELLISENSE | undefined;
    private W_PALETTE: PALETTE | undefined;

    private Context: vscode.ExtensionContext | undefined;
    private Disposable: vscode.Disposable[] = [];

    private statusBarUpdateInterval: NodeJS.Timeout | undefined;

    // Environment Declared
    public Ed_Uri: vscode.Uri;
    public Ed_Editor: vscode.TextEditor | undefined;
    public Ed_Context: vscode.ExtensionContext;
    public Ed_WorkspaceFolder: vscode.WorkspaceFolder | undefined;

    // External Workers
    public W_DIAGNOSTICS: DIAGNOSTICS;
    public W_DECORATIONS: DECORATIONS;
    public W_EVENTSTREAM: BRIDGE;
    public W_STATEWIDGET: WIDGET;
    public W_CSSREFERENCE: CSSREFER;

    // Activity Flags
    private Flag_ExtnActivated = true;
    private ManifestMutexLock = false;
    private Ref_AutoRefreshId: NodeJS.Timeout | undefined;

    // Values from manifest
    public SymClassRgx = /[\w/$_-]+/i;;

    // Ranges Saved on Parse
    public filePath = "";
    public fileExtn = "";
    private cursorword = "";
    private Rs_TagRanges: t_TagRange[] = [];
    private M_assignable: Record<string, m_Metadata> = {};
    private M_attachables: Record<string, m_Metadata> = {};

    // Editor Specifics
    public FileManifest: t_FileManifest = {
        watchfiles: [],
        webviewurl: "",
        webviewport: 0,
        environment: "",
        switchmap: {},
        attributes: [],
        customtags: [],
        livecursor: false,
        assistfile: false,
    };

    public StyleManifest: t_StyleManifest = {
        diagnostics: [],
        hashrules: {},
        constants: {},
        symclassData: {},
        symclasses: {},
        assignable: [],
    };

    get config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.ID);
    };

    reset = (): void => {
        this.FileManifest = {
            watchfiles: [],
            webviewurl: "",
            webviewport: 0,
            environment: "",
            switchmap: {},
            attributes: [],
            customtags: [],
            livecursor: false,
            assistfile: false,
        };
        this.StyleManifest = {
            constants: {},
            hashrules: {},
            diagnostics: [],
            symclassData: {},
            symclasses: {},
            assignable: [],
        };

        this.M_attachables = {};
        this.M_assignable = {};
        this.Rs_TagRanges = [];

        this.filePath = "";
        this.fileExtn = "";
        this.cursorword = "";

        this.W_DIAGNOSTICS?.clear();
    };

    pause = (): void => {
        this.Flag_ExtnActivated = false;
        this.reset();
    };

    respawn = (): void => {
        this.W_EVENTSTREAM.kill();
        this.reset();
        this.spawn();
    };

    spawn = (): void => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        this.Ed_WorkspaceFolder = workspaceFolder;
        const workpath = workspaceFolder.uri.fsPath;

        this.W_EVENTSTREAM.start(workpath, ["server"]);
    };

    public dispose() {
        this.reset();
        this.W_DECORATIONS.dispose();
        this.W_DIAGNOSTICS.dispose();
        this.W_STATEWIDGET.dispose();
        clearTimeout(this.Ref_AutoRefreshId);



        if (this.statusBarUpdateInterval) {
            clearInterval(this.statusBarUpdateInterval);
            this.statusBarUpdateInterval = undefined;
        }

        this.Disposable.forEach((d) => { if (d.dispose) { d.dispose(); } });
        this.Disposable = [];
    }

    constructor(
        context: vscode.ExtensionContext,
    ) {
        this.reset();
        this.Ed_Uri = context.extensionUri;
        this.Ed_Context = context;

        this.W_CSSREFERENCE = new CSSREFER();
        this.W_INTELLISENSE = new INTELLISENSE(this);
        this.W_EVENTSTREAM = new BRIDGE(this);
        this.W_DIAGNOSTICS = new DIAGNOSTICS(this);
        this.W_DECORATIONS = new DECORATIONS(this);
        this.W_STATEWIDGET = new WIDGET(this);
        this.W_DEFINITION = new DEFINITION(this);
        this.W_FORMATTING = new FORMATTING(this);
        this.W_PALETTE = new PALETTE(this);

        this.Ref_AutoRefreshId = setInterval(() => {
            this.RequestManifest();
        }, 250);

        this.Context = context;
        if (!this.Context) { return; };


        const ColorPicks = vscode.languages.registerColorProvider(['*'], this.W_PALETTE);
        const FoldRanges = vscode.languages.registerFoldingRangeProvider(['*'], this);
        const Definition = vscode.languages.registerDefinitionProvider({ language: '*', scheme: 'file' }, this.W_DEFINITION);
        const Assistance = vscode.languages.registerCompletionItemProvider(['*'], this.W_INTELLISENSE, ...this.W_INTELLISENSE.triggers);
        const SummonHere = vscode.commands.registerCommand(`${this.ID}.editor.summon`, this.SummonStructure);
        const FileSwitch = vscode.commands.registerCommand(`${this.ID}.action.toggle`, this.CommandFileToggle);
        const Formatting = vscode.commands.registerCommand(`${this.ID}.editor.format`, this.W_FORMATTING.formatFile);
        const PreviewNow = vscode.commands.registerCommand(`${this.ID}.action.compview`, this.OpenSandbox);

        this.Disposable.push(
            this.W_PALETTE,
            this.W_FORMATTING,
            this.W_DEFINITION,
            this.W_INTELLISENSE,
            ColorPicks,
            PreviewNow,
            SummonHere,
            Definition,
            Assistance,
            FileSwitch,
            Formatting,
            FoldRanges,
        );
        this.Ed_Context.subscriptions.push(

            vscode.window.onDidChangeWindowState(() => { this.RefreshEditor(); }),
            vscode.window.tabGroups.onDidChangeTabs(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeActiveTextEditor(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeVisibleTextEditors(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeTextEditorSelection(() => { this.RefreshEditor(); }),
            vscode.window.onDidChangeTextEditorViewColumn(() => { this.RefreshEditor(); }),

            vscode.workspace.onDidOpenTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidCloseTextDocument(() => { this.RequestManifest(); }),
            vscode.workspace.onDidChangeTextDocument(() => { this.RequestManifest(); }),

            vscode.workspace.onDidDeleteFiles(() => { this.W_EVENTSTREAM.stdIoRpc("rebuild"); }),
            vscode.workspace.onDidCreateFiles(() => { this.W_EVENTSTREAM.stdIoRpc("rebuild"); }),

            vscode.commands.registerCommand(`${this.ID}.server.pause`, this.pause),
            vscode.commands.registerCommand(`${this.ID}.server.restart`, this.respawn),
            vscode.commands.registerCommand(`${this.ID}.server.send`, this.W_EVENTSTREAM.interactive),

        );
    }

    RequestManifest = (updateSymclass = this.FileManifest.livecursor) => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder || !this.Flag_ExtnActivated) {
            this.reset();
            return;
        }
        this.Ed_WorkspaceFolder = workspaceFolder;
        const workpath = workspaceFolder.uri.fsPath;

        const editor = vscode.window.activeTextEditor;
        this.Ed_Editor = editor || undefined;
        if (!editor) { return; }

        this.spawn();
        if (!this.W_EVENTSTREAM.spawnAlive) {
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

        this.W_EVENTSTREAM.jsonRpc("fileManifest", {
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
        if (this.ManifestMutexLock) { return; }
        this.ManifestMutexLock = true;
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
            this.ManifestMutexLock = false;

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
        this.W_STATEWIDGET.refresh();
    };

    public previewPanal: vscode.WebviewPanel | undefined;
    OpenSandbox = async () => {

        this.RequestManifest(true);

        if (this.previewPanal) {
            this.previewPanal.reveal(vscode.ViewColumn.Active);
        } else if (this.FileManifest.webviewport > 0) {
            this.previewPanal = vscode.window.createWebviewPanel(
                this.FileManifest.webviewurl,
                this.IDCAP + ' Component Sandbox',
                {
                    viewColumn: vscode.ViewColumn.Beside,
                    preserveFocus: false
                },
                {
                    enableScripts: true,
                    localResourceRoots: [
                        this.Ed_Uri,
                        this.Ed_WorkspaceFolder?.uri || this.Ed_Uri
                    ]
                }
            );

            vscode.env.asExternalUri(
                vscode.Uri.parse(this.FileManifest.webviewurl)
            );

            this.previewPanal.onDidDispose(() => {
                this.previewPanal = undefined;
            }, null, this.Ed_Context.subscriptions);

            this.previewPanal.webview.html = `
            <!DOCTYPE html>
            <html lang="en">
                <body style="margin:0;padding:0;">
                    <iframe 
                    src="${this.FileManifest.webviewurl}" 
                    style="
                        width:100%;
                        height:100%;
                        border:none;
                        top: 0;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        position: absolute;
                    "> </iframe>
                </body>
            </html>
            `;
        }

        return;
    };

    CommandFileToggle = async () => {

        async function fileExists(filePath: string): Promise<boolean> {
            try {
                await fs.access(filePath);
                return true;
            } catch {
                return false;
            }
        }

        try {
            const filePath = this.getTogglePath() || "";
            if (filePath) {
                if (await fileExists(filePath)) {
                    const targetUri = vscode.Uri.file(filePath);
                    await vscode.commands.executeCommand('vscode.open', targetUri, {
                        viewColumn: vscode.ViewColumn.Active
                    });
                    return;
                } else if (path.extname(filePath) === `.${this.ID}`) {
                    vscode.window.showErrorMessage(`Toggle unavailable for *.${this.ID} files: ${filePath}`);
                    return;
                } else {
                    vscode.window.showErrorMessage(`Corresponding file not found: ${filePath}`);
                    return;
                }
            }
            vscode.window.showErrorMessage('File is not in any source or target directory defined.');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to switch: ${errorMessage}`);
        }
    };


    SummonStructure = async () => {
        if (!this.Ed_Editor) { return; }

        const attachables = this.getAttachables();
        const document = this.Ed_Editor.document;
        const selection = this.Ed_Editor.selection;
        const wordRange = !selection.isEmpty ? selection
            : document.getWordRangeAtPosition(selection.active, this.SymClassRgx);
        const fragment = document.getText(wordRange);

        if (!wordRange) { return; }
        const tagRange = this.getTagRanges().find(r => r.range.contains(wordRange));
        if (!tagRange) { return; }

        if (wordRange && attachables[fragment]?.summon && tagRange) {
            await this.Ed_Editor.edit(editBuilder => {
                editBuilder.insert(tagRange.range.end, '\n' + attachables[fragment].summon);
            }, { undoStopBefore: true, undoStopAfter: true });
        }
    };

    // Folding Range Provider

    public provideFoldingRanges(): vscode.FoldingRange[] {
        const A: vscode.FoldingRange[] = [];
        for (const I of this.Rs_TagRanges) {
            for (const i of I.cache.composes) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.watchtracks) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
            for (const i of I.cache.comments) {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            }
        }
        return A;
    }

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

    public getTogglePath(): string {
        let switchpath = this.filePath;

        if (this.filePath !== "") {
            for (const k of Object.keys(this.FileManifest.switchmap)) {
                if (this.filePath.startsWith(k)) {
                    switchpath = this.filePath.replace(k, this.FileManifest.switchmap[k]);
                }
            }
        }

        return path.join(this.Ed_WorkspaceFolder?.uri.fsPath || '.', (switchpath));
    }

    public isExtenActivated(): boolean {
        return this.Flag_ExtnActivated;
    }

    public CheckEditorPathWatching(editor = vscode.window.activeTextEditor) {
        const workpath = this.getWorkspaceFolder();
        if (!workpath || !editor) { return false; }

        const filePath = path.relative(workpath.uri.fsPath, editor.document.uri.fsPath);
        return this.FileManifest.watchfiles.includes(filePath);
    }

    public isCssTargetedFile(): boolean {
        return this.Flag_ExtnActivated && this.fileExtn === "css" &&
            (this.FileManifest.assistfile || this.CheckEditorPathWatching());
    }

    public isFileTargetedFile(): boolean {
        return this.Flag_ExtnActivated && this.fileExtn !== "css" &&
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
        return { ...this.StyleManifest.hashrules };
    }

    public getAttachables(): Record<string, m_Metadata> {
        return { ...this.M_attachables };
    }

    public getAssignables(): Record<string, m_Metadata> {
        return { ...this.M_assignable };
    }

    public getEditor(): vscode.TextEditor | undefined {
        return this.Ed_Editor;
    }

    public getWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
        return this.Ed_WorkspaceFolder;
    }

    public getFileExtension(): string {
        return this.fileExtn;
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
