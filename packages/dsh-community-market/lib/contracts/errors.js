export class CatalogContractError extends Error {
    contract;
    issues;
    constructor(contract, issues) {
        super(`${contract} contract rejected: ${issues.map(issue => `${issue.path} ${issue.message}`).join('; ')}`);
        this.name = 'CatalogContractError';
        this.contract = contract;
        this.issues = issues;
    }
}
export function schemaIssues(errors) {
    if (!errors?.length) {
        return [{ path: '/', message: 'is invalid', keyword: 'validation' }];
    }
    return errors.map(error => ({
        path: error.instancePath || '/',
        message: error.message ?? 'is invalid',
        keyword: error.keyword,
    }));
}
export function semanticIssue(path, message) {
    return { path, message, keyword: 'semantic' };
}
