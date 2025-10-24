import vscode from 'vscode';
import { t_FileCursor } from '../types';


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
const hexints: Record<string, number> = {
    0: 0,
    1: 1,
    2: 2,
    3: 3,
    4: 4,
    5: 5,
    6: 6,
    7: 7,
    8: 8,
    9: 9,
    a: 10,
    b: 11,
    c: 12,
    d: 13,
    e: 14,
    f: 15,
};

function hexScanner(
    content: string,
    fileCursor: t_FileCursor
): number[] {
    let value = "", ch = content[fileCursor.marker];

    while (ch !== undefined) {
        ch = content[fileCursor.marker + 1];

        if (Object.prototype.hasOwnProperty.call(hexints, ch)) { value += ch; }
        else { break; }

        fileCursor.marker++;
        if (ch === "\n") { fileCursor.rowMarker++; fileCursor.colMarker = 0; }
        else { fileCursor.colMarker++; }
    }

    const values: number[] = [];
    switch (value.length) {
        case 3:
        case 4:
            value = value.padEnd(4, "f");
            values.push(...value.split('').map(c => parseInt(c + c, 16)));
            break;
        case 6:
        case 8:
            value = value.padEnd(8, "f");
            for (let i = 0; i < value.length; i += 2) {
                values.push(parseInt(value.slice(i, i + 2), 16));
            };
            values[3] = values[3] / 255;
            break;
    }

    return /\w/.test(ch) ? [] : values;
}

function stdScanner(
    content: string,
    fileCursor: t_FileCursor,
    palette: string
): number[] {
    const values: number[] = [], braceTrack: string[] = [];
    let value = "", awaitBrace = "", ok = true, deviance = 0, ch = content[fileCursor.marker];

    while (ch !== undefined) {
        ch = content[++fileCursor.marker];
        if (ch === "\n") { fileCursor.rowMarker++; fileCursor.colMarker = 0; }
        else { fileCursor.colMarker++; }


        if (deviance === 0 && (ch === ")" || ch === "," || ch === " " || ch === '/')) {
            const trimmed = value.trim();
            if (trimmed.length > 0) {

                if (trimmed.endsWith("deg")) {
                    const numValue = parseFloat(trimmed.slice(0, -3));
                    if (!isNaN(numValue)) {
                        values.push(numValue);
                    } else {
                        ok = false;
                    }
                } else if (trimmed.endsWith("%")) {
                    const numValue = parseFloat(trimmed.slice(0, -1));
                    if (!isNaN(numValue)) {
                        if (ch === '/') {
                            values.push(numValue / 100);
                        } else if (
                            (palette === "rgb" || palette === "rgba") && values.length < 3
                        ) {
                            values.push(Math.round((numValue / 100) * 255));
                        } else if (palette === "hsl" && (values.length === 1 || values.length === 2)) {
                            values.push(numValue);
                        } else if ((palette === "hwb" || palette === "lab" || palette === "lch" ||
                            palette === "oklab" || palette === "oklch") && values.length > 0) {
                            values.push(numValue); // For these, % indicates relative to max, keep as is for now and convert later if needed
                        } else {
                            values.push(numValue);
                        }
                    } else {
                        ok = false;
                    }
                } else if (!isNaN(Number(trimmed))) {
                    const numValue = Number(trimmed);
                    if ((palette === "rgb" || palette === "rgba") && values.length < 3) {
                        if (Number.isInteger(numValue) && numValue >= 0 && numValue <= 255) {
                            values.push(numValue);
                        } else {
                            values.push(numValue);
                        }
                    } else {
                        values.push(numValue);
                    }
                } else {
                    ok = false;
                }
            }
            value = "";
        } else {
            value += ch;
        }

        if (deviance === 0 && ch === ")") {
            break;
        } else if (awaitBrace === ch) {
            braceTrack.pop();
            deviance = braceTrack.length;
            awaitBrace = bracePair[braceTrack[deviance - 1] as keyof typeof bracePair];
        } else if (openBraces.includes(ch) && !["'", '"', "`"].includes(awaitBrace)) {
            braceTrack.push(ch);
            deviance = braceTrack.length;
            awaitBrace = bracePair[ch as keyof typeof bracePair];
        } else if (deviance === 0 && closeBraces.includes(ch)) {
            break;
        }
    }

    return ok ? values : [];
}

interface ColorData {
    values: number[];
    range: vscode.Range;
}

export default function parser(content: string, cursor: number, position: vscode.Position): Record<string, ColorData[]> {
    const stash: Record<string, ColorData[]> = {
        hex: [],
        rgb: [],
        hsl: [],
        hwb: [],
        lab: [],
        lch: [],
        rgba: [],
        hsla: [],
        oklab: [],
        oklch: []
    };
    try {
        const fileCurser = {
            marker: cursor,
            rowMarker: position.line,
            colMarker: position.character,
        };
        const fallbackCurser = {
            marker: cursor,
            rowMarker: position.line,
            colMarker: position.character,
        };
        let ch = content[cursor];
        let capture = '';
        let startPos = new vscode.Position(fileCurser.rowMarker, fileCurser.colMarker);

        while (fileCurser.marker < content.length) {
            ch = content[fileCurser.marker];
            if (ch === "\n") { fileCurser.rowMarker++; fileCurser.colMarker = 0; }
            else { fileCurser.colMarker++; }

            if (/\w/i.test(ch)) {
                capture += ch;
            } else if (ch !== "#") {
                startPos = new vscode.Position(fileCurser.rowMarker, fileCurser.colMarker);
                capture = '';
            }

            if (Object.prototype.hasOwnProperty.call(stash, capture) && content[fileCurser.marker + 1] === "(") {
                Object.assign(fallbackCurser, fileCurser);
                fileCurser.marker++;
                fileCurser.colMarker++;
                const values = stdScanner(content, fileCurser, capture);
                const endPos = new vscode.Position(fileCurser.rowMarker, fileCurser.colMarker);
                if (values.length) {
                    stash[capture].push({ values: values, range: new vscode.Range(startPos, endPos) });
                }
                Object.assign(fileCurser, fallbackCurser);
                capture = '';
            }
            else if (ch === '#') {
                const values = hexScanner(content, fileCurser);
                const endPos = new vscode.Position(fileCurser.rowMarker, fileCurser.colMarker);
                if (values.length) {
                    stash.hex.push({ values: values, range: new vscode.Range(startPos, endPos) });
                }
            }
            fileCurser.marker++;
        }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Error scanning content:', errorMessage);
    }
    return stash;
}