import type { CatalogQuery } from './generated/catalog-query.js';
import type { CatalogSourceManifest } from './generated/catalog-source.js';
import type { ScopedCatalogCursor } from './types.js';
export declare function normalizeCatalogQuery(value: unknown): CatalogQuery;
export declare function serializeCatalogQuery(sourceValue: CatalogSourceManifest, queryValue: CatalogQuery): URL;
export declare function scopeCatalogCursor(value: string, sourceRecordId: string, queryValue: CatalogQuery): ScopedCatalogCursor;
export declare function applyScopedCatalogCursor(cursor: ScopedCatalogCursor, sourceRecordId: string, queryValue: CatalogQuery): CatalogQuery;
