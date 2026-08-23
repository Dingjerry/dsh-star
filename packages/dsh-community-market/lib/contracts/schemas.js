import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Ajv2020 } from 'ajv/dist/2020.js';
function readSchema(name) {
    const url = new URL(`../../docs/schemas/${name}.schema.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8'));
}
const ajv = new Ajv2020({
    allErrors: true,
    strict: true,
    validateFormats: true,
});
const require = createRequire(import.meta.url);
const addFormats = require('ajv-formats');
addFormats(ajv);
export const validators = {
    source: ajv.compile(readSchema('catalog-source')),
    query: ajv.compile(readSchema('catalog-query')),
    providerPage: ajv.compile(readSchema('catalog-provider-page')),
    snapshot: ajv.compile(readSchema('catalog-snapshot')),
};
