import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client';
export interface MarketViewState {
    open: boolean;
}
type MarketViewActions = {
    open: (draft: MarketViewState) => void;
    close: (draft: MarketViewState) => void;
};
export declare function createMarketViewStore(): EngineStoreHandle<MarketViewState, MarketViewActions>;
export {};
