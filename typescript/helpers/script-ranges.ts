import vscode from 'vscode';

import { t_TagCache, t_TagRange, t_TrackRange } from '../types';
import Reader from './file-reader';


const bracePair: Record<string, string> = {
    "{": "}",
    "[": "]",
    "(": ")",
    "'": "'",
    "`": "`",
    '"': '"',
};
const closeBraces = ["]", "}", ")"];
const openBraces = ["[", "{", "(", "'", '"', "`"];
const symclasDeclarationRegex = /^[\w-_]+\$+[\w-]+$/i;
const fragRegex = /[\\#\w\d$_/:=~!-]/i;

interface ScannerStash {
    cursorString: string;
    cursorAttribute: string;
    cursorValue: string;
    TagRanges: t_TagRange[]
    outsideTagfrags: t_TrackRange[];
}


function hashruleScanner(
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

function fargScanner(
    content: string,
    cursorStart: number,
    cursorEnd: number,
    rowMarker: number,
    colMarker: number,
    fragDump: t_TrackRange[],
): string[] {
    const kind: vscode.FoldingRangeKind = vscode.FoldingRangeKind.Comment;
    const fragments: string[] = [];

    let startPos = new vscode.Position(rowMarker, colMarker);
    let endPos = new vscode.Position(rowMarker, colMarker);
    let marker = cursorStart, snippet = '', ch = content[marker];
    let start: number = marker, end: number = marker;

    do {
        ch = content[marker];

        if (ch === "\n") {
            rowMarker++;
            colMarker = 0;
        } else {
            colMarker++;
        }

        if (fragRegex.test(ch)) {
            snippet += ch;
            endPos = new vscode.Position(rowMarker, colMarker);
        } else if (snippet.length > 0) {
            end = marker;
            fragments.push(snippet);
            const blockRange = new vscode.Range(startPos, endPos);
            const tr = {
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
            };
            fragDump.push(tr);
            snippet = "";
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
    fileCursor: Reader,
    watching: string[],
) {
    const stash: ScannerStash = {
        cursorString: '',
        cursorAttribute: '',
        cursorValue: '',
        TagRanges: [],
        outsideTagfrags: []
    };

    const tagCache: t_TagCache = {
        hashrules: [],
        commentsRanges: [],
        composerRanges: [],
        watchingRanges: [],
        defaultValFrags: [],
        watcherValFrags: [],
        composeValFrags: [],
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
                    tagCache.commentsRanges.push({ kind, attrRange, valRange, blockRange, valStart, valEnd, attrStart, attrEnd, attr, val, multiLine });
                } else if (attr.endsWith("&") || symclasDeclarationRegex.test(attr)) {
                    hashruleScanner(content, attrStart, attrEnd + 1, attrStartPos.line, attrStartPos.character, tagCache);
                    const fragments = fargScanner(content, valStart, fileCursor.active.marker, valStartPos.line, valStartPos.character, tagCache.composeValFrags);
                    tagCache.composerRanges.push({ kind, attrRange, valRange, blockRange, valStart, valEnd, attrStart, attrEnd, attr, val, multiLine, fragments, variableSet });
                } else if (watching.includes(attr)) {
                    const fragments = fargScanner(content, valStart, fileCursor.active.marker, valStartPos.line, valStartPos.character, tagCache.watcherValFrags);
                    tagCache.watchingRanges.push({ kind, attrRange, valRange, blockRange, valStart, valEnd, attrStart, attrEnd, attr, val, multiLine, fragments, variableSet });
                } else {
                    const fragments = fargScanner(content, valStart, fileCursor.active.marker, valStartPos.line, valStartPos.character, tagCache.defaultValFrags);
                    tagCache.watchingRanges.push({ kind, attrRange, valRange, blockRange, valStart, valEnd, attrStart, attrEnd, attr, val, multiLine, fragments, variableSet });
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

export default function ScanScriptRanges(content: string, watching: string[] = [], cursor = 0): ScannerStash {
    const stash: ScannerStash = {
        cursorString: '',
        cursorAttribute: '',
        cursorValue: '',
        TagRanges: [],
        outsideTagfrags: [],
    };
    let snippet = "", start = 0, end = 0;
    let startPos = new vscode.Position(0, 0), endPos = new vscode.Position(0, 0);
    try {
        const fileCursor = new Reader(content);

        do {
            const ch = fileCursor.active.char;
            let inc = true;


            if (ch && fragRegex.test(ch)) {
                snippet += ch;
                endPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
            } else if (snippet.length > 0) {
                end = fileCursor.active.marker;
                const blockRange = new vscode.Range(startPos, endPos);
                const tr = {
                    kind: vscode.FoldingRangeKind.Comment,
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
                };
                stash.outsideTagfrags.push(tr);
                snippet = "";
            }
            if (snippet.length === 0) {
                start = fileCursor.active.marker;
                startPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
            }

            if (
                (content[fileCursor.active.marker - 1] !== "\\")
                && (ch === "<")
                && (/[/\d\w-]/i.test(content[fileCursor.active.marker + 1]))
            ) {
                const tagStartMarker = fileCursor.active.marker;
                const tagStartPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
                const response = tagScanner(cursor, content, fileCursor, watching);
                if (response.ok) {
                    const tagEndMarker = fileCursor.active.marker;
                    const tagEndPos = new vscode.Position(fileCursor.active.rowMarker, fileCursor.active.colMarker);
                    cursorSave(stash, response.stash);
                    stash.TagRanges.push({
                        range: new vscode.Range(tagStartPos, tagEndPos),
                        variables: {},
                        metadatas: [],
                        cache: response.tagCache,
                        active: (tagStartMarker < cursor) && (cursor < tagEndMarker),
                    });
                } else {
                    inc = false;
                }
            }

            if (inc) { fileCursor.increment(); }
        } while (fileCursor.active.marker < content.length);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error scanning content:', errorMessage);
    }
    return stash;
}