import { type ValidateFunction } from 'ajv/dist/2020.js';
import type { CatalogProviderPage } from './generated/catalog-provider-page.js';
import type { CatalogQuery } from './generated/catalog-query.js';
import type { CatalogSnapshot } from './generated/catalog-snapshot.js';
import type { CatalogSourceManifest } from './generated/catalog-source.js';
type ContractValidators = {
    readonly source: ValidateFunction<CatalogSourceManifest>;
    readonly query: ValidateFunction<CatalogQuery>;
    readonly providerPage: ValidateFunction<CatalogProviderPage>;
    readonly snapshot: ValidateFunction<CatalogSnapshot>;
};
export declare const validators: ContractValidators;
export {};
