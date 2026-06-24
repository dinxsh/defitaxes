/** Known stablecoin addresses per chain (lowercase). */
const STABLECOINS: Record<string, Set<string>> = {
    "eth-mainnet": new Set([
        "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", // USDC
        "0xdac17f958d2ee523a2206206994597c13d831ec7", // USDT
        "0x6b175474e89094c44da98b954eedeac495271d0f", // DAI
        "0x4fabb145d64652a948d72533023f6e7a623c7c53", // BUSD
        "0x0000000000085d4780b73119b644ae5ecd22b376", // TUSD
        "0x853d955acef822db058eb8505911ed77f175b99e", // FRAX
        "0x8e870d67f660d95d5be530380d0ec0bd388289e1", // USDP
        "0x5f98805a4e8be255a32880fdec7f6728c6568ba0", // LUSD
    ]),
    "matic-mainnet": new Set([
        "0x2791bca1f2de4661ed88a30c99a7a9449aa84174", // USDC.e
        "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", // USDC native
        "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", // USDT
        "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063", // DAI
    ]),
    "bsc-mainnet": new Set([
        "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
        "0x55d398326f99059ff775485246999027b3197955", // USDT
        "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3", // DAI
        "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
    ]),
    "optimism-mainnet": new Set([
        "0x0b2c639c533813f4aa9d7837caf62653d097ff85", // USDC native
        "0x7f5c764cbc14f9669b88837ca1490cca17c31607", // USDC.e
        "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58", // USDT
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    ]),
    "base-mainnet": new Set([
        "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // USDC
        "0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca", // USDbC
        "0x50c5725949a6f0c72e6c4a641f24049a917db0cb", // DAI
    ]),
    "arbitrum-mainnet": new Set([
        "0xaf88d065e77c8cc2239327c5edb3a432268e5831", // USDC native
        "0xff970a61a04b1ca14834a43f5de4533ebddb5cc8", // USDC.e
        "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9", // USDT
        "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1", // DAI
    ]),
    "avalanche-mainnet": new Set([
        "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e", // USDC
        "0xa7d7079b0fead91f3e65f86e8915cb59c1a4c664", // USDC.e
        "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7", // USDT
        "0xd586e7f844cea2f87f50152665bcbc2c279d8d70", // DAI.e
    ]),
    "gnosis-mainnet": new Set([
        "0xddafbb505ad214d7b80b1f830fccc89b60fb7a83", // USDC
        "0x4ecaba5870353805a9f068101a40e0f32ed605c6", // USDT
        "0xe91d153e0b41518a2ce8dd3d7944fa863463a97d", // WXDAI (wrapped xDAI ≈ DAI)
        "0x44fa8e6f47987339850636f88629646662444217", // DAI from bridge
    ]),
    "fantom-mainnet": new Set([
        "0x04068da6c83afcfa0e13ba15a6696662335d5b75", // USDC
        "0x049d68029688eabf473097a2fc38ef61633a3c7a", // fUSDT
        "0x8d11ec38a3eb5e956b052f67da8bdc9bef8abf3e", // DAI
        "0x3129662808bec728a27ab6a6b9afd3cbaca8a43c", // BUSD
    ]),
    "linea-mainnet": new Set([
        "0x176211869ca2b568f2a7d4ee941e073a821ee1ff", // USDC
        "0xa219439258ca9da29e9cc4ce5596924745e12b93", // USDT
        "0x4af15ec2a0bd43db75dd04e62faa3b8ef36b00d5", // DAI
    ]),
    "scroll-mainnet": new Set([
        "0x06efdbff2a14a7c8e15944d1f4a48f9f95f663a4", // USDC
        "0xf55bec9cafdbe8730f096aa55dad6d22d44099df", // USDT
        "0xcA77eB3fEFe3725Dc33bccB54eDEFc3D9f764f97", // DAI
    ]),
    "zksync-mainnet": new Set([
        "0x3355df6d4c9c3035724fd0e3914de96a5a83aaf4", // USDC
        "0x493257fd37edb34451f62edf8d2a0c418852ba4c", // USDT
        "0x4b9eb6c84d0a734ca39dce1a7a3f2a9c97c84edc", // DAI
    ]),
};

/** Dynamically discovered stablecoins from balances_v2 type === "stablecoin" */
const _DYNAMIC: Map<string, Set<string>> = new Map();

/** Register stablecoin addresses discovered at runtime (e.g. from balances_v2). */
export function registerDynamicStablecoins(chain: string, addresses: Set<string>): void {
    const existing = _DYNAMIC.get(chain);
    if (!existing) {
        _DYNAMIC.set(chain, new Set(addresses));
    } else {
        for (const addr of addresses) existing.add(addr);
    }
}

export function isStablecoin(chain: string, contractAddress: string): boolean {
    const addr = contractAddress.toLowerCase();
    const staticSet = STABLECOINS[chain];
    if (staticSet?.has(addr)) return true;
    return _DYNAMIC.get(chain)?.has(addr) ?? false;
}
