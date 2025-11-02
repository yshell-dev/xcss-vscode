import { m_Metadata, t_ManifestLocal, t_TagRange, t_TrackRange, } from './types';
import { ExtensionManager } from './activate';
import { metadataFormat } from './helpers/metadata';

export class FILELOCAL {
    // Ranges Saved on Parse
    public filePath = "";
    public fileExtn = "";
    private Server: ExtensionManager;
    tagranges!: t_TagRange[];
    manifest!: t_ManifestLocal;

    constructor(core: ExtensionManager) {
        this.Server = core;

    }

    UpdateLocals = (locals: Record<string, t_ManifestLocal>) => {
        for (const l of Object.keys(locals)) {
            if (this.Locals[l]) {
                this.Locals[l].manifest = locals[l];
            } else {
                this.Locals[l] = {
                    manifest: locals[l],
                    tagranges: [],
                };
            }
        }
    };

    getTagAtValPairRanges(tracks = true, comments = true, compose = true): t_TrackRange[] {
        const acc: t_TrackRange[] = [];
        for (const I of this.tagranges) {
            if (tracks) {
                for (const i of I.cache.watchtracks) { acc.push(i); }
            }
            if (comments) {
                for (const i of I.cache.comments) { acc.push(i); }
            }
            if (compose) {
                for (const i of I.cache.composes) { acc.push(i); }
            }
        }
        return acc;
    }

    getTagRanges() {
        return this.tagranges || [];
    }

    getMarkdown(local: t_ManifestLocal, symclass: string) {
        let r = "";
        const metadata = local.symclasses[symclass] || this.Server.Global.symclasses[symclass];

        if (!metadata) {
            return "";
        } else if (!metadata.markdown) {
            if (local.assignable.includes(symclass)) { r += "Assignable"; }
            if (local.attachable.includes(symclass)) {
                r += r.length == 0 ? "Attachable" : " & Attachable";
            }
            metadata.markdown = metadataFormat(r, metadata);
        }

        return metadata.markdown;
    }

    getSymclasses(onlyattachable: boolean) {
        const r: Record<string, m_Metadata> = {};
        const m = this.manifest;
        for (const a of m.attachable) {
            r[a] = m.symclasses[a] || m.symclasses[a];
        }
        if (!onlyattachable) {
            for (const a of m.assignable) {
                r[a] = m.symclasses[a] || m.symclasses[a];
            }
        }
        return r;
    }

    findSymclass(symclass: string) {
        return this.Server.Global.symclasses[symclass] || this.manifest.symclasses?.[symclass];
    }
}