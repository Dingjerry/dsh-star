import { type RestrictedImageFetcher } from './restricted-image.js';
import type { MarketMediaService } from './types.js';
export interface MarketMediaServiceOptions {
    readonly fetchImage?: RestrictedImageFetcher;
    readonly normalizeImage?: (image: Awaited<ReturnType<RestrictedImageFetcher>>) => Promise<Buffer>;
    readonly now?: () => number;
    readonly cacheTtlMs?: number;
    readonly maxCachedAssets?: number;
    readonly maxRegisteredAssets?: number;
    readonly maxConcurrentResolutions?: number;
    readonly createAssetRef?: () => string;
}
export declare function createMarketMediaService(options?: MarketMediaServiceOptions): MarketMediaService;
