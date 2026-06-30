import { CATEGORY_TREATMENTS } from "./categories";
import { getWrappedNativeAddress } from "./chains";
import { getProtocolInfo } from "./protocols";
import type { Category, Transfer, Transaction, Treatment } from "./types";
import { isZeroAddress, normalizeAddress } from "./utils";

/** Known bridge contract addresses (lowercase) */
const BRIDGE_ADDRESSES = new Set([
    // Across Protocol
    "0x3154cf16ccdb4c6d922629664174b904d80f2c35", // Across: SpokePool V1
    "0x5c7bcd6e7de5423a257d81b442095a1a6ced35c5", // Across: SpokePool V2
    "0x08b9a35f2f957f17c5f8d0ec5f52a02e440ebe6f", // Across: SpokePool V3

    // Synapse
    "0x5427fefa711eff984124bfbb1ab6fbf5e3da1820", // Synapse: Bridge
    "0x2796317b0ff8538f253012862c06787adfb8ceb6", // Synapse: Bridge V2 (BSC)
    "0x1c6ae197ff4bf7ba96c66c5fd64cb22450af9cc8", // Synapse: NerveBridge

    // Hop Protocol
    "0xd9d74a29307cc6fc8bf424ee4217f1a587fbc8dc", // Hop: Bridge (generic)
    "0xb8901acb165ed027e32754e0ffe830802919727f", // Hop: ETH Bridge
    "0x3666f603cc164936c1b87e207f36beba4ac5f18a", // Hop: USDC Bridge
    "0x914f986a44acb623a277d6bd17368171fcbe4273", // Hop: USDT Bridge
    "0x22b1cbb8d98a01a3b71d034bb899775a76eb1cc2", // Hop: MATIC Bridge

    // Stargate / LayerZero
    "0x8731d54e9d02c286767d56ac03e8037c07e01e98", // Stargate: Router
    "0x296f55f8fb28e498b858d0bcda06d955b2cb3f97", // Stargate: Bridge
    "0x45a01e4e04f14f7a4a6702c74187c5f6222033cd", // Stargate: Router (Polygon)
    "0xb0d502e938ed5f4df2e681fe6e419ff29631d62b", // Stargate: Router (BSC)

    // Wormhole / Portal
    "0x3ee18b2214aff97000d974cf647e7c347e8fa585", // Wormhole: Token Bridge (ETH)
    "0x5a58505a96d1dbf8df91cb21b54419fc36e93fde", // Wormhole: Token Bridge (Polygon)
    "0x0e082f06ff657d94310cb8ce8b0d9a04541d8052", // Wormhole: Token Bridge (Avalanche)
    "0xb6f6d86a8f9879a9c87f18830f602f0f5adc9d3a", // Wormhole: Token Bridge (BSC)
    "0x09727160600c716b26e8e4e7bae23e84d1b1474a", // Wormhole: Token Bridge (Arbitrum)

    // Celer / cBridge
    "0x1619de6b6b20ed217a58d00f37b9d47c7663feca", // cBridge: ETH
    "0x374b8a9f3ec5eb2d97eca83fd76393a28d976c6b", // cBridge: Polygon
    "0xdd90e5e87a2081dcf0391920868ebc2ffb81a1af", // cBridge: Arbitrum

    // Orbiter Finance
    "0x80c67432656d59144ceff962e8faf8926599bcf8", // Orbiter: Maker (ETH)
    "0xe4edb277e41dc89ab076a1f049f4a3efa700bce8", // Orbiter: Maker (Arbitrum / Optimism)

    // Relay.link
    "0xa5f565650890fba1824ee0f21ebbbf660a179934", // Relay: Relayer (ETH)

    // deBridge
    "0x43de2d77bf8027e25dbd179b491e8d64f38398aa", // deBridge: Gate (ETH)
    "0xc1c0472c0c80bccdc7f5d01a376bd97a734b8815", // deBridge: Gate (BSC)

    // Connext / Amarok
    "0x8898b472c54c31894e3b9bb83cea802a5d0e63c6", // Connext: Diamond (ETH)
    "0x11984dc4465481512eb5b777e44061c158cf2259", // Connext: Diamond (Polygon)
    "0xee9dec2712cce65174b561151701bf54b99c24c8", // Connext: Diamond (Arbitrum)
    "0x8f7492de823025b4cfaab1d34c58963f2af5deda", // Connext: Diamond (Optimism)

    // Optimism / Base official bridge
    "0x99c9fc46f92e8a1c0dec1b1747d010903e884be1", // Optimism: L1 Standard Bridge
    "0x4200000000000000000000000000000000000010", // Optimism: L2 Standard Bridge
    "0x49048044d57e1c92a77f2c2e27d1a0be11aeab7a", // Base: L1 Standard Bridge

    // Arbitrum official bridge
    "0x4dbd4fc535ac27206064b68ffcf827b0a60bab3f", // Arbitrum: Inbox / Gateway
    "0xa3a7b6f88361f48403514059f1f16c8e78d60eec", // Arbitrum: L1 ERC20 Gateway
    "0x096760f208390250649e3e8763348e783aef5562", // Arbitrum: L1 Custom Gateway
    "0x72ce9c846789fdb6fc1f34ac4ad25dd9ef7031ef", // Arbitrum: L1 Gateway Router
]);

