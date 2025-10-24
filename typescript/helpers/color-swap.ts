export function hslToRgb(
    h: number,
    s: number,
    l: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    s /= 100;
    l /= 100;
    const k = (n: number): number => (n + h / 30) % 12;
    const _a = s * Math.min(l, 1 - l);
    const f = (n: number): number => l - _a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const r = Math.max(0, Math.min(255, Math.round(f(0) * 255)));
    const g = Math.max(0, Math.min(255, Math.round(f(8) * 255)));
    const b = Math.max(0, Math.min(255, Math.round(f(4) * 255)));
    const a = Math.max(0, Math.min(1, alpha));
    return {
        r,
        g,
        b,
        alpha: a,
        converted: a === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${a})`
    };
}
export function rgbToHsl(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { h: number, s: number, l: number, alpha: number, converted: string } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h: number, s: number;
    let l = (max + min) / 2;
    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0; break;
        }
        h /= 6;
    }
    h = Math.round(h * 360);
    s = Math.round(s * 100);
    l = Math.round(l * 100);
    const a = Math.max(0, Math.min(1, alpha));
    return {
        h, s, l, alpha: a,
        converted: a === 1
            ? `hsl(${h} ${s}% ${l}%)`
            : `hsl(${h} ${s}% ${l}% / ${a})`
    };
}


export function labToRgb(
    L: number,
    a: number,
    b: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    const D65_Xn = 95.047;
    const D65_Yn = 100.0;
    const D65_Zn = 108.883;
    const f_y = (L + 16) / 116;
    const f_x = a / 500 + f_y;
    const f_z = f_y - b / 200;
    const inverse_f = (t: number): number => t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787;
    const X = inverse_f(f_x) * D65_Xn;
    const Y = inverse_f(f_y) * D65_Yn;
    const Z = inverse_f(f_z) * D65_Zn;
    const X_norm = X / 100;
    const Y_norm = Y / 100;
    const Z_norm = Z / 100;
    const r_linear = X_norm * 3.2406 + Y_norm * -1.5372 + Z_norm * -0.4986;
    const g_linear = X_norm * -0.9689 + Y_norm * 1.8758 + Z_norm * 0.0415;
    const b_linear = X_norm * 0.0557 + Y_norm * -0.2040 + Z_norm * 1.0570;
    const gammaCorrectAndClamp = (v: number): number => {
        v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        return Math.max(0, Math.min(255, Math.round(v * 255)));
    };
    const r = gammaCorrectAndClamp(r_linear);
    const g = gammaCorrectAndClamp(g_linear);
    const b_ = gammaCorrectAndClamp(b_linear);
    const a_ = Math.max(0, Math.min(1, alpha));
    return {
        r,
        g,
        b: b_,
        alpha: a_,
        converted: a_ === 1
            ? `rgb(${r}, ${g}, ${b_})`
            : `rgba(${r}, ${g}, ${b_}, ${a_})`
    };
}
export function rgbToLab(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { L: number, a: number, b: number, alpha: number, converted: string } {
    r /= 255;
    g /= 255;
    b /= 255;
    const gammaCorrected = (v: number): number => {
        return v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92;
    };
    r = gammaCorrected(r);
    g = gammaCorrected(g);
    b = gammaCorrected(b);
    const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    const Y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    const Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
    const f = (v: number): number => v > 0.008856 ? Math.cbrt(v) : (7.787 * v) + 16 / 116;
    const fX = f(X);
    const fY = f(Y);
    const fZ = f(Z);
    const L = (116 * fY) - 16;
    const a_comp = 500 * (fX - fY);
    const b_comp = 200 * (fY - fZ);
    const a_ = Math.max(0, Math.min(1, alpha));
    return {
        L: parseFloat(L.toFixed(1)),
        a: parseFloat(a_comp.toFixed(1)),
        b: parseFloat(b_comp.toFixed(1)),
        alpha: a_,
        converted: a_ === 1
            ? `lab(${parseFloat(L.toFixed(1))} ${parseFloat(a_comp.toFixed(1))} ${parseFloat(b_comp.toFixed(1))})`
            : `lab(${parseFloat(L.toFixed(1))} ${parseFloat(a_comp.toFixed(1))} ${parseFloat(b_comp.toFixed(1))} / ${a_})`
    };
}


export function lchToRgb(
    L: number,
    C: number,
    H: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    const hRad = H * Math.PI / 180;
    const _a = C * Math.cos(hRad);
    const _b = C * Math.sin(hRad);
    const rgb = labToRgb(L, _a, _b, alpha);
    const a_ = Math.max(0, Math.min(1, alpha));
    return {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        alpha: a_,
        converted: a_ === 1
            ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a_})`
    };
}
export function rgbToLch(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { L: number, C: number, H: number, alpha: number, converted: string } {
    const lab = rgbToLab(r, g, b, alpha);
    const L = lab.L;
    const _a = lab.a;
    const b_comp = lab.b;
    const C = Math.sqrt(_a * _a + b_comp * b_comp);
    let H = (Math.atan2(b_comp, _a) * 180 / Math.PI + 360) % 360;
    if (C < 1e-6) { H = 0; }
    const a_ = Math.max(0, Math.min(1, alpha));
    return {
        L: parseFloat(L.toFixed(1)),
        C: parseFloat(C.toFixed(1)),
        H: parseFloat(H.toFixed(1)),
        alpha: a_,
        converted: a_ === 1
            ? `lch(${parseFloat(L.toFixed(1))} ${parseFloat(C.toFixed(1))} ${parseFloat(H.toFixed(1))})`
            : `lch(${parseFloat(L.toFixed(1))} ${parseFloat(C.toFixed(1))} ${parseFloat(H.toFixed(1))} / ${a_})`
    };
}


export function hwbToRgb(
    h: number,
    w: number,
    bl: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    h = h % 360;
    w /= 100;
    bl /= 100;
    const baseRgb = hslToRgb(h, 100, 50);
    const red = baseRgb.r;
    const green = baseRgb.g;
    const blue = baseRgb.b;
    const r_final = red * (1 - w - bl) + w * 255;
    const g_final = green * (1 - w - bl) + w * 255;
    const b_final = blue * (1 - w - bl) + w * 255;
    const a_ = Math.max(0, Math.min(1, alpha));
    const r = Math.max(0, Math.min(255, Math.round(r_final)));
    const g = Math.max(0, Math.min(255, Math.round(g_final)));
    const b = Math.max(0, Math.min(255, Math.round(b_final)));
    return {
        r,
        g,
        b,
        alpha: a_,
        converted: a_ === 1
            ? `rgb(${r}, ${g}, ${b})`
            : `rgba(${r}, ${g}, ${b}, ${a_})`
    };
}
export function rgbToHwb(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { h: number, w: number, b: number, alpha: number, converted: string } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    if (max === min) {
        h = 0;
    } else if (max === r) {
        h = (60 * ((g - b) / (max - min)) + 360) % 360;
    } else if (max === g) {
        h = (60 * ((b - r) / (max - min)) + 120) % 360;
    } else if (max === b) {
        h = (60 * ((r - g) / (max - min)) + 240) % 360;
    }
    const w = min * 100;
    const bl = (1 - max) * 100;
    const a_ = Math.max(0, Math.min(1, alpha));
    return {
        h: parseFloat(h.toFixed(1)),
        w: parseFloat(w.toFixed(1)),
        b: parseFloat(bl.toFixed(1)),
        alpha: a_,
        converted: a_ === 1
            ? `hwb(${parseFloat(h.toFixed(1))} ${parseFloat(w.toFixed(1))}% ${parseFloat(bl.toFixed(1))}%)`
            : `hwb(${parseFloat(h.toFixed(1))} ${parseFloat(w.toFixed(1))}% ${parseFloat(bl.toFixed(1))}% / ${a_})`
    };
}


export function rgbToHex(
    r: number,
    g: number,
    b: number,
    alpha = 1
): string {
    const toHex = (c: number): string => {
        const hex = Math.round(c).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };
    const aVal = Math.max(0, Math.min(1, alpha));
    const alphaHex = Math.round(aVal * 255);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex !== 255 ? toHex(alphaHex) : ""}`;
}
export function hexToRgb(
    hex: string
): { r: number, g: number, b: number, alpha: number, converted: string } {
    const cleanHex = hex.startsWith("#") ? hex.slice(1) : hex;
    let r = 0, g = 0, b = 0, alpha = 1;
    if (cleanHex.length === 8) {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
        alpha = parseInt(cleanHex.substring(6, 8), 16) / 255;
        return {
            r, g, b, alpha: parseFloat(alpha.toFixed(3)),
            converted: alpha === 1
                ? `rgb(${r}, ${g}, ${b})`
                : `rgba(${r}, ${g}, ${b}, ${parseFloat(alpha.toFixed(3))})`
        };
    } else if (cleanHex.length === 6) {
        r = parseInt(cleanHex.substring(0, 2), 16);
        g = parseInt(cleanHex.substring(2, 4), 16);
        b = parseInt(cleanHex.substring(4, 6), 16);
        return { r, g, b, alpha, converted: `rgb(${r}, ${g}, ${b})` };
    } else if (cleanHex.length === 4) {
        r = parseInt(cleanHex.substring(0, 1).repeat(2), 16);
        g = parseInt(cleanHex.substring(1, 2).repeat(2), 16);
        b = parseInt(cleanHex.substring(2, 3).repeat(2), 16);
        alpha = parseInt(cleanHex.substring(3, 4).repeat(2), 16) / 255;
        return {
            r, g, b, alpha: parseFloat(alpha.toFixed(3)),
            converted: alpha === 1
                ? `rgb(${r}, ${g}, ${b})`
                : `rgba(${r}, ${g}, ${b}, ${parseFloat(alpha.toFixed(3))})`
        };
    } else if (cleanHex.length === 3) {
        r = parseInt(cleanHex.substring(0, 1).repeat(2), 16);
        g = parseInt(cleanHex.substring(1, 2).repeat(2), 16);
        b = parseInt(cleanHex.substring(2, 3).repeat(2), 16);
        return { r, g, b, alpha, converted: `rgb(${r}, ${g}, ${b})` };
    }
    throw new Error("Invalid hex color format");
}


// export function oklabToRgb(
//     L: number,
//     a: number,
//     b: number,
//     alpha = 1
// ): { r: number, g: number, b: number, alpha: number, converted: string } {
//     const l_prime = L + a * 0.3963377774 + b * 0.2158037573;
//     const m_prime = L - a * 0.1055613458 - b * 0.0638541728;
//     const s_prime = L - a * 0.0894841775 - b * 1.2914855480;
//     const l_linear = l_prime * l_prime * l_prime;
//     const m_linear = m_prime * m_prime * m_prime;
//     const s_linear = s_prime * s_prime * s_prime;
//     const r_linear = +4.0767416621 * l_linear - 3.3077115913 * m_linear + 0.2309699292 * s_linear;
//     const g_linear = -1.2684380046 * l_linear + 2.6097574011 * m_linear - 0.3413193965 * s_linear;
//     const b_linear = -0.0041960863 * l_linear - 0.7034186147 * m_linear + 1.707614701 * s_linear;
//     const srgbOetf = (val: number): number => {
//         val = Math.max(0, Math.min(1, val));
//         return val <= 0.0031308
//             ? 12.92 * val
//             : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
//     };
//     const r = Math.max(0, Math.min(255, Math.round(srgbOetf(r_linear) * 255)));
//     const g = Math.max(0, Math.min(255, Math.round(srgbOetf(g_linear) * 255)));
//     const b_ = Math.max(0, Math.min(255, Math.round(srgbOetf(b_linear) * 255)));
//     const a_ = Math.max(0, Math.min(1, alpha));
//     return {
//         r,
//         g,
//         b: b_,
//         alpha: a_,
//         converted: a_ === 1
//             ? `rgb(${r}, ${g}, ${b_})`
//             : `rgba(${r}, ${g}, ${b_}, ${a_})`
//     };
// }
// export function rgbToOklab(
//     r: number,
//     g: number,
//     b: number,
//     alpha = 1
// ): { L: number, a: number, b: number, alpha: number, converted: string } {
//     r /= 255;
//     g /= 255;
//     b /= 255;
//     const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
//     const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
//     const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
//     const l_ = Math.cbrt(l);
//     const m_ = Math.cbrt(m);
//     const s_ = Math.cbrt(s);
//     const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
//     const a_ = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
//     const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;
//     const alpha_ = Math.max(0, Math.min(1, alpha));
//     return {
//         L: parseFloat(L.toFixed(6)),
//         a: parseFloat(a_.toFixed(6)),
//         b: parseFloat(b_.toFixed(6)),
//         alpha: alpha_,
//         converted: alpha_ === 1
//             ? `oklab(${parseFloat(L.toFixed(6))} ${parseFloat(a_.toFixed(6))} ${parseFloat(b_.toFixed(6))})`
//             : `oklab(${parseFloat(L.toFixed(6))} ${parseFloat(a_.toFixed(6))} ${parseFloat(b_.toFixed(6))} / ${alpha_})`
//     };
// }

// Note: oklabToRgb may produce slightly different results compared to some tools (e.g., oklch.com)
// due to potential gamut mapping or UI-specific rounding. For exact matching, additional
// gamut mapping (e.g., perceptual mapping to sRGB) may be required.

export function oklabToRgb(
    L: number,
    a: number,
    b: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    const l_prime = L + a * 0.3963377774 + b * 0.2158037573;
    const m_prime = L - a * 0.1055613458 - b * 0.0638541728;
    const s_prime = L - a * 0.0894841775 - b * 1.2914855480;

    const l_linear = l_prime * l_prime * l_prime;
    const m_linear = m_prime * m_prime * m_prime;
    const s_linear = s_prime * s_prime * s_prime;

    const r_linear = +4.0767416621 * l_linear - 3.3077115913 * m_linear + 0.2309699292 * s_linear;
    const g_linear = -1.2684380046 * l_linear + 2.6097574011 * m_linear - 0.3413193965 * s_linear;
    const b_linear = -0.0041960863 * l_linear - 0.7034186147 * m_linear + 1.707614701 * s_linear;

    const srgbOetf = (val: number): number => {
        val = Math.max(0, Math.min(1, val));
        return val <= 0.0031308
            ? 12.92 * val
            : 1.055 * Math.pow(val, 1 / 2.4) - 0.055;
    };

    const r = Math.max(0, Math.min(255, Math.round(srgbOetf(r_linear) * 255)));
    const g = Math.max(0, Math.min(255, Math.round(srgbOetf(g_linear) * 255)));
    const b_ = Math.max(0, Math.min(255, Math.round(srgbOetf(b_linear) * 255)));
    const a_ = Math.max(0, Math.min(1, alpha));

    return {
        r,
        g,
        b: b_,
        alpha: a_,
        converted: a_ === 1
            ? `rgb(${r}, ${g}, ${b_})`
            : `rgba(${r}, ${g}, ${b_}, ${a_})`
    };
}

export function rgbToOklab(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { L: number, a: number, b: number, alpha: number, converted: string } {
    // Apply inverse sRGB OETF to convert non-linear sRGB to linear RGB
    const srgbInverseOetf = (val: number): number => {
        val = val / 255;
        return val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
    };

    const r_linear = srgbInverseOetf(r);
    const g_linear = srgbInverseOetf(g);
    const b_linear = srgbInverseOetf(b);

    const l = 0.4122214708 * r_linear + 0.5363325363 * g_linear + 0.0514459929 * b_linear;
    const m = 0.2119034982 * r_linear + 0.6806995451 * g_linear + 0.1073969566 * b_linear;
    const s = 0.0883024619 * r_linear + 0.2817188376 * g_linear + 0.6299787005 * b_linear;

    const l_ = Math.cbrt(l);
    const m_ = Math.cbrt(m);
    const s_ = Math.cbrt(s);

    const L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_;
    const a_ = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_;
    const b_ = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_;

    const alpha_ = Math.max(0, Math.min(1, alpha));

    return {
        L: parseFloat(L.toFixed(6)),
        a: parseFloat(a_.toFixed(6)),
        b: parseFloat(b_.toFixed(6)),
        alpha: alpha_,
        converted: alpha_ === 1
            ? `oklab(${parseFloat(L.toFixed(6))} ${parseFloat(a_.toFixed(6))} ${parseFloat(b_.toFixed(6))})`
            : `oklab(${parseFloat(L.toFixed(6))} ${parseFloat(a_.toFixed(6))} ${parseFloat(b_.toFixed(6))} / ${alpha_})`
    };
}


export function oklchToRgb(
    L: number,
    C: number,
    H: number,
    alpha = 1
): { r: number, g: number, b: number, alpha: number, converted: string } {
    const hRad = H * Math.PI / 180;
    const _a = C * Math.cos(hRad);
    const _b = C * Math.sin(hRad);
    const rgb = oklabToRgb(L, _a, _b, alpha);
    const a = Math.max(0, Math.min(1, alpha));
    return {
        r: rgb.r,
        g: rgb.g,
        b: rgb.b,
        alpha: a,
        converted: a === 1
            ? `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`
            : `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`
    };
}
export function rgbToOklch(
    r: number,
    g: number,
    b: number,
    alpha = 1
): { L: number, C: number, H: number, alpha: number, converted: string } {
    const oklab = rgbToOklab(r, g, b, alpha);
    const L = oklab.L;
    const _a = oklab.a;
    const _b = oklab.b;
    const C = Math.sqrt(_a * _a + _b * _b);
    let H = (Math.atan2(_b, _a) * 180 / Math.PI + 360) % 360;
    if (C < 1e-6) { H = 0; }
    const a = Math.max(0, Math.min(1, alpha));
    return {
        L: parseFloat(L.toFixed(3)),
        C: parseFloat(C.toFixed(3)),
        H: parseFloat(H.toFixed(1)),
        alpha: a,
        converted: a === 1
            ? `oklch(${parseFloat(L.toFixed(3))} ${parseFloat(C.toFixed(3))} ${parseFloat(H.toFixed(1))})`
            : `oklch(${parseFloat(L.toFixed(3))} ${parseFloat(C.toFixed(3))} ${parseFloat(H.toFixed(1))} / ${a})`
    };
}


export const SwitchRGB = {
    from: {
        lch: lchToRgb,
        lab: labToRgb,
        hwb: hwbToRgb,
        hsl: hslToRgb,
        oklch: oklchToRgb,
        oklab: oklabToRgb,
    },
    to: {
        lch: rgbToLch,
        lab: rgbToLab,
        hwb: rgbToHwb,
        hsl: rgbToHsl,
        oklch: rgbToOklch,
        oklab: rgbToOklab,
    },
    LoadHex: rgbToHex,
};