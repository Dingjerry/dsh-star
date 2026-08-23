import type { Readable } from 'node:stream';
import type { SettingsScope } from '@deepseek-ai/dsh-settings';
import type { MarketInstallableResponse, MarketInstallReceipt } from '../api-types.js';
import type { CatalogFullIndex } from '../catalog/service.js';
import type { MarketSettingsDocument } from '../catalog/source-store.js';
import type { CatalogHttpClient, NormalizedRepositoryIdentity } from '../contracts/types.js';
import type { CatalogSnapshot } from '../contracts/index.js';
export type { MarketInstallReceipt } from '../api-types.js';
export interface MarketDesktopProfile {
    readonly name: string;
    readonly dir: string;
}
export interface MarketDesktopPnpmOutcome {
    readonly exitCode: number | null;
    readonly signal: NodeJS.Signals | null;
}
export interface MarketDesktopPnpmHandle {
    readonly stdout: Readable;
    readonly stderr: Readable;
    readonly done: Promise<MarketDesktopPnpmOutcome>;
    cancel(): void;
}
export interface MarketDesktopPnpm {
    runPlugin(args: readonly string[], invokingDir: string, signal?: AbortSignal): MarketDesktopPnpmHandle;
    installPlugin(request: {
        readonly pnpmOptions?: readonly string[];
        readonly invokingDir: string;
        readonly recovery: {
            readonly packageName: string;
            readonly packageVersion: string;
            readonly receiptId: string;
        };
        readonly signal?: AbortSignal;
    }): Promise<MarketDesktopPnpmHandle>;
    recoveredInstallReceiptIds(): Promise<readonly string[]>;
    acknowledgeRecoveredInstall(receiptId: string): Promise<void>;
    rollbackPluginInstall(receiptId: string): Promise<boolean>;
}
export interface MarketInstallPreview {
    readonly intent: string;
    readonly action: 'install';
    readonly profileName: string;
    readonly packageName: string;
    readonly version: string;
    readonly displayName: string;
    readonly expiresAt: string;
}
export interface MarketUninstallPreview {
    readonly intent: string;
    readonly action: 'uninstall';
    readonly profileName: string;
    readonly packageName: string;
    readonly version: string;
    readonly displayName: string;
    readonly expiresAt: string;
}
export interface MarketInstallResult {
    readonly receipt: MarketInstallReceipt;
}
export interface MarketUninstallResult {
    readonly receiptId: string;
    readonly packageName: string;
}
export type MarketOperationResult = ({
    readonly action: 'install';
    readonly restartToken: string;
} & MarketInstallResult) | ({
    readonly action: 'uninstall';
    readonly restartToken: string;
} & MarketUninstallResult);
export type MarketInstallErrorCode = 'invalid-request' | 'not-available' | 'conflict' | 'intent-expired' | 'verification-failed' | 'operation-failed' | 'persistence-failed';
/** Error whose message is safe to return through the loopback API. */
export declare class MarketInstallError extends Error {
    readonly code: MarketInstallErrorCode;
    constructor(code: MarketInstallErrorCode, message: string);
}
interface InstallCandidate {
    readonly key: string;
    readonly sourceRecordId: string;
    readonly providerId: string;
    readonly itemId: string;
    readonly displayName: string;
    readonly packageName: string;
    readonly version: string;
    readonly repository: NormalizedRepositoryIdentity;
    readonly savedAt: number;
}
export interface MarketNpmPackageVerifier {
    verify(candidate: Pick<InstallCandidate, 'packageName' | 'version' | 'repository'>, signal: AbortSignal): Promise<MarketNpmPackageVerification>;
}
export interface MarketNpmPackageVerification {
    readonly integrity: string;
    readonly bundlePatch: string;
    readonly tarball: string;
}
export interface MarketInstallServiceOptions {
    readonly now?: () => number;
    readonly intentTtlMs?: number;
    readonly candidateTtlMs?: number;
    readonly maxIntents?: number;
    readonly maxCandidates?: number;
    /** Host-owned policy state; Renderer values must never reach this callback. */
    readonly disabledPackageNames?: () => readonly string[];
}
/** Build the exact-version npm registry verifier used by the Host preview and execution paths. */
export declare function createNpmRegistryVerifier(http: CatalogHttpClient): MarketNpmPackageVerifier;
/** Host-owned install workflow. No provider command or Renderer package spec crosses this boundary. */
export declare class MarketInstallService {
    private readonly scope;
    private readonly currentProfile;
    private readonly pnpm;
    private readonly verifier;
    private readonly candidates;
    private readonly intents;
    private readonly restartIntents;
    private readonly now;
    private readonly intentTtlMs;
    private readonly candidateTtlMs;
    private readonly maxIntents;
    private readonly maxCandidates;
    private readonly disabledPackageNames;
    private readonly generation;
    private recoveryReconciliation;
    private operationActive;
    private closed;
    constructor(scope: SettingsScope<MarketSettingsDocument>, currentProfile: () => MarketDesktopProfile, pnpm: MarketDesktopPnpm, verifier: MarketNpmPackageVerifier, options?: MarketInstallServiceOptions);
    observeCatalog(snapshot: CatalogSnapshot): void;
    invalidateSource(sourceRecordId: string): void;
    listReceipts(): Promise<readonly MarketInstallReceipt[]>;
    /** Receipts that still prove one exact installed bundle in the active profile. */
    listVerifiedReceipts(signal?: AbortSignal): Promise<readonly MarketInstallReceipt[]>;
    listInstallable(index: CatalogFullIndex, signal: AbortSignal): Promise<MarketInstallableResponse>;
    previewInstall(sourceRecordId: string, itemId: string, signal: AbortSignal): Promise<MarketInstallPreview>;
    executeInstall(token: string, signal: AbortSignal): Promise<MarketInstallResult>;
    executePreview(token: string, signal: AbortSignal): Promise<MarketOperationResult>;
    /** Consume one short-lived restart grant issued only after a completed mutation. */
    consumeRestartToken(token: string): void;
    previewUninstall(receiptId: string, signal: AbortSignal): Promise<MarketUninstallPreview>;
    executeUninstall(token: string, signal: AbortSignal): Promise<MarketUninstallResult>;
    dispose(): void;
    private profile;
    private sameProfile;
    private receipts;
    private assertNoReceipt;
    private disabledPackages;
    private saveReceipts;
    private ensureRecoveredInstallReconciled;
    private reconcileRecoveredInstall;
    private issueIntent;
    private issueRestartToken;
    private consumeIntent;
    private purge;
    private trim;
    private runExclusive;
    private assertOpen;
    private operationSignal;
    private installMayHaveMutatedProfile;
    private runPlugin;
    private installOptions;
    private rollbackInstall;
}
