import type { MarketCatalogResponse, MarketDesktopActionResponse, MarketInstallableResponse, MarketInstallationsResponse, MarketOperationExecuteResponse, MarketOperationPreviewRequest, MarketOperationPreviewResponse, MarketSourceMutation, MarketStateResponse } from '../api-types.js';
/** HTTP facts used to localize safe Client-facing Market failures. */
export declare class MarketApiError extends Error {
    readonly status: number;
    readonly code?: string | undefined;
    constructor(message: string, status: number, code?: string | undefined);
}
export declare function readMarketState(signal?: AbortSignal): Promise<MarketStateResponse>;
export declare function readMarketCatalog(sourceRecordId: string, q: string, locale: string, categories: readonly string[], signal?: AbortSignal, refresh?: boolean): Promise<MarketCatalogResponse>;
export declare function readMoreMarketCatalog(sourceRecordId: string, cursor: string, q: string, locale: string, categories: readonly string[], signal?: AbortSignal): Promise<MarketCatalogResponse>;
export declare function mutateMarketSource(mutation: MarketSourceMutation, signal?: AbortSignal): Promise<MarketStateResponse['sources']>;
export declare function readMarketInstallations(signal?: AbortSignal): Promise<MarketInstallationsResponse>;
export declare function readMarketInstallable(locale: string, refresh?: boolean, signal?: AbortSignal): Promise<MarketInstallableResponse>;
export declare function previewMarketOperation(request: MarketOperationPreviewRequest, signal?: AbortSignal): Promise<MarketOperationPreviewResponse>;
export declare function executeMarketOperation(previewId: string, signal?: AbortSignal): Promise<MarketOperationExecuteResponse>;
export declare function openMarketTerminal(signal?: AbortSignal): Promise<MarketDesktopActionResponse>;
export declare function requestMarketRestart(restartToken: string, signal?: AbortSignal): Promise<MarketDesktopActionResponse>;
