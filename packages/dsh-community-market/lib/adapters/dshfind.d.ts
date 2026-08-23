import type { CatalogAdapter } from '../contracts/types.js';
export declare const DSHFIND_KEY = "dshfind";
export declare const DSHFIND_ENDPOINT = "https://api.dshfind.com/v1/plugins";
export declare const DSHFIND_HOSTNAME = "api.dshfind.com";
export declare const DSHFIND_PROVIDER_ID = "com.dshfind.catalog";
export declare const DSHFIND_ADAPTER_ID = "market.dshfind-v1";
export interface DshfindAdapterOptions {
    /** Keep the anonymous production client below dshfind's documented 30/minute quota. */
    readonly interPageDelayMs?: number;
    readonly now?: () => Date;
}
export declare function createDshfindAdapter(options?: DshfindAdapterOptions): CatalogAdapter;
export declare const dshfindAdapter: CatalogAdapter;
