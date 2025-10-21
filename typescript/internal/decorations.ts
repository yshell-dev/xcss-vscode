import vscode from 'vscode';
import { metadataFormat, metamergeFormat } from '../helpers/metadata';
import { m_Metadata, } from '../types';
import { SERVER } from '../server';


export class DECORATIONS {
    private Core: SERVER;

    attrs_Style: vscode.TextEditorDecorationType | undefined;
    value_Style: vscode.TextEditorDecorationType | undefined;
    hashrule_Style: vscode.TextEditorDecorationType | undefined;
    symclass_Style: vscode.TextEditorDecorationType | undefined;
    comProp_Style: vscode.TextEditorDecorationType | undefined;
    compVal_Style: vscode.TextEditorDecorationType | undefined;
    comment_Style: vscode.TextEditorDecorationType | undefined;


    constructor(core: SERVER) {
        this.Core = core;
        this.updateStyles();
    };

    updateStyles() {
        const c_attribute = this.Core.config.get<string>('color.attribute');
        const c_property = this.Core.config.get<string>('color.property');
        const c_comment = this.Core.config.get<string>('color.comment');
        const c_value = this.Core.config.get<string>('color.value');

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
            before: {
                contentText: '{',
                color: 'gray',
            },
            after: {
                contentText: '}',
                color: 'gray',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
        this.comment_Style = vscode.window.createTextEditorDecorationType({
            color: c_comment,
            before: {
                contentText: '/*',
                color: 'gray',
            },
            after: {
                contentText: '*/',
                color: 'gray',
            },
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
        });
    }

    clear() {
        const editor = this.Core.Ed_Editor;
        if (editor) {
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

        if (!this.Core.Ed_Editor) {
            if (!this.Core.isFileTargetedFile()) {
                this.clear();
            }
            return;
        }

        const attachables = this.Core.getAttachables();

        const comment_Decos: vscode.DecorationOptions[] = [];
        const hashrule_Decos: vscode.DecorationOptions[] = [];
        const value_Decos: vscode.DecorationOptions[] = [];
        const attrs_Decos: vscode.DecorationOptions[] = [];
        const compVal_Decos: vscode.DecorationOptions[] = [];
        const symclass_Decos: vscode.DecorationOptions[] = [];
        const comProp_Decos: vscode.DecorationOptions[] = [];

        for (const tagRange of this.Core.getTagRanges()) {

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
                        const metadata = attachables[track.attr];
                        if (metadata) {
                            Object.assign(tagRange.variables, metadata.variables);
                        }
                        const tooltip = metadata ? metadata.markdown || metadataFormat(track.attr, metadata) : `${this.Core.Ed_IdCap} Definition.`;
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
                        const Metadatas = (track.fragments ?? []).reduce<m_Metadata[]>((acc, frag) => {
                            const fragx = frag.slice(1);
                            if (attachables[fragx]) {
                                acc.push(attachables[fragx]);
                                Object.assign(tagRange.variables, attachables[fragx].variables);
                            }
                            return acc;
                        }, []);
                        const MetadataMerged = metamergeFormat(track.attr, this.Core.filePath, Metadatas);
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
                        const found = this.Core.CSS_Properties.find(prop => prop.name ? (prop.name === tr_val) : false);
                        if (found) {
                            comProp_Decos.push({
                                range: track.valRange,
                                hoverMessage: found.description?.toString()
                            });
                        }
                    } else {
                        const tr_val = (track.val.startsWith("=") || track.val.startsWith("~")) ? track.val.slice(1) : track.val;
                        if (attachables[tr_val]) {
                            const metadata = attachables[tr_val];

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
                        if (this.Core.FileManifest.hashrules[track.val]) {
                            hashrule_Decos.push({
                                range: track.valRange,
                                hoverMessage: `Hashrule: \`${this.Core.FileManifest.hashrules[track.val]}\``
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error processing Ranges:', error);
                }
            }
        }


        // Apply decorations
        if (this.attrs_Style) { this.Core.Ed_Editor.setDecorations(this.attrs_Style, attrs_Decos); }
        if (this.value_Style) { this.Core.Ed_Editor.setDecorations(this.value_Style, value_Decos); }
        if (this.comProp_Style) { this.Core.Ed_Editor.setDecorations(this.comProp_Style, comProp_Decos); }
        if (this.compVal_Style) { this.Core.Ed_Editor.setDecorations(this.compVal_Style, compVal_Decos); }
        if (this.comment_Style) { this.Core.Ed_Editor.setDecorations(this.comment_Style, comment_Decos); }
        if (this.hashrule_Style) { this.Core.Ed_Editor.setDecorations(this.hashrule_Style, hashrule_Decos); }
        if (this.symclass_Style) { this.Core.Ed_Editor.setDecorations(this.symclass_Style, symclass_Decos); }
    };
}