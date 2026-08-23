import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import type { MarketInstallReceipt } from '../api-types.js';
import type { CatalogSnapshot } from '../contracts/generated/catalog-snapshot.js';
import type { CatalogSourceStore, LocalSourceRecord } from '../contracts/types.js';
export interface MarketCatalogCache {
    readonly version: 1;
    readonly sourceRecordId: string;
    readonly locale: string;
    readonly savedAt: string;
    readonly snapshot: CatalogSnapshot;
    readonly categories: readonly string[];
    readonly scannedAt: string;
    readonly expiresAt: string;
    readonly providerRevision?: string;
}
export interface MarketSettingsDocument {
    readonly sources: readonly LocalSourceRecord[];
    readonly installReceipts?: readonly MarketInstallReceipt[];
    readonly catalogCache?: MarketCatalogCache;
}
/**
 * Reconcile legacy multi-enabled settings into the single active-source model.
 * The first enabled record by user order wins. An all-disabled registry keeps
 * its explicit no-selection state.
 */
export declare function normalizeActiveSourceRecords(records: readonly LocalSourceRecord[]): readonly LocalSourceRecord[];
export declare class SettingsCatalogSourceStore implements CatalogSourceStore {
    private readonly scope;
    constructor(scope: SettingsScope<MarketSettingsDocument>);
    load(): Promise<readonly LocalSourceRecord[]>;
    save(records: readonly LocalSourceRecord[]): Promise<void>;
}
export declare class MemoryCatalogSourceStore implements CatalogSourceStore {
    private records;
    load(): Promise<readonly LocalSourceRecord[]>;
    save(records: readonly LocalSourceRecord[]): Promise<void>;
}
