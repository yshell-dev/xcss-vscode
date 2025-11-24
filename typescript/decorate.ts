import vscode from 'vscode';
import fileScanner from './helpers/script-ranges';
import { t_Metadata, t_FileContent, } from './types';
import { ExtensionManager } from './activate';
import { metadataFormat, metamergeFormat } from './helpers/metadata';

export class DECORATIONS {
    private Server: ExtensionManager;

    value_Style: vscode.TextEditorDecorationType | undefined;
    attrs_Style: vscode.TextEditorDecorationType | undefined;
    watch_Style: vscode.TextEditorDecorationType | undefined;
    hash_Style: vscode.TextEditorDecorationType | undefined;
    symclass_Style: vscode.TextEditorDecorationType | undefined;
    comProp_Style: vscode.TextEditorDecorationType | undefined;
    compVal_Style: vscode.TextEditorDecorationType | undefined;
    comment_Style: vscode.TextEditorDecorationType | undefined;


    constructor(core: ExtensionManager) {
        this.Server = core;
        this.updateStyles();
    };

    updateStyles() {
        const c_attribute = this.Server.config.get<string>('decoration.attribute');
        const c_property = this.Server.config.get<string>('decoration.property');
        const c_comment = this.Server.config.get<string>('decoration.comment');
        const c_value = this.Server.config.get<string>('decoration.value');

        this.attrs_Style = vscode.window.createTextEditorDecorationType({
            color: c_attribute,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.watch_Style = vscode.window.createTextEditorDecorationType({
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentText: '(',
                color: 'gray',
            },
            after: {
                contentText: ')',
                color: 'gray',
            },
        });
        this.value_Style = vscode.window.createTextEditorDecorationType({
            color: c_value,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.hash_Style = vscode.window.createTextEditorDecorationType({
            textDecoration: "underline",
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.symclass_Style = vscode.window.createTextEditorDecorationType({
            backgroundColor: "#77777733",
            borderRadius: "4px",
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.comProp_Style = vscode.window.createTextEditorDecorationType({
            color: c_property,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.compVal_Style = vscode.window.createTextEditorDecorationType({
            color: c_value,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentText: '{',
                color: 'gray',
            },
            after: {
                contentText: '}',
                color: 'gray',
            },
        });
        this.comment_Style = vscode.window.createTextEditorDecorationType({
            color: c_comment,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
            before: {
                contentText: '/*',
                color: 'gray',
            },
            after: {
                contentText: '*/',
                color: 'gray',
            },
        });
    }

    clear(editors = vscode.window.visibleTextEditors) {

        for (const editor of editors) {
            if (this.attrs_Style) { editor.setDecorations(this.attrs_Style, []); }
            if (this.watch_Style) { editor.setDecorations(this.watch_Style, []); }
            if (this.value_Style) { editor.setDecorations(this.value_Style, []); }
            if (this.comProp_Style) { editor.setDecorations(this.comProp_Style, []); }
            if (this.compVal_Style) { editor.setDecorations(this.compVal_Style, []); }
            if (this.comment_Style) { editor.setDecorations(this.comment_Style, []); }
            if (this.hash_Style) { editor.setDecorations(this.hash_Style, []); }
            if (this.symclass_Style) { editor.setDecorations(this.symclass_Style, []); }
        };

        this.updateStyles();
    }

    dispose() {
        this.clear();
    }

    refresh() {

        const unusedLocalTracker: Record<string, boolean> = {};
        for (const filepath of Object.keys(this.Server.Locals)) {
            unusedLocalTracker[filepath] = true;
        }

        const fileContentMap: t_FileContent[] = [];
        const editors = vscode.window.visibleTextEditors;

        for (const editor of editors) {
            const doc = this.Server.ReferDocument(editor.document);

            if (unusedLocalTracker[doc.relpath]) {
                unusedLocalTracker[doc.relpath] = false;
            }

            const local = doc.local;
            const cursorOffset = editor.document.offsetAt(editor.selection.active);

            let localhashes: string[] = [];
            let localhashrules: Record<string, string> = {};
            let localsymclasses: Record<string, t_Metadata> = {};
            if (this.Server.ReferDocument(editor.document)) {
                localhashes = local.manifest.hashes;
                localhashrules = this.Server.GetHashrules();
                localsymclasses = local.attachables;
            }

            const content = editor.document.getText();
            const watchAttr = doc.local.watchingAttributes;
            const parsed = fileScanner(content, local.watchingAttributes, cursorOffset);
            fileContentMap.push({ abspath: doc.abspath, relpath: doc.relpath, content });
            doc.local.tagranges = parsed.TagRanges;

            // Apply decorations

            const cmt_Decos: vscode.DecorationOptions[] = [];
            const hash_Decos: vscode.DecorationOptions[] = [];
            const value_Decos: vscode.DecorationOptions[] = [];
            const watch_Decos: vscode.DecorationOptions[] = [];
            const attrs_Decos: vscode.DecorationOptions[] = [];
            const compVal_Decos: vscode.DecorationOptions[] = [];
            const comProp_Decos: vscode.DecorationOptions[] = [];
            const symclass_Decos: vscode.DecorationOptions[] = [];

            // Snippets with in watching attributes
            for (const track of parsed.outsideTagfrags) {
                try {
                    const val = track.val;
                    if (val.length > 2 && val[0] == "\\") {
                        const v1 = val[1];
                        if (v1 == "~" || v1 == "=" || v1 == "!") {
                            const tr_val = val.slice(2);
                            if (localsymclasses[tr_val]) {
                                symclass_Decos.push({ range: track.valRange, hoverMessage: local.getMarkdown(tr_val) });
                            }
                        } else if (val[1] === "#" && localhashes.includes(val.slice(2))) {
                            hash_Decos.push({ range: track.valRange, hoverMessage: "Registered Local Hash" });
                        }
                    } else if (val[0] === "#" && val[1] === "\\" && val[2] === "#" && localhashes.includes(val.slice(3))) {
                        hash_Decos.push({ range: track.valRange, hoverMessage: "Registered Local Hash" });
                    }
                } catch (error) {
                    console.error('Error processing Ranges:', error);
                }
            }

            for (const tagRange of parsed.TagRanges) {

                for (const track of tagRange.cache.comments) {
                    try {
                        if (track.attrRange && track.valRange) {
                            attrs_Decos.push({ range: track.attrRange });
                            cmt_Decos.push({ range: track.valRange });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                for (const track of tagRange.cache.composes) {
                    try {
                        if (track.attrRange && track.valRange) {
                            const f = track.attr.replace(/^[-_]\$/, "$");
                            const metadata = local.getMetadata(f);
                            if (metadata) {
                                Object.assign(tagRange.variables, metadata.variables);
                            }
                            const tooltip = metadata ? metadata.markdown || metadataFormat(`${track.attr} -> ${f} `, metadata) : `${this.Server.IDCAP} Definition.`;
                            attrs_Decos.push({ range: track.attrRange, hoverMessage: tooltip });
                            compVal_Decos.push({ range: track.valRange });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                // Watching Attributes
                for (const track of tagRange.cache.watchtracks) {
                    if (!watchAttr.includes(track.attr)) {
                        continue;
                    }
                    try {
                        if (track.attrRange && track.valRange) {
                            const tildas: t_Metadata[] = [], equals: t_Metadata[] = [], follow: t_Metadata[] = [];
                            for (const frag of (track.fragments ?? [])) {
                                if (frag[0] != "~" && frag[0] != "=" && frag[0] != "!") { continue; }
                                const metadata = local.getMetadata(frag.slice(1));
                                if (metadata) {
                                    switch (frag[0]) {
                                        case '~': tildas.push(metadata); break;
                                        case '=': equals.push(metadata); break;
                                        case '!': follow.push(metadata); break;
                                    }
                                    Object.assign(tagRange.variables, metadata.variables);
                                }
                            }
                            const Metadatas: t_Metadata[] = [...tildas, ...follow, ...equals];
                            const MetadataMerged = metamergeFormat(track.attr, doc.relpath, Metadatas);
                            watch_Decos.push({ range: track.attrRange, hoverMessage: MetadataMerged.toolTip });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                // Snippets with in watching attributes
                for (const track of tagRange.cache.watcherValFrags) {
                    try {
                        if (track.val[0] != "~" && track.val[0] != "=" && track.val[0] != "!") { continue; }
                        const tr_val = track.val.slice(1);
                        if (localsymclasses[tr_val]) {
                            symclass_Decos.push({ range: track.valRange, hoverMessage: local.getMarkdown(tr_val) });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                // Snippets with in watching attributes
                for (const track of tagRange.cache.defaultValFrags) {
                    try {
                        const val = track.val;
                        if (val.length > 2 && val[0] == "\\") {
                            const v1 = val[1];
                            if (v1 == "~" || v1 == "=" || v1 == "!") {
                                const tr_val = val.slice(2);
                                if (localsymclasses[tr_val]) {
                                    symclass_Decos.push({ range: track.valRange, hoverMessage: local.getMarkdown(tr_val) });
                                }
                            } else if (val[1] === "#" && localhashes.includes(val.slice(2))) {
                                hash_Decos.push({ range: track.valRange, hoverMessage: "Registered Local Hash" });
                            }
                        } else if (val[0] === "#" && val[1] === "\\" && val[2] === "#" && localhashes.includes(val.slice(3))) {
                            hash_Decos.push({ range: track.valRange, hoverMessage: "Registered Local Hash" });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }


                // Value from compositoin attributes
                for (const track of tagRange.cache.composeValFrags) {
                    try {
                        const val = track.val;
                        if (track.val.endsWith(":")) {
                            const tr_val = val.slice(0, -1);
                            const found = this.Server.W_CSSREFERENCE.CSS_Properties.find(prop => {
                                return prop.name ? (prop.name === tr_val) : false;
                            });
                            if (found) {
                                comProp_Decos.push({
                                    range: track.valRange,
                                    hoverMessage: found.description?.toString()
                                });
                            }
                        } else if (localsymclasses[val]) {
                            symclass_Decos.push({ range: track.valRange, hoverMessage: local.getMarkdown(val) });
                        } else if (
                            (val[0] === "\\" && val[1] === "#" && localhashes.includes(val.slice(2))) ||
                            (val[0] === "#" && val[1] === "\\" && val[2] === "#" && localhashes.includes(val.slice(3)))
                        ) {
                            hash_Decos.push({ range: track.valRange, hoverMessage: "Registered Local Hash" });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                for (const track of tagRange.cache.hashrules) {
                    try {
                        if (track.valRange) {
                            if (localhashrules[track.val]) {
                                hash_Decos.push({
                                    range: track.valRange,
                                    hoverMessage: `Hashrule: \`${localhashrules[track.val]}\``
                                });
                            }
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }
            }

            if (this.attrs_Style) { editor.setDecorations(this.attrs_Style, attrs_Decos); }
            if (this.watch_Style) { editor.setDecorations(this.watch_Style, watch_Decos); }
            if (this.value_Style) { editor.setDecorations(this.value_Style, value_Decos); }
            if (this.comProp_Style) { editor.setDecorations(this.comProp_Style, comProp_Decos); }
            if (this.compVal_Style) { editor.setDecorations(this.compVal_Style, compVal_Decos); }
            if (this.comment_Style) { editor.setDecorations(this.comment_Style, cmt_Decos); }
            if (this.hash_Style) { editor.setDecorations(this.hash_Style, hash_Decos); }
            if (this.symclass_Style) { editor.setDecorations(this.symclass_Style, symclass_Decos); }
        }

        for (const filepath of Object.keys(unusedLocalTracker)) {
            if (unusedLocalTracker[filepath]) {
                delete unusedLocalTracker[filepath];
            }
        }

        return fileContentMap;
    };
}