import type { IncomingHttpHeaders } from 'node:http';
import type { MarketMediaCandidate } from './types.js';
export type MarketMediaErrorCode = 'invalid-candidate' | 'blocked-address' | 'redirect' | 'timeout' | 'http' | 'response' | 'invalid-image';
export declare class MarketMediaError extends Error {
    readonly code: MarketMediaErrorCode;
    constructor(code: MarketMediaErrorCode);
}
export interface MediaPinnedAddress {
    readonly address: string;
    readonly family: 4 | 6;
}
export interface RawMarketImage {
    readonly body: Buffer;
    readonly contentType: 'image/png' | 'image/jpeg' | 'image/webp';
    readonly finalUrl: string;
}
interface MediaHttpResponse {
    readonly statusCode: number;
    readonly headers: IncomingHttpHeaders;
    readonly body: Buffer;
}
export interface RestrictedImageFetcherOptions {
    /** Exact, product-reviewed hosts allowed to resolve through an RFC 2544 fake-IP proxy. */
    readonly syntheticProxyHostnames?: readonly string[];
    readonly lookupAddresses?: (hostname: string) => Promise<readonly MediaPinnedAddress[]>;
    readonly request?: (url: URL, signal: AbortSignal, pinned: MediaPinnedAddress) => Promise<MediaHttpResponse>;
    readonly maxBodyBytes?: number;
    readonly totalTimeoutMs?: number;
}
export declare function normalizeAllowedHostnames(values: readonly string[]): readonly string[];
export declare function validateRemoteImageUrl(value: string, allowedHostnames: ReadonlySet<string>): URL;
export type RestrictedImageFetcher = (candidate: MarketMediaCandidate, signal: AbortSignal) => Promise<RawMarketImage>;
export declare function createRestrictedImageFetcher(options?: RestrictedImageFetcherOptions): RestrictedImageFetcher;
export {};
