import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import type { MarketLocaleKey } from './locales.js';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'community-market': MarketLocaleKey;
    }
}
export declare const inject: string[];
export declare const NS = "community-market";
export declare function apply(ctx: ClientContext): void;
