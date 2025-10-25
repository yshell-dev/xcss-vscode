/* eslint-disable @typescript-eslint/no-explicit-any */
import { m_Metadata } from '../types';

interface t_formatting {
    "": string[];
    [key: string]: string | Record<string, any>;
};

function formatObject(oldobj: Record<string, unknown>) {
    const newobj: t_formatting = { "": [] };
    const variables: Record<string, string> = {};

    for (const k of Object.keys(oldobj)) {
        const v = oldobj[k];
        if (typeof v === "string") {
            newobj[k] = v;
            variables[k] = v;
        } else if (v && typeof v === "object" && !Array.isArray(v)) {
            const objV = v as Record<string, unknown>;
            const keys = Object.keys(objV);
            if (keys.length) {
                const result = formatObject(objV);
                newobj[k] = result.newobj;
                Object.assign(variables, result.variables);
            } else {
                newobj[""].push(`${k}`);
            }
        }
    }

    return { newobj, variables };
}

function objectTreeMd(obj: t_formatting): string[] {
    const lines: string[] = [];

    for (const k of Object.keys(obj)) {
        const key = `\`${k}\``;
        if (k !== "") {
            const v = obj[k];
            if (v && typeof v === "object" && !Array.isArray(v)) {
                const nativeList = Array.isArray(v[""]) ? v[""].map(i => `\`${i}\``).join(' ') : String(v[""]);
                lines.push(`- ${key} : ${nativeList}`);
                lines.push(...(objectTreeMd(v as t_formatting).map(i => `  ${i}`)));
            } else {
                lines.push(`- *${key}*: *\`${v}\`*`);
            }
        }
    }

    return lines;
}


export function metadataFormat(selector: string, data: m_Metadata, subhead = ""): string {
    const lines: string[] = [(subhead.length ? `${subhead}: ` : ``) + `**\`${selector}\`**`, ''];

    for (const item of data.info || []) { lines.push(`- ${item}`); }
    lines.push('\n- **Skeleton:**');

    if (data.skeleton) {
        for (const K of Object.keys(data.skeleton).sort().reverse()) {
            const V = data.skeleton[K];
            const formatted = formatObject({ [K]: V }).newobj;
            lines.push(...objectTreeMd(formatted));
        }
    }

    lines.push(`---`);
    lines.push(...(data.declarations || []).map(declaration => `- ${declaration}`));
    return lines.join('\n');
}

function mergeObjects(objects: Record<string, unknown>[]): Record<string, unknown> {
    function isObject(item: unknown): item is Record<string, unknown> {
        return item !== null && typeof item === 'object' && !Array.isArray(item);
    }

    const acc: Record<string, unknown> = {};
    for (const obj of objects) {
        for (const key of Object.keys(obj)) {
            const accVal = acc[key];
            const objVal = obj[key];

            if (Array.isArray(accVal) && Array.isArray(objVal)) {
                acc[key] = accVal.concat(objVal);
            } else if (isObject(accVal) && isObject(objVal)) {
                acc[key] = mergeObjects([accVal, objVal]);
            } else if (typeof objVal === 'string' || typeof objVal === 'number') {
                acc[key] = objVal;
            } else if (objVal !== undefined) {
                acc[key] = objVal;
            }
        }
    }
    return acc;
}

export function metamergeFormat(heading: string, declaration: string, objects: m_Metadata[]) {
    const merged: m_Metadata = {
        info: [],
        skeleton: { "": {} },
        declarations: [declaration],
        summon: '',
        variables: {}
    };

    for (const object of objects) {
        merged.info?.push(...(object.info || []));
        Object.assign((merged.variables || {}), (object.variables || {}));
        merged.skeleton = mergeObjects([(merged.skeleton || {}), (object.skeleton || {})]) as Record<string, object>;
    }

    return { toolTip: metadataFormat(heading, merged), effectiveXtyle: merged };
}

