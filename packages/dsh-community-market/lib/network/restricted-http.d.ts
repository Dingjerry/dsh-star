import type { IncomingHttpHeaders } from 'node:http';
import type { CatalogHttpClient } from '../contracts/types.js';
export declare class CatalogNetworkError extends Error {
    readonly code: 'invalid-url' | 'blocked-address' | 'redirect' | 'timeout' | 'http' | 'response';
    constructor(code: 'invalid-url' | 'blocked-address' | 'redirect' | 'timeout' | 'http' | 'response');
}
export interface PinnedAddress {
    readonly address: string;
    readonly family: 4 | 6;
}
interface RestrictedHttpResponse {
    readonly statusCode: number;
    readonly headers: IncomingHttpHeaders;
    readonly body: Buffer;
}
export interface RestrictedHttpClientOptions {
    /**
     * Exact, reviewed hostnames that may resolve through a local proxy's
     * RFC 2544 fake-IP range. User-provided catalog hosts must never be added.
     */
    readonly syntheticProxyHostnames?: readonly string[];
    readonly lookupAddresses?: (hostname: string) => Promise<readonly PinnedAddress[]>;
    readonly resolveAddress?: (hostname: string) => Promise<PinnedAddress>;
    readonly request?: (url: URL, signal: AbortSignal, pinned: PinnedAddress) => Promise<RestrictedHttpResponse>;
    readonly totalTimeoutMs?: number;
    readonly maxBodyBytes?: number;
}
export declare function pinnedLookupResult(options: {
    readonly all?: boolean | undefined;
}, pinned: PinnedAddress): PinnedAddress | PinnedAddress[];
export declare function createRestrictedHttpClient(options?: RestrictedHttpClientOptions): CatalogHttpClient;
export interface CachedCatalogHttpClientOptions {
    readonly ttlMs?: number;
    readonly now?: () => number;
}
/** Cache completed catalog responses and collapse concurrent reads by URL. */
export declare function createCachedCatalogHttpClient(delegate: CatalogHttpClient, options?: CachedCatalogHttpClientOptions): CatalogHttpClient;
export declare const restrictedHttpClient: CatalogHttpClient;
export {};
