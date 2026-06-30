import { CHAINS, getDisplayName, getWrappedNativeAddress } from "../lib/chains";
import { applyTreatments, classifyTransaction } from "../lib/classifier";
import { getProtocolLabel } from "../lib/protocols";
import { registerDynamicStablecoins } from "../lib/stablecoins";
import type { ProcessingState, Transaction, Transfer, Token } from "../lib/types";
import { isZeroAddress, normalizeAddress, dateToKey } from "../lib/utils";
import type { GoldRushClient } from "@covalenthq/client-sdk";
import { useCallback, useRef, useState } from "react";

const NATIVE_TOKEN_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
const PAGE_SIZE = 100;

interface UseProcessingResult {
    state: ProcessingState;
    transactions: Transaction[];
    start: (wallets: string[], quoteCurrency?: string) => void;
    reset: () => void;
    patchTransferRate: (txHash: string, chain: string, transferIndex: number, rate: number) => void;
}

const INITIAL_STATE: ProcessingState = {
    step: "idle",
    progress: "",
    chainsFound: 0,
    txFetched: 0,
    txTotal: 0,
    errors: [],
    lastErrors: [],
};

export function useProcessing(client: GoldRushClient): UseProcessingResult {
    const [state, setState] = useState<ProcessingState>(INITIAL_STATE);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const abortRef = useRef<AbortController | null>(null);

    const updateState = (patch: Partial<ProcessingState>) => {
        setState((prev) => ({ ...prev, ...patch }));
    };

    const start = useCallback(
        async (wallets: string[], quoteCurrency = "USD") => {
            abortRef.current?.abort();
            const abort = new AbortController();
            abortRef.current = abort;

            setTransactions([]);
            setState({ ...INITIAL_STATE, step: "discovering", progress: "Discovering active chains..." });

            try {
                const allRawTx: Transaction[] = [];
                // Dedup key (chain:hash): a transaction that moves value between two of the
                // user's own wallets is returned by BOTH wallets' fetches. Without dedup it
                // would be ingested twice — double-counting gas and producing a phantom
                // disposal/acquisition pair. Keep the first occurrence.
                const seenTxKeys = new Set<string>();
                // All wallet addresses the user owns, lowercased — used so inter-wallet
                // transfers classify as SELF (non-taxable) rather than sell + buy.
                const ownedAddresses = new Set(wallets.map((w) => w.trim().toLowerCase()));
                let totalFetched = 0;
                const allActiveChainSet = new Set<string>();
                // spam contract addresses per chain, populated from balances_v2 is_spam field
                const spamTokensByChain = new Map<string, Set<string>>();

                for (const wallet of wallets) {
                    if (abort.signal.aborted) return;

                    const activityResp = await client.BaseService.getAddressActivity(wallet.trim() as `0x${string}`);
                    if (abort.signal.aborted) return;

                    if (activityResp.error) {
                        const errMsg = activityResp.error_message ?? "Failed to fetch activity";
                        setState((prev) => ({
                            ...prev,
                            errors: [...prev.errors, errMsg],
                            lastErrors: [errMsg],
                        }));
                        continue;
                    }

                    const activeChains = (activityResp.data?.items ?? [])
                        .filter((item) => {
                            const name = item.name ?? "";
                            return name in CHAINS;
                        })
                        .map((item) => item.name!);

                    activeChains.forEach((c) => allActiveChainSet.add(c));

                    updateState({
                        step: "fetching",
                        chainsFound: allActiveChainSet.size,
                        progress: `${wallet.slice(0, 8)}…: Found ${activeChains.length} chain(s). Fetching...`,
                    });

                    // Pre-fetch spam + stablecoin lists from balances_v2 in parallel (non-critical — errors silently ignored)
                    await Promise.all(
                        activeChains.map(async (chainName) => {
                            if (abort.signal.aborted) return;
                            try {
                                const balResp = await client.BalanceService.getTokenBalancesForWalletAddress(
                                    chainName as Parameters<
                                        typeof client.BalanceService.getTokenBalancesForWalletAddress
                                    >[0],
                                    wallet.trim() as `0x${string}`
                                );
                                if (balResp.error || !balResp.data?.items) return;
                                const spamSet = spamTokensByChain.get(chainName) ?? new Set<string>();
                                const stableSet = new Set<string>();
                                for (const item of balResp.data.items) {
                                    if (!item?.contract_address) continue;
                                    const addr = normalizeAddress(item.contract_address);
                                    if (item.is_spam) spamSet.add(addr);
                                    // Gap #4: collect GoldRush-classified stablecoins for cross-chain canonical keys
                                    if ((item as { type?: string }).type === "stablecoin") stableSet.add(addr);
                                }
                                spamTokensByChain.set(chainName, spamSet);
                                if (stableSet.size > 0) registerDynamicStablecoins(chainName, stableSet);
                            } catch {
                                // non-critical — spam/stablecoin detection degrades gracefully
                            }
                        })
                    );

                    for (const chainName of activeChains) {
                        if (abort.signal.aborted) return;

                        let page = 0;
                        let hasMore = true;

                        while (hasMore) {
                            if (abort.signal.aborted) return;

                            updateState({
                                progress: `${wallet.slice(0, 8)}…: Fetching ${getDisplayName(chainName)} page ${page + 1}...`,
                                txFetched: totalFetched,
                            });

                            const txResp = await client.TransactionService.getAllTransactionsForAddressByPage(
                                chainName as Parameters<
                                    typeof client.TransactionService.getAllTransactionsForAddressByPage
                                >[0],
                                wallet.trim() as `0x${string}`,
                                // Gap #8: pass quoteCurrency so gas_quote is returned in the
                                // user's chosen fiat (EUR/GBP/etc.) rather than always USD.
                                // page-number / page-size are accepted by the underlying API but
                                // absent from the SDK TypeScript types; `as` bypasses the excess
                                // property check while preserving runtime behaviour.
                                {
                                    quoteCurrency: quoteCurrency as Parameters<
                                        typeof client.PricingService.getTokenPrices
                                    >[1],
                                    noLogs: false,
                                    withInternal: true,
                                    "page-number": page,
                                    "page-size": PAGE_SIZE,
                                } as Parameters<typeof client.TransactionService.getAllTransactionsForAddressByPage>[2]
                            );

                            if (txResp.error) {
                                setState((prev) => ({
                                    ...prev,
                                    errors: [...prev.errors, `${chainName}: ${txResp.error_message ?? "fetch error"}`],
                                }));
                                break;
                            }

                            const items = txResp.data?.items ?? [];
                            if (items.length === 0) {
                                hasMore = false;
                                break;
                            }

                            for (const item of items) {
                                const tx = parseTransaction(item, chainName, wallet);
                                if (tx) {
                                    const txKey = `${chainName}:${tx.hash}`;
                                    if (seenTxKeys.has(txKey)) continue;
                                    seenTxKeys.add(txKey);
                                    tx.walletAddress = wallet.toLowerCase();
                                    allRawTx.push(tx);
                                }
                            }

                            totalFetched += items.length;
                            hasMore = items.length >= PAGE_SIZE;
                            page++;
                        }
                    }
                }

                if (allActiveChainSet.size === 0) {
                    const errMsg = "No EVM chain activity found for any of the provided addresses";
                    updateState({ step: "idle", errors: [errMsg], lastErrors: [errMsg] });
                    return;
                }

                if (abort.signal.aborted) return;
                updateState({
                    step: "pricing",
                    txFetched: totalFetched,
                    progress: `Fetched ${totalFetched} transactions. Resolving prices...`,
                });

                // Step 3: Fetch prices for tokens missing rates
                await resolvePrices(client, allRawTx, quoteCurrency, abort.signal, (msg) =>
                    updateState({ progress: msg })
                );
                if (abort.signal.aborted) return;

                // Step 4: Classify
                updateState({ step: "classifying", progress: "Classifying transactions..." });
                for (const tx of allRawTx) {
                    // Pass the full owned-address set so transfers between the user's own
                    // wallets are treated as non-taxable SELF moves.
                    const result = classifyTransaction(tx, ownedAddresses);
                    let category = result.category;
                    const classifiedTransfers = result.transfers;

                    // Spam override: if any received token is flagged is_spam in balances_v2
                    if (category !== "SPAM") {
                        const chainSpam = spamTokensByChain.get(tx.chain);
                        if (chainSpam?.size) {
                            const hasSent = classifiedTransfers.some(
                                (t) => t.bucket === "SENT" || t.bucket === "BURNED"
                            );
                            const hasSpamToken = classifiedTransfers.some(
                                (t) =>
                                    (t.bucket === "RECEIVED" || t.bucket === "MINTED") &&
                                    chainSpam.has(normalizeAddress(t.token.contractAddress))
                            );
                            if (!hasSent && hasSpamToken) {
                                category = "SPAM";
                                applyTreatments(classifiedTransfers, "SPAM");
                            }
                        }
                    }

                    tx.category = category;
                    tx.transfers = classifiedTransfers;
                }

                // Step 5: Sort and finalize
                allRawTx.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

                updateState({ step: "calculating", progress: "Calculating tax events..." });

                // Step 6: Done
                setTransactions(allRawTx);
                updateState({
                    step: "done",
                    progress: `Processed ${allRawTx.length} transactions across ${allActiveChainSet.size} chain(s).`,
                });
            } catch (err) {
                if (!abort.signal.aborted) {
                    const msg = err instanceof Error ? err.message : String(err);
                    updateState({ step: "idle", errors: [msg], lastErrors: [msg] });
                }
            }
        },
        [client]
    );

    const reset = useCallback(() => {
        abortRef.current?.abort();
        setTransactions([]);
        setState(INITIAL_STATE);
    }, []);

    const patchTransferRate = useCallback((txHash: string, chain: string, transferIndex: number, rate: number) => {
        setTransactions((prev) =>
            prev.map((tx) => {
                if (tx.hash !== txHash || tx.chain !== chain) return tx;
                const updated = tx.transfers.map((t, i) => (i === transferIndex ? { ...t, rate } : t));
                return { ...tx, transfers: updated };
            })
        );
    }, []);

    return { state, transactions, start, reset, patchTransferRate };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseTransaction(item: any, chainName: string, wallet: string): Transaction | null {
    const hash = item.tx_hash as string;
    const timestamp = new Date(item.block_signed_at as string);
    const successful = item.successful as boolean;
    const gasQuote = (item.gas_quote as number) ?? 0;
    const gasSpent = (item.gas_spent as number) ?? 0;
    const gasPrice = (item.gas_price as number) ?? 0;
    const toAddress = (item.to_address as string) ?? "";
    const goldrushLabel = (item.to_address_label as string) ?? null;
    let counterpartyLabel: string | null =
        goldrushLabel ?? (toAddress ? (getProtocolLabel(chainName, toAddress) ?? null) : null);
    const value = BigInt(item.value ?? "0");
    const methodId = (item.input_data as { method_id?: string } | null)?.method_id ?? "";

    const transfers: Transfer[] = [];
    const walletLower = normalizeAddress(wallet);
    const chainConfig = CHAINS[chainName];

    // Native value transfer
    if (value > 0n && chainConfig) {
        const nativeToken: Token = {
            contractAddress: NATIVE_TOKEN_ADDRESS,
            symbol: chainConfig.nativeSymbol,
            decimals: 18,
            name: chainConfig.nativeSymbol,
        };
        const amount = Number(value) / 1e18;
        const from = normalizeAddress(item.from_address as string);
        const to = normalizeAddress(toAddress);

        transfers.push({
            from,
            to,
            amount,
            token: nativeToken,
            rate: 0, // will be resolved in pricing step
            treatment: "ignore",
            bucket: from === walletLower ? "SENT" : "RECEIVED",
        });
    }

    // ERC20 transfers from decoded log events
    const logEvents = (item.log_events as Array<Record<string, unknown>>) ?? [];
    for (const log of logEvents) {
        const decoded = log.decoded as { name?: string; params?: Array<{ name: string; value: string }> } | null;
        if (!decoded) continue;

        if (decoded.name === "Transfer") {
            const params = decoded.params ?? [];
            const fromParam = params.find((p) => p.name === "from")?.value;
            const toParam = params.find((p) => p.name === "to")?.value;
            const valueParam = params.find((p) => p.name === "value")?.value;
            const tokenIdParam = params.find((p) => p.name === "tokenId")?.value;

            if (!fromParam || !toParam) continue;

            const from = normalizeAddress(fromParam);
            const to = normalizeAddress(toParam);
            if (from !== walletLower && to !== walletLower) continue;

            let bucket: Transfer["bucket"] = "SELF";
            if (isZeroAddress(toParam)) bucket = "BURNED";
            else if (isZeroAddress(fromParam)) bucket = "MINTED";
            else if (from === walletLower && to !== walletLower) bucket = "SENT";
            else if (to === walletLower && from !== walletLower) bucket = "RECEIVED";

            if (tokenIdParam && !valueParam) {
                // ERC-721: Transfer(from, to, tokenId) — no fungible value
                const token: Token = {
                    contractAddress: normalizeAddress((log.sender_address as string) ?? ""),
                    symbol: (log.sender_contract_ticker_symbol as string) ?? "NFT",
                    decimals: 0,
                    name: (log.sender_name as string) ?? "Unknown NFT",
                    tokenId: tokenIdParam,
                };
                transfers.push({ from, to, amount: 1, token, rate: 0, treatment: "ignore", bucket });
            } else {
                // ERC-20: Transfer(from, to, value)
                if (!valueParam) continue;
                const decimals = (log.sender_contract_decimals as number) ?? 18;
                const rawAmount = BigInt(valueParam);
                const amount = Number(rawAmount) / Math.pow(10, decimals);
                if (amount === 0) continue;

                const token: Token = {
                    contractAddress: normalizeAddress((log.sender_address as string) ?? ""),
                    symbol: (log.sender_contract_ticker_symbol as string) ?? "???",
                    decimals,
                    name: (log.sender_name as string) ?? "Unknown",
                };
                transfers.push({ from, to, amount, token, rate: 0, treatment: "ignore", bucket });
            }
        } else if (decoded.name === "TransferSingle") {
            // ERC-1155: TransferSingle(operator, from, to, id, value)
            const params = decoded.params ?? [];
            const fromParam = params.find((p) => p.name === "from")?.value;
            const toParam = params.find((p) => p.name === "to")?.value;
            const idParam = params.find((p) => p.name === "id")?.value;
            const valueParam = params.find((p) => p.name === "value")?.value;

            if (!fromParam || !toParam || !idParam || !valueParam) continue;

            const from = normalizeAddress(fromParam);
            const to = normalizeAddress(toParam);
            if (from !== walletLower && to !== walletLower) continue;

            const decimals = (log.sender_contract_decimals as number) ?? 0;
            const rawAmount = BigInt(valueParam);
            const amount = decimals > 0 ? Number(rawAmount) / Math.pow(10, decimals) : Number(rawAmount);
            if (amount === 0) continue;

            const token: Token = {
                contractAddress: normalizeAddress((log.sender_address as string) ?? ""),
                symbol: (log.sender_contract_ticker_symbol as string) ?? "NFT",
                decimals,
                name: (log.sender_name as string) ?? "Unknown NFT",
                tokenId: idParam,
            };

            let bucket: Transfer["bucket"] = "SELF";
            if (isZeroAddress(toParam)) bucket = "BURNED";
            else if (isZeroAddress(fromParam)) bucket = "MINTED";
            else if (from === walletLower && to !== walletLower) bucket = "SENT";
            else if (to === walletLower && from !== walletLower) bucket = "RECEIVED";

            transfers.push({ from, to, amount, token, rate: 0, treatment: "ignore", bucket });
        } else if (decoded.name === "Deposit" || decoded.name === "Withdrawal") {
            // Gap #6B — WETH/wrapped-native Deposit & Withdrawal synthetic native transfers
            if (!chainConfig) continue;
            const wrappedNativeAddr = chainConfig.wrappedNativeAddress.toLowerCase();
            const logSenderAddr = ((log.sender_address as string) ?? "").toLowerCase();
            if (logSenderAddr !== wrappedNativeAddr) continue;

            const params = decoded.params ?? [];
            // Deposit: event Deposit(address indexed dst, uint wad)
            // Withdrawal: event Withdrawal(address indexed src, uint wad)
            // Secondary false-positive guard: non-WETH contracts (ERC-4626, Aave) use 'assets'/'shares' not 'wad', so wadParam will be undefined and we skip
            const dstOrSrc = params.find((p) => p.name === "dst" || p.name === "src")?.value ?? "";
            const wadParam = params.find((p) => p.name === "wad")?.value;
            if (!wadParam || dstOrSrc.toLowerCase() !== walletLower) continue;

            const nativeToken: Token = {
                contractAddress: NATIVE_TOKEN_ADDRESS,
                symbol: chainConfig.nativeSymbol,
                decimals: 18,
                name: chainConfig.nativeSymbol,
            };
            const amount = Number(BigInt(wadParam)) / 1e18;
            if (amount === 0) continue;

            if (decoded.name === "Deposit") {
                // Wallet wrapped ETH → WETH: add synthetic SENT native if not already present
                const alreadyHasNativeSent = transfers.some(
                    (t) =>
                        t.token.contractAddress === NATIVE_TOKEN_ADDRESS &&
                        t.bucket === "SENT" &&
                        Math.abs(t.amount - amount) < 1e-12
                );
                if (!alreadyHasNativeSent) {
                    transfers.push({
                        from: walletLower,
                        to: wrappedNativeAddr,
                        amount,
                        token: nativeToken,
                        rate: 0,
                        treatment: "ignore",
                        bucket: "SENT",
                    });
                }
            } else {
                // Withdrawal: wallet unwrapped WETH → ETH: add synthetic RECEIVED native if not already present
                const alreadyHasNativeReceived = transfers.some(
                    (t) =>
                        t.token.contractAddress === NATIVE_TOKEN_ADDRESS &&
                        t.bucket === "RECEIVED" &&
                        Math.abs(t.amount - amount) < 1e-12
                );
                if (!alreadyHasNativeReceived) {
                    transfers.push({
                        from: wrappedNativeAddr,
                        to: walletLower,
                        amount,
                        token: nativeToken,
                        rate: 0,
                        treatment: "ignore",
                        bucket: "RECEIVED",
                    });
                }
            }
        }
    }

    // Gap #1 — sender_factory_address label enrichment
    if (counterpartyLabel === null) {
        for (const log of logEvents) {
            const factoryAddr = log.sender_factory_address as string | null;
            if (factoryAddr) {
                const factoryLabel = getProtocolLabel(chainName, factoryAddr);
                if (factoryLabel) {
                    counterpartyLabel = factoryLabel;
                    break;
                }
            }
        }
    }

    // Gap #5 — sender_name entity label fallback
    if (counterpartyLabel === null && toAddress) {
        const toAddressLower = toAddress.toLowerCase();
        for (const log of logEvents) {
            const senderAddr = (log.sender_address as string | null) ?? "";
            const senderName = (log.sender_name as string | null) ?? "";
            if (senderAddr.toLowerCase() === toAddressLower && senderName) {
                counterpartyLabel = senderName;
                break;
            }
        }
    }

    // Gap #2 — sender_address_label enrichment (underdocumented GoldRush field on log events)
    if (counterpartyLabel === null) {
        for (const log of logEvents) {
            const addrLabel = (log.sender_address_label as string | null) ?? "";
            if (addrLabel) {
                counterpartyLabel = addrLabel;
                break;
            }
        }
    }

    // Gap #6A — internal_transfers (eth-mainnet with-internal=true; other chains: empty, future-ready)
    if (chainConfig) {
        const internalTransfers = (item.internal_transfers as Array<Record<string, unknown>> | null) ?? [];
        const nativeToken: Token = {
            contractAddress: NATIVE_TOKEN_ADDRESS,
            symbol: chainConfig.nativeSymbol,
            decimals: 18,
            name: chainConfig.nativeSymbol,
        };
        for (const it of internalTransfers) {
            const itFrom = ((it.from_address as string) ?? "").toLowerCase();
            const itTo = ((it.to_address as string) ?? "").toLowerCase();
            if (itFrom !== walletLower && itTo !== walletLower) continue;

            const rawValue = it.value as string | null;
            if (!rawValue) continue;
            // GoldRush returns value as a decimal string; try/catch also handles hex '0x...' defensively
            let itValueBig: bigint;
            try {
                itValueBig = BigInt(rawValue);
            } catch {
                continue;
            }
            if (itValueBig === 0n) continue;
            const amount = Number(itValueBig) / 1e18;
            const bucket: Transfer["bucket"] = itFrom === walletLower ? "SENT" : "RECEIVED";

            // Note: dedup by from+to+amount cannot distinguish two identical-amount internal calls
            // in the same tx (e.g. a router forwarding the same ETH amount twice). GoldRush does
            // not expose a sub-tx sequence index, so we err on the side of under-counting.
            const isDuplicate = transfers.some(
                (t) =>
                    t.token.contractAddress === NATIVE_TOKEN_ADDRESS &&
                    t.bucket === bucket &&
                    t.from === itFrom &&
                    t.to === itTo &&
                    Math.abs(t.amount - amount) < 1e-12
            );
            if (isDuplicate) continue;

            transfers.push({
                from: itFrom,
                to: itTo,
                amount,
                token: nativeToken,
                rate: 0,
                treatment: "ignore",
                bucket,
            });
        }
    }

    if (transfers.length === 0 && gasQuote === 0 && !successful) return null;

    return {
        hash,
        timestamp,
        chain: chainName,
        chainDisplayName: getDisplayName(chainName),
        blockHeight: item.block_height as number,
        transfers,
        category: "UNKNOWN",
        counterparty: toAddress,
        counterpartyLabel,
        gasFeeNative: (gasSpent * gasPrice) / 1e18,
        gasFeesUsd: gasQuote,
        successful,
        rawMethodId: methodId,
    };
}

/** Resolve USD prices for transfers missing rates */
async function resolvePrices(
    client: GoldRushClient,
    transactions: Transaction[],
    quoteCurrency: string,
    signal: AbortSignal,
    onProgress: (msg: string) => void
): Promise<void> {
    // Collect unique (chain, contract, date) tuples needing prices
    const priceNeeds = new Map<string, { chain: string; contract: string; dates: Set<string> }>();

    for (const tx of transactions) {
        for (const t of tx.transfers) {
            let contract = t.token.contractAddress;
            // For native tokens, use wrapped native address
            if (contract === NATIVE_TOKEN_ADDRESS) {
                const wrapped = getWrappedNativeAddress(tx.chain);
                if (!wrapped) continue;
                contract = normalizeAddress(wrapped);
            }
            const key = `${tx.chain}:${contract}`;
            let entry = priceNeeds.get(key);
            if (!entry) {
                entry = { chain: tx.chain, contract, dates: new Set() };
                priceNeeds.set(key, entry);
            }
            entry.dates.add(dateToKey(tx.timestamp));
        }
    }

    // Fetch prices per token
    const priceCache = new Map<string, number>(); // "chain:contract:YYYY-MM-DD" → price
    let fetched = 0;
    const total = priceNeeds.size;

    for (const [, need] of priceNeeds) {
        if (signal.aborted) return;
        fetched++;
        onProgress(`Fetching prices: ${fetched}/${total} tokens...`);

        const datesArr = Array.from(need.dates).sort();
        if (datesArr.length === 0) continue;

        const from = datesArr[0]!;
        const to = datesArr[datesArr.length - 1]!;

        try {
            const resp = await client.PricingService.getTokenPrices(
                need.chain as Parameters<typeof client.PricingService.getTokenPrices>[0],
                quoteCurrency as Parameters<typeof client.PricingService.getTokenPrices>[1],
                need.contract,
                { from, to }
            );

            if (!resp.error && resp.data) {
                for (const tokenData of resp.data) {
                    const prices = (tokenData as { prices?: Array<{ date: string; price: number }> }).prices ?? [];
                    for (const p of prices) {
                        const dateStr = typeof p.date === "string" ? p.date.slice(0, 10) : "";
                        if (dateStr) {
                            priceCache.set(`${need.chain}:${need.contract}:${dateStr}`, p.price);
                        }
                    }
                }
            }
        } catch {
            // Price fetch failed — leave rate as 0
        }
    }

    // Apply prices to transfers
    for (const tx of transactions) {
        for (const t of tx.transfers) {
            if (t.rate > 0) continue;
            let contract = t.token.contractAddress;
            if (contract === NATIVE_TOKEN_ADDRESS) {
                const wrapped = getWrappedNativeAddress(tx.chain);
                if (!wrapped) continue;
                contract = normalizeAddress(wrapped);
            }
            const dateStr = dateToKey(tx.timestamp);
            const price = priceCache.get(`${tx.chain}:${contract}:${dateStr}`);
            if (price !== undefined) {
                t.rate = price;
            }
        }
    }
}
