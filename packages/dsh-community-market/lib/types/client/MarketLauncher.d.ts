import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import type { createMarketViewStore } from './market-view-store.js';
export type MarketLauncherProps = PropsRuntime<'sidebar.footer.action'> & PropsStore<ReturnType<typeof createMarketViewStore>> & PropsLocale<'community-market'>;
export declare function MarketLauncher({ wide, useStore, actions, t }: MarketLauncherProps): import("react").JSX.Element;
