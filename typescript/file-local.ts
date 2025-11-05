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
        this.reset();
        this.Server = core;
    }

    reset() {
        this.manifest = {
            assignable: [],
            attachable: [],
            diagnostics: [],
            symclasses: {},
        };
    }

    getTagAttrValPairRanges(tracks = true, comments = true, compose = true): t_TrackRange[] {
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

    getMetadata(symclass: string) {
        return this.manifest.symclasses[symclass] || this.Server.Global.symclasses[symclass];
    }

    getMarkdown(symclass: string) {
        let r = "";
        const metadata = this.getMetadata(symclass);

        if (!metadata) {
            return "";
        } else if (!metadata.markdown) {
            if (this.manifest.assignable.includes(symclass)) { r += "Assignable"; }
            if (this.manifest.attachable.includes(symclass)) {
                r += r.length == 0 ? "Attachable" : " & Attachable";
            }
            metadata.markdown = metadataFormat(r, metadata);
        }

        return metadata.markdown;
    }

    getSymclasses(onlyassignable = false) {
        const r: Record<string, m_Metadata> = {};
        const m = this.manifest;
        for (const a of m.attachable) {
            r[a] = m.symclasses[a] || m.symclasses[a];
        }
        if (!onlyassignable) {
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