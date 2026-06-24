/**
 * Static registry of well-known DeFi protocol contract addresses.
 *
 * Keys are lowercase addresses. `hint` is an optional category override
 * for the transaction classifier when GoldRush doesn't provide a label.
 * Entries without a chain key apply to every EVM chain.
 */
export interface ProtocolInfo {
    name: string;
    hint?: "DEX" | "LENDING" | "STAKING" | "BRIDGE" | "NFT" | "YIELD" | "DERIVATIVES" | "GOVERNANCE";
}

/** Chain-specific overrides: Record<chainName, Record<address, ProtocolInfo>> */
const CHAIN_PROTOCOLS: Record<string, Record<string, ProtocolInfo>> = {
    "eth-mainnet": {
        // Uniswap
        "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": { name: "Uniswap V2: Router", hint: "DEX" },
        "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f": { name: "Uniswap V2: Factory", hint: "DEX" },
        "0xe592427a0aece92de3edee1f18e0157c05861564": { name: "Uniswap V3: Router", hint: "DEX" },
        "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": { name: "Uniswap V3: Router 2", hint: "DEX" },
        "0x1f98431c8ad98523631ae4a59f267346ea31f984": { name: "Uniswap V3: Factory", hint: "DEX" },
        "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": { name: "Uniswap: Universal Router", hint: "DEX" },
        "0x000000000022d473030f116ddee9f6b43ac78ba3": { name: "Uniswap: Permit2", hint: "DEX" },
        // SushiSwap
        "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": { name: "SushiSwap: Router", hint: "DEX" },
        "0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac": { name: "SushiSwap: Factory", hint: "DEX" },
        // Curve
        "0x99a58482bd75cbab83b27ec03ca68ff489b5788f": { name: "Curve: Router", hint: "DEX" },
        "0xd51a44d3fae010294c616388b506acda1bfaae46": { name: "Curve: TriCrypto Pool", hint: "DEX" },
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7": { name: "Curve: 3Pool", hint: "DEX" },
        "0xa5407eae9ba41422680e2e00537571bcc53efbfd": { name: "Curve: sUSD Pool", hint: "DEX" },
        // Balancer
        "0xba12222222228d8ba445958a75a0704d566bf2c8": { name: "Balancer: Vault", hint: "DEX" },
        // 1inch
        "0x1111111254fb6c44bac0bed2854e76f90643097d": { name: "1inch: Aggregation Router V4", hint: "DEX" },
        "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch: Aggregation Router V5", hint: "DEX" },
        "0x111111125421ca6dc452d289314280a0f8842a65": { name: "1inch: Aggregation Router V6", hint: "DEX" },
        // Aave
        "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": { name: "Aave V2: Pool", hint: "LENDING" },
        "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": { name: "Aave V3: Pool", hint: "LENDING" },
        "0x398ec7346dcd622edc5ae82352f02be94c62d119": { name: "Aave V1: Pool", hint: "LENDING" },
        // Compound
        "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b": { name: "Compound V2: Comptroller", hint: "LENDING" },
        "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5": { name: "Compound V2: cETH", hint: "LENDING" },
        "0xc3d688b66703497daa19211eedff47f25384cdc3": { name: "Compound V3: USDC Market", hint: "LENDING" },
        // Lido
        "0xae7ab96520de3a18e5e111b5eaab095312d7fe84": { name: "Lido: stETH", hint: "STAKING" },
        "0x889edc2edab5f40e902b864ad4d7ade8e412f9b1": { name: "Lido: Withdrawal Queue", hint: "STAKING" },
        // Rocket Pool
        "0xdd3f50f8a6cafbe9b31a427582963f465e745af8": { name: "Rocket Pool: Deposit", hint: "STAKING" },
        // MakerDAO / Sky
        "0x9759a6ac90977b93b58547b4a71c78317f391a28": { name: "MakerDAO: DaiJoin", hint: "LENDING" },
        "0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b": { name: "MakerDAO: VAT", hint: "LENDING" },
        "0x83f20f44975d03b1b09e64809b757c47f942beea": { name: "Sky: sDAI (Savings DAI)", hint: "YIELD" },
        // Yearn
        "0x50c1a2ea0a861a967d9d0ffe2ae4012c2e053804": { name: "Yearn: Registry V2", hint: "YIELD" },
        "0x9d409a0a012cfba9b15f6d4b36ac57a46966ab9a": { name: "Yearn: Registry V3", hint: "YIELD" },
        // Convex
        "0xf403c135812408bfbe8713b5a23a04b3d48aae31": { name: "Convex: Booster", hint: "YIELD" },
        "0xcf50b810e57ac33b91dcf525c6ddd9881b139332": { name: "Convex: CvxCrvStakingWrapper", hint: "YIELD" },
        // OpenSea
        "0x00000000006c3852cbef3e08e8df289169ede581": { name: "OpenSea: Seaport 1.1", hint: "NFT" },
        "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": { name: "OpenSea: Seaport 1.5", hint: "NFT" },
        "0x0000000000000068f116a894984e2db1123eb395": { name: "OpenSea: Seaport 1.6", hint: "NFT" },
        // ENS
        "0x253553366da8546fc250f225fe3d25d0c782303b": { name: "ENS: ETH Registrar Controller", hint: "GOVERNANCE" },
        "0x57f1887a8bf19b14fc0df6fd9b2acc9af147ea85": { name: "ENS: BaseRegistrar", hint: "GOVERNANCE" },
        // Chainlink
        "0x514910771af9ca656af840dff83e8264ecf986ca": { name: "Chainlink: LINK Token", hint: "GOVERNANCE" },
    },
};

