import vscode from 'vscode';

import { t_TagCache, t_TagRange } from '../types';
import Cursor from './file-cursor';


const bracePair: Record<string, string> = {
    "{": "}",
    "[": "]",
    "(": ")",
    "'": "'",
    "`": "`",
    '"': '"',
};
const openBraces = ["[", "{", "(", "'", '"', "`"];
const closeBraces = ["]", "}", ")"];

interface ScannerStash {
    cursorString: string;
    cursorAttribute: string;
    cursorValue: string;
    TagRanges: t_TagRange[]
}


function hashScanner(
    content: string,
    cursorStart: number,
    cursorEnd: number,
    rowMarker: number,
    colMarker: number,
    tagCache: t_TagCache,
) {
    const kind: vscode.FoldingRangeKind = vscode.FoldingRangeKind.Comment;

    let startPos = new vscode.Position(rowMarker, colMarker);
    let endPos = new vscode.Position(rowMarker, colMarker);
    let marker = cursorStart, snippet = '';
    let start = marker, end = marker, read = false;

    do {
        const ch = content[marker];
        if (ch === "\n") { rowMarker++; colMarker = 0; }
        else { colMarker++; }

        if (read && /[\w\d-]/i.test(ch)) {
            snippet += ch;
        }
        if (read === true && ch === "}") {
            if (snippet.length > 0) {
                end = marker;
                endPos = new vscode.Position(rowMarker, colMarker);
                const blockRange = new vscode.Range(startPos, endPos);
                tagCache.hashrules.push({
                    kind,
                    blockRange,
                    valRange: blockRange,
                    attrRange: blockRange,
                    valStart: start,
                    valEnd: end,
                    attrStart: start,
                    attrEnd: end,
                    attr: snippet,
                    val: snippet,
                    multiLine: false
                });
            }
            read = false;
            snippet = "";
        }

        if (ch === "#" && content[marker + 1] === "{") {
            read = true;
            start = marker;
            startPos = new vscode.Position(rowMarker, colMarker - 1);
        }
    } while (++marker <= cursorEnd);
}

function valScanner(
    content: string,
    cursorStart: number,
    cursorEnd: number,
    rowMarker: number,
    colMarker: number,
    tagCache: t_TagCache,
): string[] {
    const kind: vscode.FoldingRangeKind = vscode.FoldingRangeKind.Comment;
    const fragments: string[] = [];

    let startPos = new vscode.Position(rowMarker, colMarker);
    let endPos = new vscode.Position(rowMarker, colMarker);
    let marker = cursorStart, snippet = '', ch = content[marker];
    let start: number = marker, end: number = marker, halt = false;


    do {
        ch = content[marker];

        if (ch === "\n") {
            rowMarker++;
            colMarker = 0;
        } else {
            colMarker++;
        }

        if (!halt) {
            if (/[\\\w\d$_/:=-]/i.test(ch)) {
                snippet += ch;
                endPos = new vscode.Position(rowMarker, colMarker);
            } else if (snippet.length > 0) {
                end = marker;
                fragments.push(snippet);
                const blockRange = new vscode.Range(startPos, endPos);
                tagCache.valuefrags.push({
                    kind,
                    blockRange,
                    valRange: blockRange,
                    attrRange: blockRange,
                    valStart: start,
                    valEnd: end,
                    attrStart: start,
                    attrEnd: end,
                    attr: snippet,
                    val: snippet,
                    multiLine: false
                });
                snippet = "";
            }
        }

        switch (ch) {
            case "&":
            case "@":
            case ":": halt = true; break;
            case "{":
            case "}":
            case ";": halt = false; break;
        }

        if (snippet.length === 0) {
            start = marker;
            startPos = new vscode.Position(rowMarker, colMarker);
        }
    } while (++marker <= cursorEnd);

    return fragments;
}

