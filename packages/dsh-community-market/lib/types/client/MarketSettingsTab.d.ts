import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
export type MarketView = 'discover' | 'installable' | 'installed' | 'sources';
export type MarketSettingsTabProps = PropsRuntime<'settings.plugins.tab'> & PropsLocale<'community-market'> & {
    readLocale: () => string;
    initialView?: MarketView;
};
export interface MarketSurfaceProps {
    readonly readLocale: () => string;
    readonly t: MarketSettingsTabProps['t'];
    readonly showHeader?: boolean;
    readonly initialView?: MarketView;
}
export declare function MarketSurface({ initialView, readLocale, t, showHeader }: MarketSurfaceProps): import("react").JSX.Element;
export declare function MarketSettingsTab({ initialView, readLocale, t }: MarketSettingsTabProps): import("react").JSX.Element;
