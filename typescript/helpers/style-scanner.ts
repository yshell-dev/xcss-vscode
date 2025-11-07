import { t_CursorSnippet, t_SnippetType } from "../types";

export default function analyzer(content: string): t_CursorSnippet {
    let marker = 0,
        ch = content[marker],
        property = "",
        fragment = "",
        line = "",
        type: t_SnippetType = t_SnippetType.null,
        xtype: t_SnippetType = t_SnippetType.property;

    while (ch !== undefined) {
        line = ch === "\n" ? "" : line + ch;
        if (ch === '"' || ch === "'" || ch === "`") {
            const quote = ch;
            ch = content[++marker];
            while (marker < content.length && (ch !== quote || content[marker - 1] === "\\")) {
                ch = content[++marker];
            }
            fragment = "";
            property = "";
            type = t_SnippetType.null;
            xtype = t_SnippetType.property;
        } else {
            if (ch === "&") {
                xtype = t_SnippetType.selector;
                type = t_SnippetType.selector;
            } else if (ch === ":") {
                property = fragment.trim();
                fragment = "";
                if (line.trim().startsWith("&")) {
                    type = t_SnippetType.pseudo;
                    xtype = t_SnippetType.pseudo;
                } else {
                    type = t_SnippetType.value;
                    xtype = t_SnippetType.value;
                }
            } else if (ch === ";" || ch === "{" || ch === "}") {
                property = "";
                fragment = "";
                xtype = t_SnippetType.property;
            } else if (["~", "=", "@"].includes(ch)) {
                fragment = ch;
                if (xtype !== t_SnippetType.rule) {
                    switch (ch) {
                        case "@": type = t_SnippetType.rule; break;
                        case "=": type = t_SnippetType.assign; break;
                        case "~": type = t_SnippetType.attach; break;
                    }
                }
            } else if (/[(\w/$_-]/i.test(ch)) {
                fragment += ch;
            } else {
                if (xtype === t_SnippetType.property) {
                    switch (fragment) {
                        case "=":
                            xtype = t_SnippetType.assign;
                            break;
                        case "@--assign":
                            xtype = type;
                            type = t_SnippetType.assign;
                            break;
                        case "~":
                            xtype = t_SnippetType.attach;
                            break;
                        case "@--attach":
                            xtype = type;
                            type = t_SnippetType.attach;
                            break;
                    }
                }
                if (xtype !== t_SnippetType.rule) { type = xtype; }
                fragment = "";
            }
        };

        ch = content[++marker];
    }

    if (type === t_SnippetType.property) {
        if (fragment.startsWith("---")) {
            type = t_SnippetType.constant;
        } else if (fragment.startsWith("--")) {
            type = t_SnippetType.variable;
        }
    } else if (type === t_SnippetType.value) {
        if (fragment.endsWith('var(')) {
            type = t_SnippetType.varcalls;
        } else if (fragment.endsWith("---")) {
            type = t_SnippetType.constant;
        } else if (fragment.endsWith("--")) {
            type = t_SnippetType.variable;
        }
        fragment = fragment.slice(fragment.indexOf("(") + 1);
    }

    return { property, type, fragment };
}

// console.log(analyzer(`"
//     --var:var;
//     flex`));

// console.log(analyzer(`
//     --var:var;
//     border: d`));

// console.log(analyzer(`"
//     --var:var;
//     &:hover`));
// console.log(analyzer(`"
//     --var:var;
//     &:`));

// console.log(analyzer(`"
//     --var:var;
//     & h2`));

// console.log(analyzer(`
//     --var:var;
//     @med`));

// console.log(analyzer(`
//     --var:var;
//     @pre-bind ;
//     = border-ra`
// ));

// console.log(analyzer(`
//     --var:var;
//     @--assign border-ra`
// ));

// console.log(analyzer(`
//     --var:var;
//     ~ border-ra`
// ));

// console.log(analyzer(`
//     --var:var;
//     @--attach border-ra`
// ));

// console.log(analyzer(`
//     --var:var(--`
// ));
// console.log(analyzer(`
//     --var:var(---`
// ));
// console.log(analyzer(`
//     = df;
//     --v`
// ));