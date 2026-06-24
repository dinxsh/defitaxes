export interface ChainConfig {
    chainName: string;
    displayName: string;
    nativeSymbol: string;
    wrappedNativeAddress: string;
}

/** EVM chains supported by GoldRush, with wrapped native token for pricing */
export const CHAINS: Record<string, ChainConfig> = {
    "eth-mainnet": {
        chainName: "eth-mainnet",
        displayName: "Ethereum",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    },
    "matic-mainnet": {
        chainName: "matic-mainnet",
        displayName: "Polygon",
        nativeSymbol: "MATIC",
        wrappedNativeAddress: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    },
    "bsc-mainnet": {
        chainName: "bsc-mainnet",
        displayName: "BNB Chain",
        nativeSymbol: "BNB",
        wrappedNativeAddress: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c",
    },
    "optimism-mainnet": {
        chainName: "optimism-mainnet",
        displayName: "Optimism",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    },
    "base-mainnet": {
        chainName: "base-mainnet",
        displayName: "Base",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0x4200000000000000000000000000000000000006",
    },
    "arbitrum-mainnet": {
        chainName: "arbitrum-mainnet",
        displayName: "Arbitrum",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
    "avalanche-mainnet": {
        chainName: "avalanche-mainnet",
        displayName: "Avalanche",
        nativeSymbol: "AVAX",
        wrappedNativeAddress: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    },
    "gnosis-mainnet": {
        chainName: "gnosis-mainnet",
        displayName: "Gnosis",
        nativeSymbol: "xDAI",
        wrappedNativeAddress: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d",
    },
    "fantom-mainnet": {
        chainName: "fantom-mainnet",
        displayName: "Fantom",
        nativeSymbol: "FTM",
        wrappedNativeAddress: "0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83",
    },
    "linea-mainnet": {
        chainName: "linea-mainnet",
        displayName: "Linea",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
    },
    "scroll-mainnet": {
        chainName: "scroll-mainnet",
        displayName: "Scroll",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0x5300000000000000000000000000000000000004",
    },
    "zksync-mainnet": {
        chainName: "zksync-mainnet",
        displayName: "zkSync Era",
        nativeSymbol: "ETH",
        wrappedNativeAddress: "0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91",
    },
};

export function getChainConfig(chainName: string): ChainConfig | undefined {
    return CHAINS[chainName];
}

export function getDisplayName(chainName: string): string {
    return CHAINS[chainName]?.displayName ?? chainName;
}

export function getWrappedNativeAddress(chainName: string): string | undefined {
    return CHAINS[chainName]?.wrappedNativeAddress;
}
