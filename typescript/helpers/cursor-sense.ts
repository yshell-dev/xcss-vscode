import { t_FileCursor } from '../types';
import Reader from './file-reader';


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
    intag: boolean;
}

function tagScanner(
    cursor: number,
    content: string,
    fileCursor: Reader,
    stash: ScannerStash,
) {
    let val = "",
        attr = "",
        awaitBrace = "",
        deviance = 0,
        isVal = false,
        ok = false,
        fallbackAquired = false,
        start = fileCursor.active.marker;

    const braceTrack: string[] = [];

    const fallbackCursor: t_FileCursor = {
        marker: 0,
        rowMarker: 0,
        colMarker: 0,
    };

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

        if (attr.length === 0) { start = fileCursor.active.marker; }

        if (fileCursor.active.marker === cursor) {
            stash.cursorString = content.slice(start, cursor);
            stash.cursorAttribute = attr;
            stash.cursorValue = val;
        }

        if (deviance === 0 && [" ", "\n", "\r", ">", "\t"].includes(ch)) { val = ""; attr = ""; isVal = false; }
        if (deviance === 0 && ![" ", "=", "\n", "\r", "\t", ">"].includes(ch) || deviance !== 0) {
            if (isVal) { val += ch; }
            else { attr += ch; }
        } else if (deviance === 0 && ch === "=") { isVal = true; }

        if (deviance === 0 && (ch === ">" || ch === ";" || ch === ',' || ch === "<")) {
            ok = ch === ">";
            break;
        }
    }

    if (!ok && fallbackAquired) {
        Object.assign(fileCursor, fallbackCursor);
    }
    return ok;
}

export default function scanner(content: string, cursor = 0): ScannerStash {
    const stash: ScannerStash = {
        cursorString: '',
        cursorAttribute: '',
        cursorValue: '',
        intag: false
    };
    try {
        const fileCursor = new Reader(content);

        do {
            stash.intag = false;
            const char = fileCursor.active.char;
            
            if (
                (content[fileCursor.active.marker - 1] !== "\\")
                && (char === "<")
                && (/[/\d\w-]/i.test(content[fileCursor.active.marker + 1]))
            ) {
                stash.intag = true;
                const ok = tagScanner(cursor, content, fileCursor, stash);
                if (ok) { fileCursor.increment(); }
            } else {
                fileCursor.increment();
            }
        } while (fileCursor.active.marker < content.length);

        return stash;

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error scanning content:', errorMessage);
        return stash;
    }
}