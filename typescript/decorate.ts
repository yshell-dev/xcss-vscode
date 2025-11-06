import vscode from 'vscode';
import fileScanner from './helpers/file-scanner';
import { m_Metadata, t_FileContent, } from './types';
import { ExtensionManager } from './activate';
import { metadataFormat, metamergeFormat } from './helpers/metadata';

export class DECORATIONS {
    private Server: ExtensionManager;

    attrs_Style: vscode.TextEditorDecorationType | undefined;
    value_Style: vscode.TextEditorDecorationType | undefined;
    hashrule_Style: vscode.TextEditorDecorationType | undefined;
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
        this.value_Style = vscode.window.createTextEditorDecorationType({
            color: c_value,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });

        this.hashrule_Style = vscode.window.createTextEditorDecorationType({
            textDecoration: "underline",
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.symclass_Style = vscode.window.createTextEditorDecorationType({
            fontWeight: "700",
            fontStyle: "italic",
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
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
            if (this.value_Style) { editor.setDecorations(this.value_Style, []); }
            if (this.comProp_Style) { editor.setDecorations(this.comProp_Style, []); }
            if (this.compVal_Style) { editor.setDecorations(this.compVal_Style, []); }
            if (this.comment_Style) { editor.setDecorations(this.comment_Style, []); }
            if (this.hashrule_Style) { editor.setDecorations(this.hashrule_Style, []); }
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

        for (const editor of vscode.window.visibleTextEditors) {
            const doc = this.Server.ReferDocument(editor.document);

            if (unusedLocalTracker[doc.relpath]) {
                unusedLocalTracker[doc.relpath] = false;
            }

            const local = doc.local;
            const cursorOffset = editor.document.offsetAt(editor.selection.active);

            let localhashrules: Record<string, string> = {};
            let localsymclasses: Record<string, m_Metadata> = {};
            if (this.Server.ReferDocument(editor.document)) {
                localhashrules = this.Server.GetHashrules();
                localsymclasses = local.attachables;
            }

            const content = editor.document.getText();
            const parsed = fileScanner(content, doc.local.attributes, cursorOffset);
            fileContentMap.push({ abspath: doc.abspath, relpath: doc.relpath, content });
            doc.local.tagranges = parsed.TagRanges;

            // Apply decorations

            const comment_Decos: vscode.DecorationOptions[] = [];
            const hashrule_Decos: vscode.DecorationOptions[] = [];
            const value_Decos: vscode.DecorationOptions[] = [];
            const attrs_Decos: vscode.DecorationOptions[] = [];
            const compVal_Decos: vscode.DecorationOptions[] = [];
            const symclass_Decos: vscode.DecorationOptions[] = [];
            const comProp_Decos: vscode.DecorationOptions[] = [];

            for (const tagRange of parsed.TagRanges) {

                for (const track of tagRange.cache.comments) {
                    try {
                        if (track.attrRange && track.valRange) {
                            attrs_Decos.push({ range: track.attrRange });
                            comment_Decos.push({ range: track.valRange });
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

                // Class Properties
                for (const track of tagRange.cache.watchtracks) {
                    try {
                        if (track.attrRange && track.valRange) {
                            const Metadatas: m_Metadata[] = [];
                            for (const frag of (track.fragments ?? [])) {
                                const metadata = local.getMetadata(frag.slice(1));
                                if (metadata) {
                                    Metadatas.push(metadata);
                                    Object.assign(tagRange.variables, metadata.variables);
                                }
                            }
                            const MetadataMerged = metamergeFormat(track.attr, doc.relpath, Metadatas);
                            attrs_Decos.push({ range: track.attrRange, hoverMessage: MetadataMerged.toolTip });
                            value_Decos.push({ range: track.valRange });
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                for (const track of tagRange.cache.valuefrags) {
                    try {
                        if (track.val.endsWith(":")) {
                            const tr_val = track.val.slice(0, -1);
                            const found = this.Server.W_CSSREFERENCE.CSS_Properties.find(prop => {
                                return prop.name ? (prop.name === tr_val) : false;
                            });
                            if (found) {
                                comProp_Decos.push({
                                    range: track.valRange,
                                    hoverMessage: found.description?.toString()
                                });
                            }
                        } else {
                            const tr_val = (track.val.startsWith("=") || track.val.startsWith("~")) ? track.val.slice(1) : track.val;
                            if (localsymclasses[tr_val]) {
                                symclass_Decos.push({ range: track.valRange, hoverMessage: local.getMarkdown(tr_val) });
                            }
                        }
                    } catch (error) {
                        console.error('Error processing Ranges:', error);
                    }
                }

                for (const track of tagRange.cache.hashrules) {
                    try {
                        if (track.valRange) {
                            if (localhashrules[track.val]) {
                                hashrule_Decos.push({
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
            if (this.value_Style) { editor.setDecorations(this.value_Style, value_Decos); }
            if (this.comProp_Style) { editor.setDecorations(this.comProp_Style, comProp_Decos); }
            if (this.compVal_Style) { editor.setDecorations(this.compVal_Style, compVal_Decos); }
            if (this.comment_Style) { editor.setDecorations(this.comment_Style, comment_Decos); }
            if (this.hashrule_Style) { editor.setDecorations(this.hashrule_Style, hashrule_Decos); }
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