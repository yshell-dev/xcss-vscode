import vscode from 'vscode';
import cursorSense from '../helpers/cursor-sense';
import styleScanner from '../helpers/style-scanner';

import { ExtensionManager } from "../activate";
import { metadataFormat } from '../helpers/metadata';
import { m_Metadata, t_CursorSnippet, t_SnippetType } from '../types';

export class INTELLISENSE {
    private Server: ExtensionManager;
    readonly triggers = ['@', ' ', '=', '#', '~', '&', '$', '\t', '\n', '/', '_', '(', ')', ':', '{', '}'];

    constructor(core: ExtensionManager) {
        this.Server = core;
    }

    dispose() {
        return;
    }

    testAtrule(string: string) {
        return /^_|\$_/.test(string);
    }

    createCompletionItem(
        label: string,
        insertText: string | vscode.SnippetString,
        kind: vscode.CompletionItemKind,
        documentation: string,
        detail?: string
    ): vscode.CompletionItem {
        const completion = new vscode.CompletionItem(label, kind);
        completion.sortText = label;
        completion.insertText = insertText;
        completion.documentation = new vscode.MarkdownString(documentation);
        if (detail) { completion.detail = detail; }
        return completion;
    }

    public SmartSymClassFilter(prefix: string, iconKind: vscode.CompletionItemKind, stashmap: Record<string, m_Metadata>) {

        const stashKeys = Object.keys(stashmap);
        const slash_end = prefix.lastIndexOf('/');
        const dollar_end = prefix.lastIndexOf('$');
        const sliceIndex = Math.max(slash_end, dollar_end);

        const collections = new Set<string>();
        const completions: vscode.CompletionItem[] = [];


        if (slash_end > -1) {
            if (slash_end === 0) {
                for (const key of stashKeys) {
                    if (key[0] === "/") {
                        collections.add(key.slice(1, key.lastIndexOf("/")));
                    }
                }
                for (const lib of collections) {
                    completions.push(this.createCompletionItem(
                        `[/${lib}/]`,
                        lib,
                        iconKind,
                        `External Artifact`,
                    ));
                }
            } else if (slash_end < dollar_end) {
                for (const key of stashKeys) {
                    const data = stashmap[key];
                    if (key.startsWith(prefix)) {
                        completions.push(this.createCompletionItem(
                            key.slice(sliceIndex + 1),
                            key.slice(sliceIndex + 1),
                            iconKind,
                            metadataFormat(key, data),
                        ));
                    };
                }
            } else if (slash_end > dollar_end) {
                for (const key of stashKeys) {
                    const data = stashmap[key];
                    if (key[0] === "/") {
                        const key_dollar_last = key.lastIndexOf("$");
                        const key_slash_last = key.lastIndexOf("/");
                        if (key_dollar_last > key_slash_last) {
                            collections.add(key.slice(key_slash_last + 1, key_dollar_last));
                        } else {
                            completions.push(this.createCompletionItem(
                                key.slice(key_slash_last + 1),
                                key.slice(key_slash_last + 1),
                                iconKind,
                                metadataFormat(key, data),
                            ));
                        }
                    };
                }

                for (const lib of collections) {
                    completions.push(this.createCompletionItem(
                        `[${lib}$]`,
                        lib,
                        iconKind,
                        `External Cluster`,
                    ));
                }
            }
        } else {
            if (dollar_end > -1) {
                for (const key of stashKeys) {
                    const data = stashmap[key];
                    if (!key.includes("/") && key.startsWith(prefix)) {
                        completions.push(this.createCompletionItem(
                            key.slice(dollar_end + 1),
                            key.slice(dollar_end + 1),
                            iconKind,
                            metadataFormat(key, data),
                        ));
                    };
                }
            } else {
                for (const key of stashKeys) {
                    const data = stashmap[key];
                    if (!key.includes("/")) {
                        if (key.includes("$")) {
                            collections.add(key.slice(0, key.lastIndexOf("$")));
                        } else {
                            completions.push(this.createCompletionItem(
                                key,
                                key,
                                iconKind,
                                metadataFormat(key, data),
                            ));
                        }
                    };
                }

                for (const lib of collections) {
                    completions.push(this.createCompletionItem(
                        `[${lib}$]`,
                        lib,
                        iconKind,
                        `Native Cluster`,
                    ));
                }
            }
        }

        return completions;
    }

