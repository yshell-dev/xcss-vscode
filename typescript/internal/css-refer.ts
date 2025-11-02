
import { getDefaultCSSDataProvider, IPropertyData } from 'vscode-css-languageservice';
import { ExtensionManager } from '../activate';

export class CSSREFERENCE {

    private Server: ExtensionManager;

    constructor(core: ExtensionManager) {
        this.Server = core;
        const i = setInterval(() => this.select(this.Server.Global.environment), 10000);
        this.Server.Context.subscriptions.push({ dispose: i.close });
    };


    public CSS_Properties: IPropertyData[] = [];
    public CSS_AtDirectives: IPropertyData[] = [];
    public CSS_PseudoClasses: IPropertyData[] = [];
    public CSS_PseudoElements: IPropertyData[] = [];

    private readonly CSS_GROUP_OPTIONS: Record<string, () => void> = {
        browser: () => {
            const provider = getDefaultCSSDataProvider();
            this.CSS_Properties = provider.provideProperties();
            this.CSS_AtDirectives = provider.provideAtDirectives();
            this.CSS_PseudoClasses = provider.providePseudoClasses();
            this.CSS_PseudoElements = provider.providePseudoElements();
        },
        none: () => {
            this.CSS_Properties = [];
            this.CSS_AtDirectives = [];
            this.CSS_PseudoClasses = [];
            this.CSS_PseudoElements = [];
        }
    };

    private CSS_ACTIVE_SRC = "";
    private readonly CSS_DEFAULT_SRC = Object.keys(this.CSS_GROUP_OPTIONS)[0];

    select(source: string | unknown = this.CSS_DEFAULT_SRC) {
        if (typeof source === "string" && this.CSS_GROUP_OPTIONS[source]) {
            if (source !== this.CSS_ACTIVE_SRC) {
                this.CSS_GROUP_OPTIONS[source]();
                this.CSS_ACTIVE_SRC = source;
            }
        } else {
            this.CSS_GROUP_OPTIONS[this.CSS_DEFAULT_SRC]();
            this.CSS_ACTIVE_SRC = this.CSS_DEFAULT_SRC;
        }
    }

    dispose() {
        return;
    }
}