import vscode from 'vscode';
import { metadataFormat, metamergeFormat } from '../helpers/metadata';
import { m_Metadata, } from '../types';
import { SERVER } from '../server';
import fileScanner from '../helpers/file-scanner';

export class DECORATIONS {
    private Server: SERVER;

    attrs_Style: vscode.TextEditorDecorationType | undefined;
    value_Style: vscode.TextEditorDecorationType | undefined;
    hashrule_Style: vscode.TextEditorDecorationType | undefined;
    symclass_Style: vscode.TextEditorDecorationType | undefined;
    comProp_Style: vscode.TextEditorDecorationType | undefined;
    compVal_Style: vscode.TextEditorDecorationType | undefined;
    comment_Style: vscode.TextEditorDecorationType | undefined;


    constructor(core: SERVER) {
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
        const hashrules = this.Server.getHashrules();
        const symclasses = this.Server.getAttachables();
        let editors = vscode.window.visibleTextEditors;
        if (vscode.window.activeTextEditor) {
            editors = [vscode.window.activeTextEditor];
        }

        for (const editor of editors) {
            let localhashrules: typeof hashrules = {};
            let localsymclasses: typeof symclasses = {};
            if (this.Server.CheckEditorPathWatching(editor)) {
                localhashrules = hashrules;
                localsymclasses = symclasses;
            }

            const comment_Decos: vscode.DecorationOptions[] = [];
            const hashrule_Decos: vscode.DecorationOptions[] = [];
            const value_Decos: vscode.DecorationOptions[] = [];
            const attrs_Decos: vscode.DecorationOptions[] = [];
            const compVal_Decos: vscode.DecorationOptions[] = [];
            const symclass_Decos: vscode.DecorationOptions[] = [];
            const comProp_Decos: vscode.DecorationOptions[] = [];

            const content = editor.document.getText();
            const cursorOffset = editor.document.offsetAt(editor.selection.active);
            const parsed = fileScanner(content, this.Server.FileManifest.attributes, cursorOffset);

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
                            const metadata = localsymclasses[f];
                            if (metadata) {
                                Object.assign(tagRange.variables, metadata.variables);
                            }
                            const tooltip = metadata ? metadata.markdown || metadataFormat(`${track.attr} -> ${f} `, metadata) : `${this.Server.Ed_IdCap} Definition.`;
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
                                const fragx = frag.slice(1);
                                if (localsymclasses[fragx]) {
                                    Metadatas.push(localsymclasses[fragx]);
                                    Object.assign(tagRange.variables, localsymclasses[fragx].variables);
                                }
                            }
                            const MetadataMerged = metamergeFormat(track.attr, this.Server.filePath, Metadatas);
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
                            const found = this.Server.CSS_Properties.find(prop => prop.name ? (prop.name === tr_val) : false);
                            if (found) {
                                comProp_Decos.push({
                                    range: track.valRange,
                                    hoverMessage: found.description?.toString()
                                });
                            }
                        } else {
                            const tr_val = (track.val.startsWith("=") || track.val.startsWith("~")) ? track.val.slice(1) : track.val;
                            if (localsymclasses[tr_val]) {
                                const metadata = localsymclasses[tr_val];

                                symclass_Decos.push({
                                    range: track.valRange,
                                    hoverMessage: metadata.markdown || metadataFormat(tr_val, metadata)
                                });
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
    };
}