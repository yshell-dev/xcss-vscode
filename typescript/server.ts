
import path from 'path';
import vscode from 'vscode';
import fileScanner from './helpers/file-scanner';
import { metadataFormat } from './helpers/metadata';
import { COPWEBVIEW as COMPWEBVIEW } from './shared/preview';
import { DIAGNOSTICS } from './internal/diagnostics';
import { DECORATIONS } from './internal/decorations';
import { getDefaultCSSDataProvider, IPropertyData } from 'vscode-css-languageservice';
import { t_FileManifest, m_Metadata, t_TagRange, t_TrackRange, t_StyleManifest } from './types';
import { STATUSBAR as STATEWIDGET } from './internal/status-bar';
import { EVENTSTREAM } from './internal/eventstream';

export class SERVER {

    public CSS_Properties: IPropertyData[] = [];
    public CSS_AtDirectives: IPropertyData[] = [];
    public CSS_PseudoClasses: IPropertyData[] = [];
    public CSS_PseudoElements: IPropertyData[] = [];

    private readonly CSS_GROUP_OPTIONS: Record<string, () => void> = {
        browser: () => {
            const provider = getDefaultCSSDataProvider();
            this.CSS_Properties = provider.provideProperties();
            this.CSS_AtDirectives = provider.provideAtDirectives();
            this.CSS_PseudoClasses = provider.providePseudoClasses();
            this.CSS_PseudoElements = provider.providePseudoElements();
        },
        none: () => {
            this.CSS_Properties = [];
            this.CSS_AtDirectives = [];
            this.CSS_PseudoClasses = [];
            this.CSS_PseudoElements = [];
        }
    };

    private CSS_ACTIVE_SRC = "";
    private readonly CSS_DEFAULT_SRC = Object.keys(this.CSS_GROUP_OPTIONS)[0];

    private CSS_SELECT_GROUP(source: string | unknown = this.CSS_DEFAULT_SRC) {
        if (typeof source === "string" && this.CSS_GROUP_OPTIONS[source]) {
            if (source !== this.CSS_ACTIVE_SRC) {
                this.CSS_GROUP_OPTIONS[source]();
                this.CSS_ACTIVE_SRC = source;
            }
        } else {
            this.CSS_GROUP_OPTIONS[this.CSS_DEFAULT_SRC]();
            this.CSS_ACTIVE_SRC = this.CSS_DEFAULT_SRC;
        }
    }

    // Environment Declared
    public Ed_Id: string;
    public Ed_Uri: vscode.Uri;
    public Ed_IdCap: string;
    public Ed_RootBinTests: string[][];
    public Ed_Editor: vscode.TextEditor | undefined;
    public Ed_Context: vscode.ExtensionContext;
    public Ed_WorkspaceFolder: vscode.WorkspaceFolder | undefined;

