import { registerMarketRoutes, registerMarketSettings, } from './host/routes.js';
import { createRestrictedHttpClient } from './network/restricted-http.js';
import { createNpmRegistryVerifier, MarketInstallService, } from './install/service.js';
export const name = 'community-market';
export const inject = ['webServer', 'settings'];
const npmRegistryHttp = createRestrictedHttpClient({
    // This is a compiled-in official registry hostname, never provider input.
    syntheticProxyHostnames: ['registry.npmjs.org'],
});
export function apply(ctx) {
    const scope = registerMarketSettings(ctx);
    let installService;
    let desktopActions;
    let desktopPlugins;
    const installProvider = { get: () => installService };
    const desktopActionsProvider = { get: () => desktopActions };
    const desktopPluginsProvider = { get: () => desktopPlugins };
    ctx.effect(() => registerMarketRoutes(ctx, scope, installProvider, desktopActionsProvider, desktopPluginsProvider), 'community-market: routes');
    ctx.inject(['desktopActions'], (desktopCtx) => {
        const actions = desktopCtx.get('desktopActions');
        desktopCtx.effect(() => {
            desktopActions = actions;
            return () => {
                if (desktopActions === actions)
                    desktopActions = undefined;
            };
        }, 'community-market: optional desktop actions');
    });
    ctx.inject(['desktopPlugins'], (desktopCtx) => {
        const plugins = desktopCtx.get('desktopPlugins');
        desktopCtx.effect(() => {
            desktopPlugins = plugins;
            return () => {
                if (desktopPlugins === plugins)
                    desktopPlugins = undefined;
            };
        }, 'community-market: optional desktop plugin management');
    });
    // Browsing remains portable. Desktop-only package operations appear whenever
    // the narrow profile and package-manager capabilities are live.
    ctx.inject(['desktopProfiles', 'desktopPnpm'], (desktopCtx) => {
        const profiles = desktopCtx.get('desktopProfiles');
        const pnpm = desktopCtx.get('desktopPnpm');
        desktopCtx.effect(() => {
            const service = new MarketInstallService(scope, () => profiles.current, pnpm, createNpmRegistryVerifier(npmRegistryHttp), {
                disabledPackageNames: () => {
                    const plugins = desktopPlugins;
                    if (plugins === undefined) {
                        throw new Error('desktop plugin policy unavailable');
                    }
                    return plugins.disabledPackageNames();
                },
            });
            installService = service;
            return () => {
                if (installService === service)
                    installService = undefined;
                service.dispose();
            };
        }, 'community-market: desktop package operations');
    });
}
export { marketRoutes } from './host/routes.js';
export { BUILT_IN_PROVIDERS, DefaultCatalogService } from './catalog/service.js';
export { dsh1024StoreAdapter } from './adapters/dsh-1024store.js';
export { dshfindAdapter } from './adapters/dshfind.js';
export * from './contracts/index.js';
