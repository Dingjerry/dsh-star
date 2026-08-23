import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots';
import { type MarketView } from './MarketSettingsTab.js';
import type { createMarketViewStore } from './market-view-store.js';
export type MarketOverlayProps = PropsRuntime<'shell.overlay'> & PropsStore<ReturnType<typeof createMarketViewStore>> & PropsLocale<'community-market'> & {
    readLocale: () => string;
    initialView?: MarketView;
};
export declare function MarketOverlay({ useStore, actions, readLocale, t, initialView }: MarketOverlayProps): import("react").JSX.Element | null;
