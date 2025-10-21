import vscode from 'vscode';
import colorSense from '../helpers/color-sense';
import fileScanner from '../helpers/file-scanner';

import { SwitchRGB } from "../helpers/color-swap";
import { SERVER } from '../server';
import { t_TrackRange } from '../types';

export class Palette {
    private Core: SERVER;

    constructor(core: SERVER) {
        this.Core = core;
    }

    dispose() {
        return;
    }

    // Color Provider

    provideDocumentColors(document: vscode.TextDocument): vscode.ColorInformation[] {
        if (!(this.Core.isFileTargetedFile() && document)) { return []; };
        const colors: vscode.ColorInformation[] = [];
        const scanned = fileScanner(document.getText());
        const blockRanges: t_TrackRange[] = [];
        if (scanned.TagRanges) {
            for (const range of scanned.TagRanges) {
                blockRanges.push(...range.cache.composes);
            }
        }

        for (const range of blockRanges) {
            if (!range.val) { continue; }
            const colorResults = colorSense(range.val, 0, range.valRange.start);
            for (const type in Object.keys(colorResults)) {
                const colorDatas = colorResults[type];
                for (const colorData of colorDatas) {
                    let r = 0, g = 0, b = 0, alpha = 1;
                    switch (type) {
                        case 'hex':
                        case 'rgb':
                        case 'rgba':
                            [r, g, b, alpha] = colorData.values.length === 4 ? colorData.values : [...colorData.values, 1];
                            r = +r * 255 <= 1 ? +r * 255 : +r;
                            g = +g * 255 <= 1 ? +g * 255 : +g;
                            b = +b * 255 <= 1 ? +b * 255 : +b;
                            break;
                        case 'hsl':
                        case 'hsla':
                            [r, g, b, alpha] = (() => {
                                const [h, s, l, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.hsl(h, s * 100, l * 100, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                        case 'hwb':
                            [r, g, b, alpha] = (() => {
                                const [h, w, b_, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.hwb(h, w * 100, b_ * 100, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                        case 'lab':
                            [r, g, b, alpha] = (() => {
                                const [l, a_, b_, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.lab(l, a_, b_, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                        case 'lch':
                            [r, g, b, alpha] = (() => {
                                const [l, c, h, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.lch(l, c, h, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                        case 'oklab':
                            [r, g, b, alpha] = (() => {
                                const [l, a_, b_, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.oklab(l, a_, b_, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                        case 'oklch':
                            [r, g, b, alpha] = (() => {
                                const [l, c, h, a = 1] = colorData.values;
                                const rgb = SwitchRGB.from.oklch(l, c, h, a);
                                return [rgb.r, rgb.g, rgb.b, a];
                            })();
                            break;
                    }
                    colors.push(new vscode.ColorInformation(colorData.range, new vscode.Color(r / 255, g / 255, b / 255, alpha)));
                }
            }
        }


        return colors;
    };

    provideColorPresentations(color: vscode.Color): vscode.ColorPresentation[] {

        const r = Math.round(color.red * 255);
        const g = Math.round(color.green * 255);
        const b = Math.round(color.blue * 255);
        const a = color.alpha;

        const presentations: vscode.ColorPresentation[] = [
            new vscode.ColorPresentation(SwitchRGB.LoadHex(r, g, b, a)),
            new vscode.ColorPresentation(a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`),
            new vscode.ColorPresentation(SwitchRGB.to.hsl(r, g, b, a).converted),
            new vscode.ColorPresentation(SwitchRGB.to.lab(r, g, b, a).converted),
            new vscode.ColorPresentation(SwitchRGB.to.hwb(r, g, b, a).converted),
            new vscode.ColorPresentation(SwitchRGB.to.lch(r, g, b, a).converted),
            new vscode.ColorPresentation(SwitchRGB.to.oklab(r, g, b, a).converted),
            new vscode.ColorPresentation(SwitchRGB.to.oklch(r, g, b, a).converted),
        ];

        return presentations;
    }
}