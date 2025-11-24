import { t_Metadata, t_ManifestLocals, t_TagRange, t_TrackRange, } from './types';
import { ExtensionManager } from './activate';
import { metadataFormat } from './helpers/metadata';

export class FILELOCAL {
    private Server: ExtensionManager;
    manifest: t_ManifestLocals;

    watchingAttributes: string[] = [];
    tagranges: t_TagRange[] = [];
    attachables: Record<string, t_Metadata> = {};
    assignables: Record<string, t_Metadata> = {};

    constructor(core: ExtensionManager) {
        this.Server = core;
        this.manifest = {
            hashes: [],
            assignable: [],
            attachable: [],
            symclasses: {},
        };
        this.updateManifest();
    }

    RangeFilter(watching = true, comments = true, compose = true): t_TrackRange[] {
        const acc: t_TrackRange[] = [];
        for (const I of this.tagranges) {
            if (watching) {
                for (const i of I.cache.watchingRanges) { acc.push(i); }
            }
            if (comments) {
                for (const i of I.cache.commentsRanges) { acc.push(i); }
            }
            if (compose) {
                for (const i of I.cache.composerRanges) { acc.push(i); }
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
        let h = symclass + ":";
        const metadata = this.getMetadata(symclass);

        if (!metadata) {
            return "";
        } else if (!metadata.markdown) {
            const mods: string[] = [];
            if (this.manifest.assignable.includes(symclass)) { mods.push(" Assignable "); }
            if (this.manifest.attachable.includes(symclass)) { mods.push(" Attachable "); }
            h += mods.join("&");
            metadata.markdown = metadataFormat(h, metadata);
        }

        return metadata.markdown;
    }


    updateManifest(manifest: t_ManifestLocals = this.manifest) {
        this.manifest = manifest;

        const l = this.manifest.symclasses;
        const g = this.Server.Global.symclasses;

        const as: Record<string, t_Metadata> = {};
        const at: Record<string, t_Metadata> = {};
        for (const a of this.manifest.assignable) { as[a] = l[a] || g[a]; }
        for (const a of this.manifest.attachable) { at[a] = l[a] || g[a]; }
        this.assignables = as;
        this.attachables = at;

        for (const s of Object.keys(manifest.symclasses)) {
            if (this.Server.Global.symclasses[s]) {
                this.Server.Global.symclasses[s] = manifest.symclasses[s];
            }
        }
    }

    findSymclass(symclass: string) {
        return this.Server.Global.symclasses[symclass] || this.manifest.symclasses?.[symclass];
    }
}