/** Known lending/borrowing protocol contract addresses (lowercase) */
const LENDING_PROTOCOL_ADDRESSES = new Set([
    // Aave V2
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9", // Aave V2: LendingPool (ETH)
    "0x8dff5e27ea6b7ac08ebfdf9eb090f32ee9a30fcf", // Aave V2: LendingPool (Polygon)
    "0x794a61358d6845594f94dc1db02a252b5b4814ad", // Aave V3: Pool (Arbitrum/Optimism/Polygon)
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2", // Aave V3: Pool (ETH)
    // Compound V2
    "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b", // Compound: Comptroller
    "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5", // Compound: cETH
    "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643", // Compound: cDAI
    // MakerDAO
    "0x35d1b3f3d7966a1dfe207aa4514c12a259a0492b", // Maker: VAT (core accounting)
    "0xa950524441892a31ebddf91d3ceefa04bf454466", // Maker: Liquidations 2.0
    // Euler Finance
    "0x27182842e098f60e3d576794a5bffb0777e025d3", // Euler: Markets
    // Liquity
    "0xa39739ef8b0231dbfa0dcda07d7e29faabcf4bb2", // Liquity: TroveManager
    "0x24179cd81c9e782a4096035f7ec97fb8b783e007", // Liquity: BorrowerOperations
]);

/**
 * Classify a transaction based on its transfers.
 * @param ownedAddresses One or more wallet addresses owned by the user. In multi-wallet
 *   mode pass all of them so that transfers BETWEEN the user's own wallets bucket as SELF
 *   (a non-taxable internal move) rather than as a phantom disposal + re-acquisition.
 */
