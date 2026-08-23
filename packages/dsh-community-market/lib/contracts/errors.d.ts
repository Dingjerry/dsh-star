import type { ErrorObject } from 'ajv';
export type CatalogContractName = 'source' | 'query' | 'provider-page' | 'snapshot' | 'local-source' | 'identity';
export interface CatalogContractIssue {
    readonly path: string;
    readonly message: string;
    readonly keyword: string;
}
export declare class CatalogContractError extends Error {
    readonly contract: CatalogContractName;
    readonly issues: readonly CatalogContractIssue[];
    constructor(contract: CatalogContractName, issues: readonly CatalogContractIssue[]);
}
export declare function schemaIssues(errors: readonly ErrorObject[] | null | undefined): readonly CatalogContractIssue[];
export declare function semanticIssue(path: string, message: string): CatalogContractIssue;
