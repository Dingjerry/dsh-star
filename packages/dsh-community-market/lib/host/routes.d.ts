import type { Context } from '@deepseek-ai/cordis';
import { type SettingsScope } from '@deepseek-ai/dsh-settings';
import type { CatalogSourceManifest } from '../contracts/index.js';
import type { CatalogHttpClient } from '../contracts/types.js';
import type { MarketSourceMutation } from '../api-types.js';
import { type MarketSettingsDocument } from '../catalog/source-store.js';
import { type MarketInstallService } from '../install/service.js';
export declare const MARKET_SETTINGS_NAMESPACE: import("@deepseek-ai/dsh-settings").SettingsNamespace;
export interface MarketRequestContext {
    readonly remoteAddress: string | undefined;
    readonly origin: string | undefined;
    readonly host: string | undefined;
    readonly secFetchSite?: string | undefined;
    readonly expectedPort: number;
}
export declare function marketRequestAllowed(context: MarketRequestContext): boolean;
export declare function marketMutationAllowed(context: MarketRequestContext): boolean;
export interface MarketInstallServiceProvider {
    get(): MarketInstallService | undefined;
}
export interface MarketDesktopActions {
    openTerminal(): void;
    requestRestart(): Promise<void>;
}
export interface MarketDesktopActionsProvider {
    get(): MarketDesktopActions | undefined;
}
export interface MarketDesktopPluginBundle {
    readonly bundleId: string;
    readonly packageName: string;
    readonly status: 'active' | 'disabled';
    readonly mutable: boolean;
}
export interface MarketDesktopPluginDisablePreview {
    readonly previewId: string;
    readonly profileName: string;
    readonly packageName: string;
    readonly expiresAt: string;
}
export interface MarketDesktopPluginEnablePreview {
    readonly previewId: string;
    readonly profileName: string;
    readonly packageName: string;
    readonly expiresAt: string;
}
export interface MarketDesktopPlugins {
    list(): readonly MarketDesktopPluginBundle[];
    previewDisable(bundleId: string): MarketDesktopPluginDisablePreview;
    executeDisable(previewId: string): Promise<{
        readonly packageName: string;
    }>;
    previewEnable(bundleId: string): MarketDesktopPluginEnablePreview;
    executeEnable(previewId: string): Promise<{
        readonly packageName: string;
    }>;
    isDisabled(packageName: string): boolean;
    disabledPackageNames(): readonly string[];
}
export interface MarketDesktopPluginsProvider {
    get(): MarketDesktopPlugins | undefined;
}
export declare function readStandardSourceManifest(manifestUrl: string, signal: AbortSignal, http?: CatalogHttpClient): Promise<CatalogSourceManifest>;
export declare function createMarketSourceMutator(scope: SettingsScope<MarketSettingsDocument>, onUnavailable?: (sourceRecordId: string) => void, readManifest?: (manifestUrl: string, signal: AbortSignal) => Promise<CatalogSourceManifest>): (mutation: MarketSourceMutation, signal: AbortSignal) => Promise<void>;
export declare function registerMarketRoutes(ctx: Context, scope: SettingsScope<MarketSettingsDocument>, installProvider?: MarketInstallServiceProvider, desktopActionsProvider?: MarketDesktopActionsProvider, desktopPluginsProvider?: MarketDesktopPluginsProvider): () => void;
export declare function registerMarketSettings(ctx: Context): SettingsScope<MarketSettingsDocument>;
export declare const marketRoutes: {
    state: string;
    sources: string;
    catalog: string;
    installable: string;
    assets: string;
    installations: string;
    openTerminal: string;
    requestRestart: string;
    operationPreview: string;
    operationExecute: string;
};