function tagScanner(
    cursor: number,
    content: string,
    fileCursor: Cursor,
    classProps: string[],
) {

    const stash: ScannerStash = {
        cursorString: '',
        cursorAttribute: '',
        cursorValue: '',
        TagRanges: []
    };

    const tagCache: t_TagCache = {
        hashrules: [],
        watchtracks: [],
        comments: [],
        composes: [],
        valuefrags: [],
    };

    const variableSet = new Set<string>();

    let val = "",
        attr = "",
        awaitBrace = "",
        deviance = 0,
        isVal = false,
        ok = false,
        multiLine = false,
        waitElement = true,
        fallbackAquired = false;

    let
        valStart: number = fileCursor.active.marker,
        valEnd: number = fileCursor.active.marker,
        attrStart: number = fileCursor.active.marker,
        attrEnd: number = fileCursor.active.marker,
        valStartPos: vscode.Position = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker),
        valEndPos: vscode.Position = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker),
        attrStartPos: vscode.Position = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker),
        attrEndPos: vscode.Position = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);

    const kind: vscode.FoldingRangeKind = vscode.FoldingRangeKind.Region;

    const braceTrack: string[] = [];

    while (fileCursor.active.marker < fileCursor.content.length) {
        const ch = fileCursor.increment();

        if (!fallbackAquired && (fileCursor.active.next === "<")) {
            fallbackAquired = true;
            fileCursor.savefallback();
        }

        if (awaitBrace === ch) {
            braceTrack.pop();
            deviance = braceTrack.length;
            awaitBrace = bracePair[braceTrack[deviance - 1] as keyof typeof bracePair];
        } else if (openBraces.includes(ch) && !["'", '"', "`"].includes(awaitBrace)) {
            braceTrack.push(ch);
            deviance = braceTrack.length;
            awaitBrace = bracePair[ch as keyof typeof bracePair];
        } else if (deviance === 0 && closeBraces.includes(ch)) { break; }


        if (attr.length === 0) { attrStart = fileCursor.active.marker; }
        if (val.length === 0) { valStart = fileCursor.active.marker; }

        if (fileCursor.active.marker === cursor) {
            stash.cursorString = content.slice(attrStart, cursor);
            stash.cursorAttribute = attr;
            stash.cursorValue = val;
        }

        if (deviance === 0 && [" ", "\n", "\r", ">", "\t"].includes(ch)) {
            const attrRange = new vscode.Range(attrStartPos, attrEndPos);
            if (waitElement) {
                waitElement = false;
            } else if (attr.length) {
                const valRange = new vscode.Range(valStartPos, valEndPos);
                const blockRange = new vscode.Range(attrStartPos, valEndPos);

                if (attr === "&") {
                    tagCache.comments.push({
                        kind,
                        attrRange,
                        valRange,
                        blockRange,
                        valStart,
                        valEnd,
                        attrStart,
                        attrEnd,
                        attr,
                        val,
                        multiLine
                    });
                }
                else if (attr.endsWith("&") || /^[\w-]+\$+[\w-]+$/i.test(attr)) {
                    hashScanner(content, attrStart, attrEnd + 1, attrStartPos.line, attrStartPos.character, tagCache);
                    const fragments = valScanner(content, valStart, fileCursor.active.marker, valStartPos.line, valStartPos.character, tagCache);
                    tagCache.composes.push({
                        kind,
                        attrRange,
                        valRange,
                        blockRange,
                        valStart,
                        valEnd,
                        attrStart,
                        attrEnd,
                        attr,
                        val,
                        multiLine,
                        fragments,
                        variableSet
                    });

                }
                else if (classProps.includes(attr)) {
                    const fragments = valScanner(content, valStart, fileCursor.active.marker, valStartPos.line, valStartPos.character, tagCache);
                    tagCache.watchtracks.push({
                        kind,
                        attrRange,
                        valRange,
                        blockRange,
                        valStart,
                        valEnd,
                        attrStart,
                        attrEnd,
                        attr,
                        val,
                        multiLine,
                        fragments,
                        variableSet
                    });
                }
            }

            val = "";
            attr = "";
            isVal = false;
            multiLine = false;
            attrEnd = fileCursor.active.marker;
            valEnd = fileCursor.active.marker;
            attrEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
            valEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
        }


        if (deviance === 0 && ![" ", "=", "\n", "\r", "\t", ">"].includes(ch) || deviance !== 0) {
            if (isVal) {
                val += ch;
                valEnd = fileCursor.active.marker;
                valEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
            }
            else {
                attr += ch;
                attrEnd = fileCursor.active.marker;
                attrEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
            }
        } else if (deviance === 0 && ch === "=") { isVal = true; }

        if (attr.length === 0) { attrStartPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker); }
        if (val.length === 0) { valStartPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker); }
        else if (ch === "\n") { multiLine = true; }

        if (deviance === 0 && (ch === ">" || ch === ";" || ch === ',' || ch === "<")) {
            ok = ch === ">";
            break;
        }
    }

    if (!ok && fallbackAquired) {
        fileCursor.loadfallback();
    }

    return { ok, stash, tagCache, variableSet };
}


function cursorSave(mainStash: ScannerStash, subStash: ScannerStash) {
    (Object.keys(mainStash) as (keyof ScannerStash)[]).forEach((key) => {
        const mainValue = mainStash[key];
        const subValue = subStash[key];

        if (
            key === 'cursorString' ||
            key === 'cursorAttribute' ||
            key === 'cursorValue'
        ) {
            if (
                typeof subValue === 'string' &&
                typeof mainValue === 'string' &&
                mainValue.length === 0 &&
                subValue.length !== 0
            ) {
                mainStash[key] = subValue as ScannerStash[typeof key];
            }
        }
    });
}

export default function scanner(content: string, classProps: string[] = [], cursor = 0): ScannerStash {
    const stash: ScannerStash = {
        cursorString: '',
        cursorAttribute: '',
        cursorValue: '',
        TagRanges: []
    };
    try {
        const fileCursor = new Cursor(content);

        do {
            const char = fileCursor.active.char;

            if (
                (content[fileCursor.active.marker - 1] !== "\\")
                && (char === "<")
                && (/[!/\d\w-]/i.test(content[fileCursor.active.marker + 1]))
            ) {
                const tagStartPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
                const response = tagScanner(cursor, content, fileCursor, classProps);
                if (response.ok) {
                    const tagEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
                    cursorSave(stash, response.stash);
                    stash.TagRanges.push({
                        range: new vscode.Range(tagStartPos, tagEndPos),
                        variables: {},
                        cache: response.tagCache
                    });
                    fileCursor.increment();
                }
            } else {
                fileCursor.increment();
            }
        } while (fileCursor.active.marker < content.length);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error scanning content:', errorMessage);
    }
    return stash;
}