export function classifyTransaction(
    tx: Transaction,
    ownedAddresses: string | Iterable<string>
): { category: Category; transfers: Transfer[] } {
    const owned =
        typeof ownedAddresses === "string"
            ? new Set([normalizeAddress(ownedAddresses)])
            : new Set([...ownedAddresses].map(normalizeAddress));
    const transfers = tx.transfers.map((t) => ({ ...t }));

    // Bucket each transfer relative to the set of owned wallets
    for (const t of transfers) {
        const fromMe = owned.has(normalizeAddress(t.from));
        const toMe = owned.has(normalizeAddress(t.to));
        if (isZeroAddress(t.to)) {
            t.bucket = "BURNED";
        } else if (isZeroAddress(t.from)) {
            t.bucket = "MINTED";
        } else if (fromMe && toMe) {
            // Either a self-transfer or a move between two of the user's own wallets.
            t.bucket = "SELF";
        } else if (fromMe) {
            t.bucket = "SENT";
        } else if (toMe) {
            t.bucket = "RECEIVED";
        } else {
            t.bucket = "SELF"; // internal, not involving wallet directly
        }
    }

    // Filter to only transfers involving an owned wallet
    const relevant = transfers.filter(
        (t) => owned.has(normalizeAddress(t.from)) || owned.has(normalizeAddress(t.to))
    );

    const sent = relevant.filter((t) => t.bucket === "SENT" || t.bucket === "BURNED");
    const received = relevant.filter((t) => t.bucket === "RECEIVED" || t.bucket === "MINTED");

    // Failed transaction
    if (!tx.successful) {
        const category: Category = "ERROR";
        applyTreatments(transfers, category);
        return { category, transfers };
    }

    // ── Gap C: SPAM — multi-token dust airdrops (GOLD-16) ───────────────────
    // Fires before pattern table. Catches sprayed 0x0-minted tokens with no value.
    if (sent.length === 0 && received.length > 0) {
        const allMinted = received.every((t) => t.bucket === "MINTED");
        if (allMinted) {
            const totalUsd = received.reduce((sum, t) => sum + t.amount * t.rate, 0);
            if (totalUsd < 0.01 && tx.gasFeesUsd === 0) {
                const category: Category = "SPAM";
                applyTreatments(transfers, category);
                return { category, transfers };
            }
        }
    }

    // No transfers at all → just a gas fee
    if (sent.length === 0 && received.length === 0) {
        const selfTransfers = relevant.filter((t) => t.bucket === "SELF");
        if (selfTransfers.length > 0) {
            applyTreatments(transfers, "SELF");
            return { category: "SELF", transfers };
        }
        applyTreatments(transfers, "FEE");
        return { category: "FEE", transfers };
    }

    let category: Category = "UNKNOWN";

    // Check for bridge
    if (sent.length > 0) {
        const toBridge = sent.some((t) => BRIDGE_ADDRESSES.has(normalizeAddress(t.to)));
        if (toBridge) {
            category = "BRIDGE_OUT";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
    }
    if (received.length > 0 && sent.length === 0) {
        const fromBridge = received.some((t) => BRIDGE_ADDRESSES.has(normalizeAddress(t.from)));
        if (fromBridge) {
            category = "BRIDGE_IN";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
    }

    // Liquidation: collateral seized by a lending protocol
    // Pattern: at least 1 SENT to a known lending protocol, and another SENT or BURNED token
    if (sent.length >= 1) {
        const toLending = sent.some((t) => LENDING_PROTOCOL_ADDRESSES.has(normalizeAddress(t.to)));
        const hasBurnedOrMultipleSent = sent.some((t) => t.bucket === "BURNED") || sent.length >= 2;
        if (toLending && hasBurnedOrMultipleSent) {
            category = "LIQUIDATION";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
    }

    // Check for wrap/unwrap (native ↔ wrapped native)
    const wrappedNative = getWrappedNativeAddress(tx.chain);
    if (wrappedNative && sent.length === 1 && received.length === 1) {
        const s = sent[0]!;
        const r = received[0]!;
        const sAddr = normalizeAddress(s.token.contractAddress);
        const rAddr = normalizeAddress(r.token.contractAddress);
        const wAddr = normalizeAddress(wrappedNative);
        const nativeAddr = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
        if ((sAddr === nativeAddr && rAddr === wAddr) || (sAddr === wAddr && rAddr === nativeAddr)) {
            category = sAddr === nativeAddr ? "WRAP" : "UNWRAP";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
    }

    // ── Gap A: BORROW / REPAY (lending protocol by counterparty hint) ────────
    // LIQUIDATION (above) fires when toLending + burned/multiple-sent.
    // Here we catch normal borrow/repay where the wallet directly calls a pool.
    const counterpartyProtocol = getProtocolInfo(tx.chain, normalizeAddress(tx.counterparty));
    if (counterpartyProtocol?.hint === "LENDING") {
        // Distinguish borrow from repay:
        // - If wallet received non-minted (real) tokens from the pool → BORROW (got borrowed funds)
        // - Otherwise (only sent, or only received MINTED receipt tokens like aTokens) → REPAY
        const hasRealReceive = received.some((t) => t.bucket === "RECEIVED");
        if (hasRealReceive) {
            category = "BORROW";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
        if (sent.length >= 1 || received.length >= 1) {
            // sent tokens to pool, or only received MINTED (receipt tokens like aTokens)
            category = "REPAY";
            applyTreatments(transfers, category);
            return { category, transfers };
        }
    }

    // Pattern matching by (sent count, received count)
    if (sent.length === 0 && received.length === 1) {
        // Received something, sent nothing → income, spam, or peer transfer
        const r = received[0]!;
        if (isZeroAddress(r.from)) {
            category = "INCOME"; // minted to wallet (staking reward, etc)
        } else if (r.amount * r.rate < 1) {
            category = "SPAM";
        } else {
            // Non-zero sender, meaningful value → peer transfer.
            // User can override to AIRDROP if they know it was one.
            category = "TRANSFER_IN";
        }
    } else if (sent.length === 0 && received.length > 1) {
        // Multiple receives, no sends → airdrop/claim
        category = "AIRDROP";
    } else if (sent.length === 1 && received.length === 0) {
        // Stake/deposit with no receipt token → STAKE; otherwise plain send
        if (counterpartyProtocol?.hint === "STAKING" || counterpartyProtocol?.hint === "YIELD") {
            category = "STAKE";
        } else {
            category = "TRANSFER_OUT";
        }
    } else if (sent.length === 1 && received.length === 1) {
        const s = sent[0]!;
        const r = received[0]!;
        if (s.token.symbol === r.token.symbol) {
            category = "SELF";
        } else if (counterpartyProtocol?.hint === "STAKING") {
            // Sent one token, received staking receipt (e.g. ETH → rETH, MATIC → stMATIC)
            category = "STAKE";
        } else {
            category = "SWAP";
        }
    } else if (sent.length === 2 && received.length === 1) {
        category = "ADD_LIQUIDITY";
        // Compute LP token cost basis = sum of sent token FMVs
        const lpTransfer = received[0]!;
        const sentFMV = sent.reduce((sum, t) => sum + t.amount * t.rate, 0);
        if (lpTransfer.amount > 0 && sentFMV > 0) {
            const lpIdx = transfers.findIndex(
                (t) =>
                    (t.token.contractAddress === lpTransfer.token.contractAddress || t === lpTransfer) &&
                    t.bucket === "RECEIVED"
            );
            if (lpIdx !== -1) {
                transfers[lpIdx]!.rate = sentFMV / lpTransfer.amount;
            }
        }
    } else if (sent.length === 1 && received.length === 2) {
        category = "REMOVE_LIQUIDITY";
    } else if (sent.length >= 1 && received.length >= 1) {
        // Gap B: COMPOUND if interacting with staking/yield protocol, else SWAP
        if (counterpartyProtocol?.hint === "STAKING" || counterpartyProtocol?.hint === "YIELD") {
            category = "COMPOUND";
        } else {
            category = "SWAP";
        }
    } else {
        category = "UNKNOWN";
    }

    applyTreatments(transfers, category);
    return { category, transfers };
}

export function applyTreatments(transfers: Transfer[], category: Category): void {
    const treatments = CATEGORY_TREATMENTS[category];
    for (const t of transfers) {
        if (t.bucket === "SENT" || t.bucket === "BURNED") {
            t.treatment = treatments.sent;
        } else if (t.bucket === "RECEIVED" || t.bucket === "MINTED") {
            t.treatment = treatments.received;
        } else {
            t.treatment = "ignore" satisfies Treatment;
        }
    }
}
