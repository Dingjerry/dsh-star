import type { CatalogSnapshot } from '../contracts/index.js';
import type { CatalogHttpClient, CatalogMediaRegistry, LocalSourceRecord } from '../contracts/types.js';
import type { MarketCatalogSourceResult, MarketSourceView } from '../api-types.js';
export interface BuiltInProviderDefinition {
    readonly key: string;
    readonly name: string;
    readonly description: string;
    readonly providerId: string;
    readonly adapterId: string;
    readonly endpoint: string;
    readonly attribution: {
        readonly name: string;
        readonly url: string;
        readonly notice?: string;
    };
    readonly partnership: boolean;
}
export declare const BUILT_IN_PROVIDERS: readonly BuiltInProviderDefinition[];
export interface CatalogService {
    listSources(): Promise<readonly MarketSourceView[]>;
    fetch(query: unknown, signal: AbortSignal, scope?: CatalogFetchScope): Promise<readonly MarketCatalogSourceResult[]>;
    scanCatalog(signal: AbortSignal, options?: CatalogScanOptions): Promise<CatalogFullIndex | undefined>;
    queryCatalog(index: CatalogFullIndex, query: unknown, scope?: CatalogFetchScope): readonly MarketCatalogSourceResult[];
    invalidateSource(sourceRecordId: string): void;
}
export interface CatalogScanOptions {
    readonly force?: boolean;
    readonly locale?: string;
    /** Reject a stale or foreign cursor scope before any provider I/O. */
    readonly expectedSourceRecordId?: string;
}
/** Complete, Host-normalized active-source scan. Page snapshots remain schema-bounded. */
export interface CatalogFullIndex {
    readonly source: MarketSourceView;
    readonly snapshots: readonly CatalogSnapshot[];
    readonly scannedAt: string;
    readonly expiresAt: string;
    readonly providerRevision?: string;
    readonly cacheStatus: 'fresh' | 'cached';
    readonly locale?: string;
    /** Opaque identity shared only between the Catalog and install verifier caches. */
    readonly scanKey: string;
    /** Host-only generation used to scope pagination tokens. */
    readonly sourceGeneration: number;
}
/** A provider cursor may only be replayed against the active source that issued it. */
export interface CatalogFetchScope {
    readonly sourceRecordId: string;
    readonly cursor?: string;
}
export interface CatalogServiceOptions {
    readonly cacheTtlMs?: number;
    readonly cursorTtlMs?: number;
    readonly now?: () => number;
    readonly maxCacheEntries?: number;
    readonly maxCursorEntries?: number;
    readonly maxConcurrentSources?: number;
    readonly catalogScanCacheTtlMs?: number;
    readonly adapterHttpClients?: ReadonlyMap<string, CatalogHttpClient>;
    readonly media?: CatalogMediaRegistry;
    /** Observe only Host-validated normalized snapshots; used by local capabilities such as install preview. */
    readonly observeSnapshot?: (snapshot: CatalogSnapshot) => void;
}
export declare class DefaultCatalogService implements CatalogService {
    private readonly store;
    private readonly http;
    private readonly catalogScanCache;
    private readonly cursors;
    private readonly sourceGenerations;
    private readonly catalogScanGenerations;
    private readonly catalogScanControllers;
    private readonly catalogScanGates;
    private readonly cursorTtlMs;
    private readonly maxCursorEntries;
    private readonly catalogScanCacheTtlMs;
    private readonly sourceConcurrency;
    private readonly now;
    private readonly adapterHttpClients;
    private readonly media;
    private readonly observeSnapshot;
    constructor(store: {
        load(): Promise<readonly LocalSourceRecord[]>;
    }, http: CatalogHttpClient, options?: CatalogServiceOptions);
    listSources(): Promise<readonly MarketSourceView[]>;
    invalidateSource(sourceRecordId: string): void;
    private purgeExpiredCursors;
    private issueCursor;
    private applyCursor;
    private exposeSnapshot;
    private revokeSourceCursors;
    private resetCatalogScan;
    scanCatalog(signal: AbortSignal, options?: CatalogScanOptions): Promise<CatalogFullIndex | undefined>;
    queryCatalog(index: CatalogFullIndex, value: unknown, scope?: CatalogFetchScope): readonly MarketCatalogSourceResult[];
    fetch(value: unknown, signal: AbortSignal, scope?: CatalogFetchScope): Promise<readonly MarketCatalogSourceResult[]>;
}
