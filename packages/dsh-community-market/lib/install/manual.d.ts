import type { MarketManualInstallHint } from '../api-types.js';
import type { CatalogSnapshot } from '../contracts/index.js';
type CatalogItem = CatalogSnapshot['items'][number];
/**
 * Reconstruct a display-only command from Host-normalized identity.
 * Provider-supplied command strings never enter this function or its result.
 */
export declare function manualInstallHint(item: CatalogItem): MarketManualInstallHint | undefined;
export declare function manualInstallHints(items: readonly CatalogItem[]): readonly MarketManualInstallHint[];
export {};
