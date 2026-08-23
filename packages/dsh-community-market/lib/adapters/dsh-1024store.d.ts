import type { CatalogAdapter } from '../contracts/types.js';
export declare const DSH_1024STORE_KEY = "dsh-1024store";
export declare const DSH_1024STORE_ENDPOINT = "https://deepseek1024.com/api/v1/plugins";
export declare const DSH_1024STORE_HOSTNAME = "deepseek1024.com";
export declare const DSH_1024STORE_PROVIDER_ID = "com.deepseek1024.catalog";
export declare const DSH_1024STORE_ADAPTER_ID = "market.dsh-1024store-v1";
export interface Dsh1024StoreRawItem {
    readonly id?: unknown;
    readonly name?: unknown;
    readonly owner?: unknown;
    readonly url?: unknown;
    readonly category?: unknown;
    readonly description?: unknown;
    readonly pushedAt?: unknown;
    readonly added?: unknown;
    readonly stars?: unknown;
    readonly installCount?: unknown;
    readonly installMethods?: unknown;
    readonly media?: unknown;
}
export declare const dsh1024StoreAdapter: CatalogAdapter;