    // External Workers
    public W_DIAGNOSTICS: DIAGNOSTICS;
    public W_DECORATIONS: DECORATIONS;
    public W_COMPWEBVIEW: COMPWEBVIEW;
    public W_EVENTSTREAM: EVENTSTREAM;
    public W_STATEWIDGET: STATEWIDGET;

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
        hashrules: {},
        constants: {},
        livecursor: false,
        assistfile: false,
    };

    public StyleManifest: t_StyleManifest = {
        diagnostics: [],
        locales: [],
        symclassData: {},
        symclasses: {},
        assignable: [],
    };

    get config(): vscode.WorkspaceConfiguration {
        return vscode.workspace.getConfiguration(this.Ed_Id);
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
            hashrules: {},
            constants: {},
            livecursor: false,
            assistfile: false,
        };
        this.StyleManifest = {
            diagnostics: [],
            locales: [],
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

        this.W_COMPWEBVIEW?.clear();
        this.W_DECORATIONS?.clear();
        this.W_DIAGNOSTICS?.clear();
    };

    toggle = (): void => {
        this.Flag_ExtnActivated = !this.Flag_ExtnActivated;
        this.reset();
    };

    restart = (): void => {
        this.W_EVENTSTREAM.Kill();
        this.reset();
        this.spawn();
    };

    spawn = (): void => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) { return; }

        this.Ed_WorkspaceFolder = workspaceFolder;
        const workpath = workspaceFolder.uri.fsPath;

        this.W_EVENTSTREAM.Start(workpath, ["server"]);
    };

    public dispose() {
        this.reset();
        this.W_DECORATIONS.dispose();
        this.W_DIAGNOSTICS.dispose();
        this.W_COMPWEBVIEW.dispose();
        this.W_STATEWIDGET.dispose();
        clearTimeout(this.Ref_AutoRefreshId);
    }

    constructor(
        context: vscode.ExtensionContext,
        extensionId: string,
        rootBinTests: string[][]
    ) {
        this.reset();
        this.Ed_Id = extensionId;
        this.Ed_Uri = context.extensionUri;
        this.Ed_IdCap = extensionId.toLocaleUpperCase();
        this.Ed_Context = context;
        this.Ed_RootBinTests = rootBinTests;

        this.W_EVENTSTREAM = new EVENTSTREAM(this);
        this.W_DIAGNOSTICS = new DIAGNOSTICS(this);
        this.W_DECORATIONS = new DECORATIONS(this);
        this.W_COMPWEBVIEW = new COMPWEBVIEW(this);
        this.W_STATEWIDGET = new STATEWIDGET(this);

        this.Ref_AutoRefreshId = setInterval(() => {
            this.RequestManifest();
        }, 250);

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

            vscode.commands.registerCommand(`${this.Ed_Id}.server.toggle`, this.toggle),
            vscode.commands.registerCommand(`${this.Ed_Id}.server.restart`, this.restart),
            vscode.commands.registerCommand(`${this.Ed_Id}.server.send`, this.W_EVENTSTREAM.Interactive),

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

        this.spawn();
        this.RefreshEditor();
        if (!(this.W_EVENTSTREAM.Spawn_IsAlive && vscode.window.activeTextEditor)) {
            return;
        }

        const editor = vscode.window.activeTextEditor;
        this.Ed_Editor = editor || undefined;
        if (!editor) { return; }

        const document = editor.document;
        if (updateSymclass) {
            const wordRange = document.getWordRangeAtPosition(editor.selection.active, this.SymClassRgx);
            const wordString = document.getText(wordRange);
            this.cursorword = wordString.startsWith("-$") ? wordString.replace("-$", "$") : wordString;
        }

        this.filePath = path.relative(workpath, editor.document.uri.fsPath);
        this.fileExtn = editor.document.uri.path.split('.').pop() || '';

        this.W_EVENTSTREAM.JsonRpc("fileManifest", {
            filepath: this.filePath,
            content: document.getText(),
            symclass: this.cursorword,
        });
    };

    UpdateFileManifest = (manifest: t_FileManifest) => {
        this.CSS_SELECT_GROUP(manifest.environment);
        this.FileManifest = manifest;
    };

    UpdateStyleManifest = (manifest: t_StyleManifest) => {
        if (this.ManifestMutexLock) { return; }
        this.ManifestMutexLock = true;
        const attachable: Record<string, m_Metadata> = {};
        const assignable: Record<string, m_Metadata> = {};

        try {
            Object.entries(manifest.symclasses).forEach(([k, i]) => {
                const v = manifest.symclassData[i];
                if (!v.markdown && k.startsWith('/')) {
                    v.markdown = metadataFormat(k, v, `Attachable`);
                }
                attachable[k] = v;
            });

            manifest.assignable.forEach((k) => {
                const v = manifest.symclassData[manifest.symclasses[k]];
                if (v.markdown) {
                    v.markdown = `Assignable & ` + v.markdown;
                } else {
                    v.markdown = metadataFormat(k, v, `Attachable`);
                }
                assignable[k] = v;
            });

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
        if (!this.Ed_Editor
            || !this.Ed_WorkspaceFolder
            || !vscode.window.activeTextEditor
            || !this.isFileTargetedFile()
        ) { return; }

        const content = this.Ed_Editor.document.getText();
        const cursorOffset = this.Ed_Editor.document.offsetAt(this.Ed_Editor.selection.active);
        this.Rs_TagRanges = fileScanner(content, this.FileManifest.attributes, cursorOffset).TagRanges || [];

        this.W_DECORATIONS.refresh();
        this.W_DIAGNOSTICS.refresh();
        this.W_STATEWIDGET.refresh();
    };


    // Folding Range Provider

    public provideFoldingRanges(): vscode.FoldingRange[] {
        return this.Rs_TagRanges.reduce((A, I) => {
            I.cache.composes.forEach(i => {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            });
            I.cache.watchtracks.forEach(i => {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            });
            I.cache.comments.forEach(i => {
                if (i.multiLine) {
                    A.push(new vscode.FoldingRange(i.valRange.start.line, i.valRange.end.line, vscode.FoldingRangeKind.Region));
                }
            });
            return A;
        }, [] as vscode.FoldingRange[]);
    }

    public getTagAtValPairRanges(tracks = true, comments = true, compose = true): t_TrackRange[] {
        return this.Rs_TagRanges.reduce((A, I) => {
            if (tracks) { I.cache.watchtracks.forEach(i => { A.push(i); }); }
            if (comments) { I.cache.comments.forEach(i => { A.push(i); }); }
            if (compose) { I.cache.composes.forEach(i => { A.push(i); }); }
            return A;
        }, [] as t_TrackRange[]);
    }

    public filterVariables(snippet: string, additionals: Record<string, string> = {}): Record<string, string> {
        const vars: Record<string, string> = {};
        Object.entries(this.FileManifest.constants).forEach(([k, v]) => { if (k.startsWith(snippet)) { vars[k] = v; } });
        Object.entries(additionals).forEach(([k, v]) => { if (k.startsWith(snippet)) { vars[k] = v; } });
        return vars;
    }

    public getTogglePath(): string {
        let switchpath = this.filePath;

        if (this.filePath !== "") {
            for (const [k, v] of Object.entries(this.FileManifest.switchmap)) {
                if (this.filePath.startsWith(k)) {
                    switchpath = this.filePath.replace(k, v);
                }
            }
        }

        return path.join(this.Ed_WorkspaceFolder?.uri.path || '.', (switchpath));
    }

    public isExtenActivated(): boolean {
        return this.Flag_ExtnActivated;
    }

    public isCssTargetedFile(): boolean {
        return this.Flag_ExtnActivated &&
            (this.FileManifest.assistfile || this.FileManifest.watchfiles.includes(this.filePath))
            && this.fileExtn === "css";
    }

    public isFileTargetedFile(): boolean {
        return this.Flag_ExtnActivated
            && (this.FileManifest.assistfile || this.FileManifest.watchfiles.includes(this.filePath))
            && this.fileExtn !== "css";
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
        return { ...this.FileManifest.hashrules };
    }

    public getAttachables(): Record<string, m_Metadata> {
        return { ...this.M_attachables };
    }

    public getAssignables(): Record<string, m_Metadata> {
        return { ...this.M_assignable };
    }

    public getFilePath(): string {
        return this.filePath;
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