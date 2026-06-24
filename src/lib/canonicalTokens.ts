/**
 * Cross-chain canonical token registry.
 *
 * Maps "chain:contractAddress" (lowercase) to a canonical token key so that
 * FIFO acquisition lots can be matched across chains. E.g. ETH bought on
 * Ethereum and sold on Arbitrum reduces the same lot pool.
 *
 * Tokens NOT listed here fall back to their chain-specific key, preserving
 * the previous per-chain behaviour for long-tail assets.
 */

const CANONICAL: Record<string, string> = {
    // ── ETH / WETH ────────────────────────────────────────────────────────────
    "eth-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "eth-mainnet:0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "eth", // WETH
    "optimism-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "optimism-mainnet:0x4200000000000000000000000000000000000006": "eth", // WETH
    "base-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "base-mainnet:0x4200000000000000000000000000000000000006": "eth", // WETH
    "arbitrum-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "arbitrum-mainnet:0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "eth", // WETH
    "linea-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "linea-mainnet:0xe5d7c2a44ffddf6b295a15c148167daaaf5cf34f": "eth", // WETH
    "scroll-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "scroll-mainnet:0x5300000000000000000000000000000000000004": "eth", // WETH
    "zksync-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "eth",
    "zksync-mainnet:0x5aea5775959fbc2557cc8789bc1bf90a239d9a91": "eth", // WETH

    // ── USDC ──────────────────────────────────────────────────────────────────
    "eth-mainnet:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "usdc",
    "matic-mainnet:0x2791bca1f2de4661ed88a30c99a7a9449aa84174": "usdc", // USDC.e
    "matic-mainnet:0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "usdc", // USDC native
    "bsc-mainnet:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "usdc",
    "optimism-mainnet:0x7f5c764cbc14f9669b88837ca1490cca17c31607": "usdc", // USDC.e
    "optimism-mainnet:0x0b2c639c533813f4aa9d7837caf62653d097ff85": "usdc", // USDC native
    "base-mainnet:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "usdc",
    "base-mainnet:0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca": "usdc", // USDbC
    "arbitrum-mainnet:0xff970a61a04b1ca14834a43f5de4533ebddb5cc8": "usdc", // USDC.e
    "arbitrum-mainnet:0xaf88d065e77c8cc2239327c5edb3a432268e5831": "usdc", // USDC native
    "avalanche-mainnet:0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664": "usdc", // USDC.e
    "avalanche-mainnet:0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "usdc", // USDC native
    "gnosis-mainnet:0xddafbb505ad214d7b80b1f830fccc89b60fb7a83": "usdc",
    "fantom-mainnet:0x04068da6c83afcfa0e13ba15a6696662335d5b75": "usdc",
    "linea-mainnet:0x176211869ca2b568f2a7d4ee941e073a821ee1ff": "usdc",
    "scroll-mainnet:0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4": "usdc",
    "zksync-mainnet:0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4": "usdc",

    // ── USDT ──────────────────────────────────────────────────────────────────
    "eth-mainnet:0xdac17f958d2ee523a2206206994597c13d831ec7": "usdt",
    "matic-mainnet:0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "usdt",
    "bsc-mainnet:0x55d398326f99059ff775485246999027b3197955": "usdt",
    "optimism-mainnet:0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "usdt",
    "arbitrum-mainnet:0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "usdt",
    "avalanche-mainnet:0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": "usdt",
    "gnosis-mainnet:0x4ecaba5870353805a9f068101a40e0f32ed605c6": "usdt",
    "fantom-mainnet:0x049d68029688eabf473097a2fc38ef61633a3c7a": "usdt",
    "linea-mainnet:0xa219439258ca9da29e9cc4ce5596924745e12b93": "usdt",
    "scroll-mainnet:0xf55bec9cafdbe8730f096aa55dad6d22d44099df": "usdt",
    "zksync-mainnet:0x493257fd37edb34451f62edf8d2a0c418852ba4c": "usdt",

    // ── DAI ───────────────────────────────────────────────────────────────────
    "eth-mainnet:0x6b175474e89094c44da98b954eedeac495271d0f": "dai",
    "matic-mainnet:0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": "dai",
    "bsc-mainnet:0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3": "dai",
    "optimism-mainnet:0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "dai",
    "base-mainnet:0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "dai",
    "arbitrum-mainnet:0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "dai",
    "avalanche-mainnet:0xd586e7f844cea2f87f50152665bcbc2c279d8d70": "dai",
    "gnosis-mainnet:0x44fa8e6f47987339850636f88629646662444217": "dai",
    "fantom-mainnet:0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e": "dai",
    "linea-mainnet:0x4af15ec2a0bd43db75dd04e62faa3b8ef36b00d5": "dai",
    "scroll-mainnet:0xca77eb3fefe3725dc33bccb54edefc3d9f764f97": "dai",
    "zksync-mainnet:0x4b9eb6c84d0a734ca39dce1a7a3f2a9c97c84edc": "dai",

    // ── WBTC ──────────────────────────────────────────────────────────────────
    "eth-mainnet:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "wbtc",
    "matic-mainnet:0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "wbtc",
    "arbitrum-mainnet:0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "wbtc",
    "avalanche-mainnet:0x50b7545627a5162f82a992c33b87adc75187b218": "wbtc",
    "optimism-mainnet:0x68f180fcce6836688e9084f035309e29bf0a2095": "wbtc",
    "base-mainnet:0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf": "wbtc",

    // ── MATIC / POL ───────────────────────────────────────────────────────────
    "matic-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "matic",
    "matic-mainnet:0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270": "matic", // WMATIC
    "eth-mainnet:0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0": "matic",
    "eth-mainnet:0x455e53cbb86018ac2b8092fdcd39d8444affc3f6": "matic", // POL

    // ── BNB ───────────────────────────────────────────────────────────────────
    "bsc-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "bnb",
    "bsc-mainnet:0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c": "bnb", // WBNB

    // ── AVAX ──────────────────────────────────────────────────────────────────
    "avalanche-mainnet:0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee": "avax",
    "avalanche-mainnet:0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7": "avax", // WAVAX

    // ── LINK ──────────────────────────────────────────────────────────────────
    "eth-mainnet:0x514910771af9ca656af840dff83e8264ecf986ca": "link",
    "matic-mainnet:0x53e0bca35ec356bd5dddfebbd1fc0fd03fabad39": "link",
    "arbitrum-mainnet:0xf97f4df75117a78c1a5a0dbb814af92458539fb4": "link",
    "optimism-mainnet:0x350a791bfc2c21f9ed5d10980dad2e2638ffa7f6": "link",
    "avalanche-mainnet:0x5947bb275c521040051d82396192181b413227a3": "link",
    "bsc-mainnet:0x404460c6a5ede2d891e8297795264fde62adbb75": "link",

    // ── UNI ───────────────────────────────────────────────────────────────────
    "eth-mainnet:0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "uni",
    "matic-mainnet:0xb33eaad8d922b1083446dc23f610c2567fb5180f": "uni",
    "arbitrum-mainnet:0xfa7f8980b0f1e64a2062791cc3b0871572f1f7f0": "uni",
    "optimism-mainnet:0x6fd9d7ad17242c41f7131d257212c54a0e816691": "uni",

    // ── AAVE ──────────────────────────────────────────────────────────────────
    "eth-mainnet:0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "aave",
    "matic-mainnet:0xd6df932a45c0f255f85145f286ea0b292b21c90b": "aave",
    "arbitrum-mainnet:0xba5ddd1f9d7f570dc94a51479a000e3bce967196": "aave",
    "avalanche-mainnet:0x63a72806098bd3d9520cc43356dd78afe5d386d9": "aave",
    "optimism-mainnet:0x76fb31fb4af56892a25e32cfc43de717950c9278": "aave",

    // ── stETH ─────────────────────────────────────────────────────────────────
    "eth-mainnet:0xae7ab96520de3a18e5e111b5eaab095312d7fe84": "steth",
    "arbitrum-mainnet:0x5979d7b546e38e414f7e9822514be443a4800529": "steth", // wstETH
    "optimism-mainnet:0x1f32b1c2345538c0c6f582fcb022739c4a194ebb": "steth", // wstETH
    "base-mainnet:0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452": "steth", // wstETH

    // ── rETH (Rocket Pool) ────────────────────────────────────────────────────
    "eth-mainnet:0xae78736cd615f374d3085123a210448e74fc6393": "reth",
    "arbitrum-mainnet:0xec70dcb4a1efa46b8f2d97c310c9c4790ba5ffa8": "reth",
    "optimism-mainnet:0x9bcef72be871e61ed4fbbc7630889bee758eb81d": "reth",
};

/** Display symbols for canonical keys shown in tax descriptions */
const CANONICAL_SYMBOL: Record<string, string> = {
    eth: "ETH",
    usdc: "USDC",
    usdt: "USDT",
    dai: "DAI",
    wbtc: "WBTC",
    matic: "MATIC",
    bnb: "BNB",
    avax: "AVAX",
    link: "LINK",
    uni: "UNI",
    aave: "AAVE",
    steth: "stETH",
    reth: "rETH",
};

/**
 * Returns the canonical FIFO lot key for a token.
 * Falls back to "chain:contractAddress" for unknown tokens.
 */
export function getCanonicalKey(chain: string, contractAddress: string): string {
    const lookup = `${chain}:${contractAddress.toLowerCase()}`;
    return CANONICAL[lookup] ?? lookup;
}

/**
 * Returns a display symbol for a canonical key.
 * For chain-specific fallback keys the caller should use the token's own symbol.
 */
export function getCanonicalSymbol(canonicalKey: string): string | undefined {
    return CANONICAL_SYMBOL[canonicalKey];
}
