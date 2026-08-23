import { type RawMarketImage } from './restricted-image.js';
/** Decode an untrusted image and emit a fixed-size metadata-free PNG. */
export declare function normalizeMarketImage(image: RawMarketImage): Promise<Buffer>;
