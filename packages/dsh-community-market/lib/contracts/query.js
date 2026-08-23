import { CatalogContractError, semanticIssue } from './errors.js';
import { parseCatalogQuery, parseCatalogSource } from './validate.js';
function queryWithoutCursor(query) {
    const { cursor: _cursor, ...rest } = query;
    return rest;
}
function queryKey(query) {
    const normalized = queryWithoutCursor(query);
    return JSON.stringify({
        q: normalized.q,
        category: normalized.category,
        capability: normalized.capability,
        limit: normalized.limit,
        sort: normalized.sort,
        locale: normalized.locale,
    });
}
export function normalizeCatalogQuery(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        return parseCatalogQuery(value);
    }
    const input = value;
    const normalized = { ...input };
    if (typeof normalized.q === 'string') {
        const q = normalized.q.trim();
        if (q)
            normalized.q = q;
        else
            delete normalized.q;
    }
    if (normalized.limit === undefined)
        normalized.limit = 50;
    if (Array.isArray(normalized.category))
        normalized.category = [...normalized.category];
    if (Array.isArray(normalized.capability))
        normalized.capability = [...normalized.capability];
    return parseCatalogQuery(normalized);
}
function supports(source, field) {
    return source.query.supported.includes(field);
}
export function serializeCatalogQuery(sourceValue, queryValue) {
    const source = parseCatalogSource(sourceValue);
    const query = normalizeCatalogQuery(queryValue);
    const url = new URL(source.transport.endpoint);
    if (supports(source, 'q') && query.q !== undefined)
        url.searchParams.set('q', query.q);
    if (supports(source, 'category')) {
        for (const category of query.category ?? [])
            url.searchParams.append('category', category);
    }
    if (supports(source, 'capability')) {
        for (const capability of query.capability ?? [])
            url.searchParams.append('capability', capability);
    }
    if (supports(source, 'cursor') && query.cursor !== undefined)
        url.searchParams.set('cursor', query.cursor);
    if (supports(source, 'limit')) {
        url.searchParams.set('limit', String(Math.min(query.limit ?? 50, source.query.maxLimit)));
    }
    if (supports(source, 'sort') && query.sort !== undefined) {
        const supportedSorts = source.query.sorts;
        if (!supportedSorts.includes(query.sort)) {
            throw new CatalogContractError('query', [
                semanticIssue('/sort', `is not supported by provider ${source.providerId}`),
            ]);
        }
        url.searchParams.set('sort', query.sort);
    }
    if (supports(source, 'locale') && query.locale !== undefined)
        url.searchParams.set('locale', query.locale);
    return url;
}
export function scopeCatalogCursor(value, sourceRecordId, queryValue) {
    if (!value || !sourceRecordId) {
        throw new CatalogContractError('query', [semanticIssue('/cursor', 'cursor value and source identity are required')]);
    }
    const query = normalizeCatalogQuery(queryValue);
    return { value, sourceRecordId, queryKey: queryKey(query) };
}
export function applyScopedCatalogCursor(cursor, sourceRecordId, queryValue) {
    const query = normalizeCatalogQuery(queryValue);
    if (cursor.sourceRecordId !== sourceRecordId || cursor.queryKey !== queryKey(query)) {
        throw new CatalogContractError('query', [
            semanticIssue('/cursor', 'does not belong to this source and effective query'),
        ]);
    }
    return parseCatalogQuery({ ...queryWithoutCursor(query), cursor: cursor.value });
}
