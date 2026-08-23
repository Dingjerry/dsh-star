import dns from 'node:dns';
import https from 'node:https';
import { BlockList, isIP } from 'node:net';
const MAX_REDIRECTS = 2;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const CONNECT_TIMEOUT_MS = 8_000;
const FIRST_BYTE_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 30_000;
const SYNTHETIC_PROXY_NETWORK = '198.18.0.0';
const SYNTHETIC_PROXY_PREFIX = 15;
export class MarketMediaError extends Error {
    code;
    constructor(code) {
        super(`market media request failed: ${code}`);
        this.code = code;
        this.name = 'MarketMediaError';
    }
}
const blockedAddresses = new BlockList();
for (const [network, prefix] of [
    ['0.0.0.0', 8],
    ['10.0.0.0', 8],
    ['100.64.0.0', 10],
    ['127.0.0.0', 8],
    ['169.254.0.0', 16],
    ['172.16.0.0', 12],
    ['192.0.0.0', 24],
    ['192.168.0.0', 16],
    ['198.18.0.0', 15],
    ['224.0.0.0', 3],
]) {
    blockedAddresses.addSubnet(network, prefix, 'ipv4');
}
const syntheticProxyAddresses = new BlockList();
syntheticProxyAddresses.addSubnet(SYNTHETIC_PROXY_NETWORK, SYNTHETIC_PROXY_PREFIX, 'ipv4');
for (const [network, prefix] of [
    ['::', 128],
    ['::1', 128],
    ['fc00::', 7],
    ['fe80::', 10],
    ['ff00::', 8],
]) {
    blockedAddresses.addSubnet(network, prefix, 'ipv6');
}
function normalizeHostname(value) {
    if (value.length === 0 || value.includes('*') || value.includes('/') || value.includes('@')) {
        throw new MarketMediaError('invalid-candidate');
    }
    let parsed;
    try {
        parsed = new URL(`https://${value}`);
    }
    catch {
        throw new MarketMediaError('invalid-candidate');
    }
    if (parsed.hostname !== value.toLowerCase() || parsed.port || isIP(parsed.hostname) !== 0) {
        throw new MarketMediaError('invalid-candidate');
    }
    return parsed.hostname;
}
export function normalizeAllowedHostnames(values) {
    if (values.length === 0)
        throw new MarketMediaError('invalid-candidate');
    return [...new Set(values.map(normalizeHostname))].sort();
}
export function validateRemoteImageUrl(value, allowedHostnames) {
    let url;
    try {
        url = new URL(value);
    }
    catch {
        throw new MarketMediaError('invalid-candidate');
    }
    if (value.length > 2_048
        || url.protocol !== 'https:'
        || url.username
        || url.password
        || url.hash
        || url.port && url.port !== '443'
        || !allowedHostnames.has(url.hostname.toLowerCase())) {
        throw new MarketMediaError('invalid-candidate');
    }
    return url;
}
function assertSafeAddress(address, allowSyntheticProxyAddress = false) {
    const normalized = address.replace(/^\[|\]$/gu, '').split('%', 1)[0];
    const family = isIP(normalized);
    const addressFamily = family === 4 ? 'ipv4' : 'ipv6';
    const allowedSyntheticAddress = allowSyntheticProxyAddress
        && family === 4
        && syntheticProxyAddresses.check(normalized, 'ipv4');
    if (family === 0 || blockedAddresses.check(normalized, addressFamily) && !allowedSyntheticAddress) {
        throw new MarketMediaError('blocked-address');
    }
    return family;
}
async function defaultLookupAddresses(hostname) {
    const entries = await dns.promises.lookup(hostname, { all: true, verbatim: true });
    return entries.map(entry => ({
        address: entry.address,
        family: entry.family === 6 ? 6 : 4,
    }));
}
async function resolvePinnedAddress(hostname, lookupAddresses, syntheticProxyHostnames) {
    const literal = hostname.replace(/^\[|\]$/gu, '');
    if (isIP(literal))
        return { address: literal, family: assertSafeAddress(literal) };
    let addresses;
    try {
        addresses = await lookupAddresses(hostname);
    }
    catch (cause) {
        if (cause instanceof MarketMediaError)
            throw cause;
        throw new MarketMediaError('response');
    }
    if (addresses.length === 0)
        throw new MarketMediaError('blocked-address');
    const allowSyntheticProxyAddress = syntheticProxyHostnames.has(hostname.toLowerCase());
    for (const entry of addresses) {
        if (entry.family !== assertSafeAddress(entry.address, allowSyntheticProxyAddress)) {
            throw new MarketMediaError('blocked-address');
        }
    }
    return addresses[0];
}
function readBody(response, maxBodyBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        response.on('data', (chunk) => {
            const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            size += buffer.length;
            if (size > maxBodyBytes) {
                response.destroy(new MarketMediaError('response'));
                return;
            }
            chunks.push(buffer);
        });
        response.once('end', () => resolve(Buffer.concat(chunks)));
        response.once('error', reject);
    });
}
function requestOnce(url, signal, pinned, maxBodyBytes) {
    return new Promise((resolve, reject) => {
        let settled = false;
        let firstByteTimer;
        const finish = (callback) => {
            if (settled)
                return;
            settled = true;
            if (firstByteTimer !== undefined)
                clearTimeout(firstByteTimer);
            callback();
        };
        const request = https.request(url, {
            method: 'GET',
            headers: {
                accept: 'image/png,image/jpeg,image/webp',
                'accept-encoding': 'identity',
                'user-agent': 'dsh-community-market/0.1',
            },
            servername: url.hostname,
            lookup: (_hostname, options, callback) => {
                if (options.all)
                    callback(null, [pinned]);
                else
                    callback(null, pinned.address, pinned.family);
            },
            signal,
            timeout: CONNECT_TIMEOUT_MS,
        }, response => {
            if (firstByteTimer !== undefined)
                clearTimeout(firstByteTimer);
            const contentLength = Number(response.headers['content-length']);
            if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
                response.destroy();
                finish(() => reject(new MarketMediaError('response')));
                return;
            }
            void readBody(response, maxBodyBytes).then(body => finish(() => resolve({
                statusCode: response.statusCode ?? 0,
                headers: response.headers,
                body,
            })), cause => finish(() => reject(cause)));
        });
        request.once('error', cause => finish(() => reject(cause)));
        request.once('timeout', () => request.destroy(new MarketMediaError('timeout')));
        firstByteTimer = setTimeout(() => request.destroy(new MarketMediaError('timeout')), FIRST_BYTE_TIMEOUT_MS);
        request.end();
    });
}
function parseContentType(value) {
    const normalized = Array.isArray(value) ? value[0] : value;
    const match = normalized?.trim().toLowerCase().match(/^(image\/(?:png|jpeg|webp))(?:;|$)/u);
    if (match?.[1] === 'image/png' || match?.[1] === 'image/jpeg' || match?.[1] === 'image/webp') {
        return match[1];
    }
    throw new MarketMediaError('response');
}
async function fetchWithRedirects(start, allowedHostnames, signal, lookupAddresses, request, maxBodyBytes, syntheticProxyHostnames, redirectCount = 0) {
    if (signal.aborted)
        throw new MarketMediaError('timeout');
    const url = validateRemoteImageUrl(start, allowedHostnames);
    const pinned = await resolvePinnedAddress(url.hostname, lookupAddresses, syntheticProxyHostnames);
    if (signal.aborted)
        throw new MarketMediaError('timeout');
    let response;
    try {
        response = await request(url, signal, pinned);
    }
    catch (cause) {
        if (cause instanceof MarketMediaError)
            throw cause;
        throw new MarketMediaError('response');
    }
    if (response.body.byteLength > maxBodyBytes)
        throw new MarketMediaError('response');
    const status = response.statusCode;
    if (status >= 300 && status < 400) {
        if (redirectCount >= MAX_REDIRECTS)
            throw new MarketMediaError('redirect');
        const location = response.headers.location;
        if (location === undefined)
            throw new MarketMediaError('redirect');
        let redirectUrl;
        try {
            redirectUrl = new URL(location, url).href;
        }
        catch {
            throw new MarketMediaError('redirect');
        }
        return await fetchWithRedirects(redirectUrl, allowedHostnames, signal, lookupAddresses, request, maxBodyBytes, syntheticProxyHostnames, redirectCount + 1);
    }
    if (status < 200 || status >= 300)
        throw new MarketMediaError('http');
    const encoding = response.headers['content-encoding'];
    if (encoding !== undefined && encoding !== 'identity')
        throw new MarketMediaError('response');
    return {
        body: response.body,
        contentType: parseContentType(response.headers['content-type']),
        finalUrl: url.href,
    };
}
export function createRestrictedImageFetcher(options = {}) {
    const lookupAddresses = options.lookupAddresses ?? defaultLookupAddresses;
    const maxBodyBytes = options.maxBodyBytes ?? MAX_BODY_BYTES;
    const request = options.request
        ?? (async (url, signal, pinned) => await requestOnce(url, signal, pinned, maxBodyBytes));
    const totalTimeoutMs = options.totalTimeoutMs ?? TOTAL_TIMEOUT_MS;
    const syntheticProxyHostnames = new Set((options.syntheticProxyHostnames ?? []).map(normalizeHostname));
    return async (candidate, signal) => {
        const allowedHostnames = new Set(normalizeAllowedHostnames(candidate.allowedHostnames));
        validateRemoteImageUrl(candidate.remoteUrl, allowedHostnames);
        if (signal.aborted)
            throw new MarketMediaError('timeout');
        const controller = new AbortController();
        let rejectAbort;
        const aborted = new Promise((_resolve, reject) => { rejectAbort = reject; });
        const onAbort = () => {
            const cause = signal.reason ?? new DOMException('The operation was aborted', 'AbortError');
            controller.abort(cause);
            rejectAbort(cause);
        };
        signal.addEventListener('abort', onAbort, { once: true });
        let timer;
        const timedOut = new Promise((_resolve, reject) => {
            timer = setTimeout(() => {
                const cause = new MarketMediaError('timeout');
                controller.abort(cause);
                reject(cause);
            }, totalTimeoutMs);
        });
        const operation = fetchWithRedirects(candidate.remoteUrl, allowedHostnames, controller.signal, lookupAddresses, request, maxBodyBytes, syntheticProxyHostnames);
        try {
            return await Promise.race([operation, aborted, timedOut]);
        }
        catch (cause) {
            if (cause instanceof MarketMediaError)
                throw cause;
            if (signal.aborted)
                throw cause;
            throw new MarketMediaError('response');
        }
        finally {
            clearTimeout(timer);
            signal.removeEventListener('abort', onAbort);
        }
    };
}
