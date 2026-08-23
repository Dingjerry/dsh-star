import { validateLocalSourceRecords } from '../contracts/validate.js';
/**
 * Reconcile legacy multi-enabled settings into the single active-source model.
 * The first enabled record by user order wins. An all-disabled registry keeps
 * its explicit no-selection state.
 */
export function normalizeActiveSourceRecords(records) {
    const ordered = [...records].sort((left, right) => left.order - right.order);
    const activeSourceRecordId = ordered.find(record => record.enabled)?.sourceRecordId;
    return ordered.map(record => ({
        ...record,
        enabled: record.sourceRecordId === activeSourceRecordId,
    }));
}
export class SettingsCatalogSourceStore {
    scope;
    constructor(scope) {
        this.scope = scope;
    }
    async load() {
        const records = [...this.scope.get().sources];
        validateLocalSourceRecords(records);
        return normalizeActiveSourceRecords(records);
    }
    async save(records) {
        const normalized = normalizeActiveSourceRecords(records);
        validateLocalSourceRecords(normalized);
        await this.scope.update({ sources: normalized });
    }
}
export class MemoryCatalogSourceStore {
    records = [];
    async load() {
        return this.records;
    }
    async save(records) {
        const normalized = normalizeActiveSourceRecords(records);
        validateLocalSourceRecords(normalized);
        this.records = normalized.map(record => ({ ...record }));
    }
}
