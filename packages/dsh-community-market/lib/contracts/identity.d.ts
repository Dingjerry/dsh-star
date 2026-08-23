import type { CatalogProviderPage } from './generated/catalog-provider-page.js';
import type { CatalogIdentityChoice, NormalizedPackageIdentity, NormalizedRepositoryIdentity } from './types.js';
type CatalogItem = CatalogProviderPage['items'][number];
type RepositoryIdentity = NonNullable<CatalogItem['repository']>;
type PackageIdentity = NonNullable<CatalogItem['package']>;
export declare function normalizeRepositoryIdentity(repository: RepositoryIdentity): NormalizedRepositoryIdentity;
export declare function normalizePackageIdentity(packageIdentity: PackageIdentity): NormalizedPackageIdentity;
export declare function catalogIdentityChoices(item: CatalogItem): readonly CatalogIdentityChoice[];
export {};