/** Cross-chain addresses (same address on multiple EVM chains) */
const UNIVERSAL_PROTOCOLS: Record<string, ProtocolInfo> = {
    // Uniswap V3 (CREATE2 deterministic — same address on all chains)
    "0x1f98431c8ad98523631ae4a59f267346ea31f984": { name: "Uniswap V3: Factory", hint: "DEX" },
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": { name: "Uniswap V3: Router 2", hint: "DEX" },
    "0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad": { name: "Uniswap: Universal Router", hint: "DEX" },
    "0x000000000022d473030f116ddee9f6b43ac78ba3": { name: "Uniswap: Permit2", hint: "DEX" },
    // Uniswap V2 Factory (same address on mainnet-equivalent chains via CREATE2)
    "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f": { name: "Uniswap V2: Factory", hint: "DEX" },
    // SushiSwap V2 Factory (same address on most EVM chains)
    "0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac": { name: "SushiSwap: Factory", hint: "DEX" },
    // Curve Finance Factory
    "0x0959158b6040d32d04c301a72cbfd6b39e21c9ae": { name: "Curve: Factory", hint: "DEX" },
    // Balancer V2 Vault (same address on Ethereum, Polygon, Arbitrum, Optimism)
    "0xba12222222228d8ba445958a75a0704d566bf2c8": { name: "Balancer: Vault", hint: "DEX" },
    // 1inch
    "0x1111111254eeb25477b68fb85ed929f73a960582": { name: "1inch: Aggregation Router V5", hint: "DEX" },
    "0x111111125421ca6dc452d289314280a0f8842a65": { name: "1inch: Aggregation Router V6", hint: "DEX" },
    // Aave V3 (same address on Polygon, Arbitrum, Optimism, Base, etc.)
    "0x794a61358d6845594f94dc1db02a252b5b4814ad": { name: "Aave V3: Pool", hint: "LENDING" },
    "0xa97684ead0e402dc232d5a977953df7ecbab3cdb": { name: "Aave V3: PoolAddressesProvider", hint: "LENDING" },
    // Gnosis Safe (Multisig)
    "0x40a2accbd92bca938b02010e17a5b8929b49130d": { name: "Safe: Multisend", hint: "GOVERNANCE" },
    "0xa238cbeb142c10ef7ad8442c6d1f9e89e07e7761": { name: "Safe: Multisend (call only)", hint: "GOVERNANCE" },
    // OpenSea Seaport
    "0x00000000000000adc04c56bf30ac9d3c0aaf14dc": { name: "OpenSea: Seaport 1.5", hint: "NFT" },
    // Across Bridge
    "0x3154cf16ccdb4c6d922629664174b904d80f2c35": { name: "Across: Bridge", hint: "BRIDGE" },
    "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5": { name: "Across: Bridge V2", hint: "BRIDGE" },
    // Synapse Bridge
    "0x5427fefa711eff984124bfbb1ab6fbf5e3da1820": { name: "Synapse: Bridge", hint: "BRIDGE" },
    // Hop Protocol
    "0xd9d74a29307cc6fc8bf424ee4217f1a587fbc8dc": { name: "Hop: Bridge", hint: "BRIDGE" },
    // Wormhole
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585": { name: "Wormhole: Token Bridge", hint: "BRIDGE" },
    // Stargate / LayerZero
    "0x8731d54e9d02c286767d56ac03e8037c07e01e98": { name: "Stargate: Router", hint: "BRIDGE" },

    // Compound V3 (Comet) — same deployer, same address on multiple chains
    "0xc3d688b66703497daa19211eedff47f25384cdc3": { name: "Compound V3: USDC Market (ETH)", hint: "LENDING" },
    "0x9c4ec768c28520b50860ea7a15bd7213a9ff58bf": { name: "Compound V3: USDC Market (Base)", hint: "LENDING" },
    "0xa17581a9e3a5c817a232f53c2f6611d5741b8e76": { name: "Compound V3: ETH Market (Base)", hint: "LENDING" },
    "0x6f7d514bbd4aff3bcd1140b7344b32f063dee486": { name: "Compound V3: USDC Market (Arbitrum)", hint: "LENDING" },
    "0xd98be00b5d27fc98112bde293e487f8d4ca57d07": { name: "Compound V3: USDT Market (Arbitrum)", hint: "LENDING" },
    "0xe2c67a9b15e9e7ff8a9cb0dfb8fee5609923e5db": { name: "Compound V3: USDC Market (Polygon)", hint: "LENDING" },
    "0xf25212e676d1f7f89cd72ffee66158f541246445": { name: "Compound V3: USDC Market (Optimism)", hint: "LENDING" },

    // Lido — chain-specific staking derivatives
    "0x1f32b1c2345538c0c6f582fcb022739c4a194ebb": { name: "Lido: wstETH (Optimism)", hint: "STAKING" },
    "0x5979d7b546e38e414f7e9822514be443a4800529": { name: "Lido: wstETH (Arbitrum)", hint: "STAKING" },
    "0x03b54a6e9a984069379fae1a4fc4dbae93b3bccd": { name: "Lido: wstETH (Base)", hint: "STAKING" },
    "0x9ee91f9f426fa633d227f7a9b000e28b9dfd8599": { name: "Lido: stMATIC (Polygon)", hint: "STAKING" },

    // Rocket Pool
    "0xae78736cd615f374d3085123a210448e74fc6393": { name: "Rocket Pool: rETH", hint: "STAKING" },

    // Frax Finance staking
    "0xac3e018457b222d93114458476f3e3416abbe38f": { name: "Frax: sfrxETH", hint: "STAKING" },
    "0xbafa44efe7901e04e39dad13167d089c559c1138": { name: "Frax: frxETHMinter", hint: "STAKING" },

    // Yearn V3 (same address via CREATE2 on multiple chains)
    "0x1ab62413e0cf2626ebf5b2cf38813e4f5e1a8e1c": { name: "Yearn V3: Registry", hint: "YIELD" },

    // Velodrome V2 (Optimism)
    "0xa062ae8a9c5e11aaa026fc2670b0d65ccc8b2858": { name: "Velodrome V2: Router", hint: "DEX" },
    "0xf1046053aa5682b4f9a81b5481394da16be5ff5a": { name: "Velodrome V2: Factory", hint: "DEX" },

    // Aerodrome (Base)
    "0xcf77a3ba9a5ca399b7c97c74d54e5b1beb874e43": { name: "Aerodrome: Router", hint: "DEX" },
    "0x420dd381b31aef6683db6b902084cb0ffece40da": { name: "Aerodrome: Factory", hint: "DEX" },

    // GMX V2 (Arbitrum / Avalanche — same address)
    "0x7452c558d45f8afc8c83dae62c3f8a5be19c71f6": { name: "GMX V2: Exchange Router", hint: "DEX" },
    "0x9c7305eb78a432ced5c4d14cac27e8ed569a2e26": { name: "GMX V2: Deposit Vault", hint: "YIELD" },

    // Pendle Finance (Arbitrum / ETH — same address)
    "0x888888888889758f76e7103c6cbf23abbf58f946": { name: "Pendle: Router V3", hint: "YIELD" },
    "0x0000000001e4ef00d069e71d6ba041b0a16f7ea0": { name: "Pendle: Router V4", hint: "YIELD" },

    // Radiant Capital (Arbitrum)
    "0x2032b9a8e9f7e76768ca9271003d3e43e1616b1f": { name: "Radiant: LendingPool (Arbitrum)", hint: "LENDING" },

    // Morpho (ETH / Base)
    "0xbbbbbbbbbb9cc5e90e3b3af64bdaf62c37eeffcb": { name: "Morpho: Blue", hint: "LENDING" },
    "0x9eecd9b3f7e61ea28e2d3e71a9696049b75ef6ea": { name: "Morpho: Optimizer (ETH)", hint: "LENDING" },

    // Curve Finance cross-chain pools
    "0xd51a44d3fae010294c616388b506acda1bfaae46": { name: "Curve: TriCrypto2", hint: "DEX" },
    "0x7f90122bf0700f9e7e1f688fe926940e8839f353": { name: "Curve: 2Pool (Arbitrum)", hint: "DEX" },
    "0x960ea3e3c7fb317332d990873d354e18d7645590": { name: "Curve: TriCrypto (Arbitrum)", hint: "DEX" },

    // SushiSwap V3 Router (same address across chains)
    "0x2c9d2e2764c7fa4e5e46d7d4e09d4eb64a2b3049": { name: "SushiSwap V3: Router", hint: "DEX" },

    // ParaSwap
    "0xdef171fe48cf0115b1d80b88dc8eab59176fee57": { name: "ParaSwap: Augustus V5", hint: "DEX" },
    "0x6a000f20005980200259b80c5102003040001068": { name: "ParaSwap: Augustus V6", hint: "DEX" },
};

/**
 * Look up a protocol by chain + address.
 * Returns undefined when the address is unknown.
 */
export function getProtocolInfo(chain: string, address: string): ProtocolInfo | undefined {
    const addr = address.toLowerCase();
    return CHAIN_PROTOCOLS[chain]?.[addr] ?? UNIVERSAL_PROTOCOLS[addr];
}

/**
 * Returns the human-readable label for a known protocol address,
 * or undefined when the address is unknown.
 */
export function getProtocolLabel(chain: string, address: string): string | undefined {
    return getProtocolInfo(chain, address)?.name;
}