    SimpleSymClassFilter(prefix: string, iconKind: vscode.CompletionItemKind, stashmap: Record<string, m_Metadata>): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        for (const key of Object.keys(stashmap)) {
            if (key.startsWith(prefix)) {
                completions.push(this.createCompletionItem(
                    key,
                    key,
                    iconKind,
                    `External Cluster`,
                ));
            }
        }

        return completions;
    }

    public AttachableFilter(prefix: string, iconKind: vscode.CompletionItemKind): vscode.CompletionItem[] {
        if (this.Server.config.get<boolean>("intellisense.mode")) {
            return this.SmartSymClassFilter(prefix, iconKind, this.Server.getAttachables());
        }
        return this.SimpleSymClassFilter(prefix, iconKind, this.Server.getAttachables());
    }

    public AssignableFilter(prefix: string, iconKind: vscode.CompletionItemKind): vscode.CompletionItem[] {
        if (this.Server.config.get<boolean>("intellisense.mode")) {
            return this.SmartSymClassFilter(prefix, iconKind, this.Server.getAssignables());
        }
        return this.SimpleSymClassFilter(prefix, iconKind, this.Server.getAssignables());
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionItem[] | undefined {
        try {
            const completions: vscode.CompletionItem[] = [];
            const fileFragment = document.getText(new vscode.Range(new vscode.Position(0, 0), position));

            if (this.Server.Editor) {
                if (this.Server.isFileTargetedFile()) {
                    const parsed = cursorSense(fileFragment, this.Server.Editor.document.offsetAt(this.Server.Editor.selection.active));
                    const valueFragment = parsed.cursorString.slice(parsed.cursorAttribute.length + 2);
                    const foundTag = this.Server.getTagRanges().find(tag => tag.range.contains(position));
                    const foundVars = foundTag ? foundTag.variables : {};

                    if (parsed.cursorValue.length) {
                        completions.push(...this.handleValueMatch(parsed.cursorAttribute, valueFragment, foundVars));
                    } else if (parsed.cursorString.length) {
                        completions.push(...this.handleAttributeMatch(parsed.cursorString));
                    }
                } else if (this.Server.isCssTargetedFile()) {
                    completions.push(...this.provideCssCompletions(styleScanner(fileFragment)));
                }
            }

            return completions.length > 0 ? completions : undefined;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error providing completions:', errorMessage);
            return undefined;
        }
    }

    provideCssCompletions(cursorSnippet: t_CursorSnippet): vscode.CompletionItem[] {
        try {
            const isAtStyle = this.testAtrule(cursorSnippet.fragment || '');
            const iconKind = isAtStyle ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Field;
            const completions: vscode.CompletionItem[] = [];

            switch (cursorSnippet.type) {
                case t_SnippetType.attach: {
                    const items = cursorSnippet.fragment === undefined ? [] : this.AttachableFilter(cursorSnippet.fragment, iconKind);
                    completions.push(...items);
                    break;
                }
                case t_SnippetType.assign: {
                    const items = cursorSnippet.fragment === undefined ? [] : this.AssignableFilter(cursorSnippet.fragment, iconKind);
                    completions.push(...items);
                    break;
                }
                case t_SnippetType.constant:
                case t_SnippetType.variable:
                case t_SnippetType.varfetch: {
                    const items = Object.keys(this.Server.VarFilter(cursorSnippet.fragment ?? "")) || [];
                    for (const item of items) {
                        completions.push(this.createCompletionItem(
                            item,
                            item,
                            vscode.CompletionItemKind.Color,
                            `Constant: ${item}`));
                    }
                    break;
                }
                case t_SnippetType.rule: {
                    for (const item of ["--attach", "--assign"]) {
                        completions.push(this.createCompletionItem(
                            item,
                            item,
                            vscode.CompletionItemKind.Property,
                            `Custom AtRule: ${item}`));
                    }
                    break;
                }
            }

            return completions.length > 0 ? completions : [];
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            console.error('Error providing CSS completions:', errorMessage);
            return [];
        }
    }

    handleAttributeMatch(attributeFragment: string): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        if (attributeFragment.endsWith("&")) {
            const hashrules = this.Server.GetHashrules();
            for (const key of Object.keys(hashrules)) {
                const value = hashrules[key];
                completions.push(this.createCompletionItem(
                    key,
                    `#{${key}}&`,
                    vscode.CompletionItemKind.Function,
                    `#${key}\n \`${value}\``,
                    `: ${value}`
                ));
            }
        } else if (attributeFragment.endsWith("#")) {
            const hashrules = this.Server.GetHashrules();
            for (const key of Object.keys(hashrules)) {
                const value = hashrules[key];
                completions.push(this.createCompletionItem(
                    key,
                    `{${key}}&`,
                    vscode.CompletionItemKind.Function,
                    `#${key}\n \`${value}\``,
                    `: ${value}`
                ));
            }
        } else if (attributeFragment.endsWith("#{")) {
            const hashrules = this.Server.GetHashrules();
            for (const key of Object.keys(hashrules)) {
                const value = hashrules[key];
                completions.push(this.createCompletionItem(
                    key,
                    `${key}`,
                    vscode.CompletionItemKind.Function,
                    `#${key}\n \`${value}\``,
                    `: ${value}`
                ));
            }
        }

        return completions;
    }

    handleValueMatch(attributeMatch: string, valueMatch: string, tagScopeVars: Record<string, string>): vscode.CompletionItem[] {
        const completions: vscode.CompletionItem[] = [];

        if (this.Server.GetTargetAttributes().includes(attributeMatch)) {
            const valuePrefix = valueMatch.match(/[=~][\w/$_-]*$/i)?.[0] || '';
            const isAtStyle = this.testAtrule(valuePrefix || '');
            if (valueMatch[0] === "=" || valueMatch[0] === "~") {
                const iconKind = isAtStyle ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Field;
                completions.push(...this.AttachableFilter(valuePrefix.slice(1), iconKind));
            }
        } else if (
            (attributeMatch.endsWith("&") || /^[\w-]+\$+[\w-]+$/i.test(attributeMatch)) &&
            (!valueMatch.endsWith("~") && !valueMatch.endsWith("="))
        ) {
            const result = styleScanner(valueMatch);
            const isAtStyle = this.testAtrule(result.fragment);
            const iconKind = isAtStyle ? vscode.CompletionItemKind.Variable : vscode.CompletionItemKind.Field;
            const property = this.Server.W_CSSREFERENCE.CSS_Properties.find(item => item.name === result.property);

            switch (result.type) {
                case t_SnippetType.rule:
                    for (const item of ["--attach", "--assign"]) {
                        completions.push(this.createCompletionItem(
                            item,
                            item,
                            vscode.CompletionItemKind.Function,
                            `custom AtRule: ${item}`,
                            "...symclasses"
                        ));
                    }

                    for (const rule of this.Server.W_CSSREFERENCE.CSS_AtDirectives) {
                        if (result.fragment.startsWith("@-") === rule.name.startsWith("@-")) {
                            completions.push(this.createCompletionItem(
                                rule.name.slice(1),
                                rule.name.slice(1),
                                vscode.CompletionItemKind.Function,
                                `CSS standared AtRule: ${rule.name}\n---\n${rule.description}`
                            ));
                        }
                    }
                    break;

                case t_SnippetType.pseudo:
                    if (valueMatch.endsWith("::")) {
                        for (const pseudo of this.Server.W_CSSREFERENCE.CSS_PseudoElements) {
                            if (result.fragment.startsWith("::-") === pseudo.name.startsWith("::-")) {
                                completions.push(this.createCompletionItem(
                                    `${pseudo.name} (snippet)`,
                                    pseudo.name.slice(2),
                                    vscode.CompletionItemKind.Property,
                                    `CSS Property Snippet: ${pseudo.name}`
                                ));
                            }
                        }
                    } else {
                        for (const pseudo of this.Server.W_CSSREFERENCE.CSS_PseudoClasses) {
                            if (result.fragment.startsWith(":-") === pseudo.name.startsWith(":-")) {
                                completions.push(this.createCompletionItem(
                                    `${pseudo.name} (snippet)`,
                                    pseudo.name.slice(1),
                                    vscode.CompletionItemKind.Property,
                                    `CSS Property Snippet: ${pseudo.name}`
                                ));
                            }
                        }
                    }
                    break;

                case t_SnippetType.property:
                    {
                        const temp = { ...tagScopeVars, ...this.Server.getAttachables()[attributeMatch]?.variables || {} };
                        for (const key of Object.keys(temp)) {
                            const value = temp[key];
                            completions.push(this.createCompletionItem(
                                key,
                                key,
                                vscode.CompletionItemKind.Color,
                                `\`${key}: ${value}\``
                            ));
                        }
                    }

                    for (const prop of this.Server.W_CSSREFERENCE.CSS_Properties) {
                        if (result.fragment.startsWith("-") === prop.name.startsWith("-")) {
                            completions.push(this.createCompletionItem(
                                `${prop.name} (snippet)`,
                                prop.name,
                                vscode.CompletionItemKind.Property,
                                `CSS Property Snippet: ${prop.name}`
                            ));
                        }
                    }

                    for (const prop of this.Server.W_CSSREFERENCE.CSS_Properties) {
                        if (result.fragment.startsWith("-") === prop.name.startsWith("-")) {
                            if (prop.restrictions?.includes('hashrule')) {
                                completions.push(this.createCompletionItem(
                                    `${prop.name} (fragment)`,
                                    new vscode.SnippetString(`${prop.name}: $1 $2 $3 $4;`),
                                    vscode.CompletionItemKind.Snippet,
                                    `CSS hashrule Property Fragment: ${prop.name}`
                                ));
                            } else if (prop.values?.length) {
                                for (const value of prop.values) {
                                    completions.push(this.createCompletionItem(
                                        `${prop.name}: ${value.name}`,
                                        new vscode.SnippetString(`${prop.name}: ${value.name};`),
                                        vscode.CompletionItemKind.Value,
                                        `CSS Property: ${prop.name}, Value: ${value.name}`
                                    ));
                                }
                            }
                        }
                    }
                    break;

                case t_SnippetType.value:
                    if (property?.name === result.property && property.values?.length) {
                        for (const value of property.values) {
                            if (value.name.startsWith(result.fragment)) {
                                completions.push(this.createCompletionItem(
                                    value.name,
                                    value.name,
                                    vscode.CompletionItemKind.Value,
                                    `CSS Property: ${property.name}, Value: ${value.name}`
                                ));
                            }
                        }
                    }
                    break;

                case t_SnippetType.varfetch:
                case t_SnippetType.variable:
                    {
                        const temp = { ...tagScopeVars, ...this.Server.GetTargetAttributes()[attributeMatch]?.variables || {} };

                        for (const key of Object.keys(temp)) {
                            const value = temp[key];
                            completions.push(this.createCompletionItem(
                                key,
                                key,
                                vscode.CompletionItemKind.Color,
                                `\`${key}: ${value}\``
                            ));
                        }
                    }
                    break;

                case t_SnippetType.constant:
                    for (const item of Object.keys(this.Server.VarFilter(result.fragment))) {
                        completions.push(this.createCompletionItem(
                            item,
                            item,
                            vscode.CompletionItemKind.Color,
                            `Variable: ${item}`
                        ));
                    }
                    break;

                case t_SnippetType.attach:
                    completions.push(...this.AttachableFilter(result.fragment, iconKind));
                    break;

                case t_SnippetType.assign:
                    completions.push(...this.AssignableFilter(result.fragment, iconKind));
                    break;
            }
        }
        return completions;
    }
}