import { getCanonicalKey, getCanonicalSymbol } from "./canonicalTokens";
import { isStablecoin } from "./stablecoins";
import type {
    AcquisitionLot,
    CostBasisMethod,
    ImportedLotInput,
    IncomeEvent,
    TaxEvent,
    TaxReport,
    Transaction,
} from "./types";

const MS_PER_DAY = 86400000;

/**
 * IRS holding period: an asset is LONG-TERM only if held *more than one year*.
 * The holding period begins the day after acquisition, so the asset must be held at
 * least "a year and a day". Using a calendar-based +1-year comparison (rather than a
 * fixed 365-day threshold) keeps the boundary correct across leap years.
 */
function isLongTerm(acquired: Date, sold: Date): boolean {
    const oneYearAfter = new Date(acquired);
    oneYearAfter.setFullYear(oneYearAfter.getFullYear() + 1);
    return sold.getTime() > oneYearAfter.getTime();
}

/**
 * Pick the lot index to consume for a given disposal method.
 * FIFO: oldest first (index 0)
 * LIFO: newest first (last index)
 * HIFO: highest cost basis per unit first
 * ACB:  average cost — always index 0 (queue is a single synthetic lot)
 */
function pickLotIndex(queue: AcquisitionLot[], method: CostBasisMethod): number {
    if (method === "LIFO") return queue.length - 1;
    if (method === "HIFO") {
        let best = 0;
        for (let i = 1; i < queue.length; i++) {
            if (queue[i]!.costBasisPerUnit > queue[best]!.costBasisPerUnit) best = i;
        }
        return best;
    }
    // FIFO and ACB both consume index 0
    return 0;
}

/**
 * For ACB (Average Cost Basis): collapse all lots in the queue into one synthetic lot
 * with the weighted-average cost basis per unit. Mutates the queue in place.
 */
function collapseToAcb(queue: AcquisitionLot[]): void {
    if (queue.length <= 1) return;
    const totalAmount = queue.reduce((s, l) => s + l.amount, 0);
    const totalCost = queue.reduce((s, l) => s + l.amount * l.costBasisPerUnit, 0);
    const avg = totalAmount > 0 ? totalCost / totalAmount : 0;
    // Use the amount-weighted average acquisition date for holding-period purposes.
    // (Keeping only the earliest date would skew every pooled lot toward long-term.)
    const weightedTime =
        totalAmount > 0
            ? queue.reduce((s, l) => s + l.date.getTime() * l.amount, 0) / totalAmount
            : queue[0]!.date.getTime();
    const base = queue[0]!;
    queue.splice(0, queue.length, {
        ...base,
        date: new Date(weightedTime),
        amount: totalAmount,
        costBasisPerUnit: avg,
    });
}

/**
 * Capital gains calculator supporting FIFO, LIFO, HIFO, and ACB methods.
 * Processes classified transactions and produces a tax report.
 * @param currency ISO 4217 code that all monetary rates are denominated in (default "USD")
 * @param method   Cost basis accounting method (default "FIFO")
 */
export function calculateTaxes(
    transactions: Transaction[],
    taxYear?: number,
    currency = "USD",
    importedLots: ImportedLotInput[] = [],
    method: CostBasisMethod = "FIFO"
): TaxReport {
    // Sort chronologically
    const sorted = [...transactions].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // FIFO queues per token (key: "chain:contractAddress")
    const lots = new Map<string, AcquisitionLot[]>();

    // Pre-populate FIFO queues with imported lots
    for (const imp of importedLots) {
        // Use the same key format as getCanonicalKey: for well-known tokens
        // (ETH, USDC, USDT, WBTC, etc.) getCanonicalKey returns the lowercase
        // symbol (e.g. "eth", "usdc"). For unknown tokens it returns
        // "chain:contractAddress". Since imported lots only carry a symbol,
        // imp.token.toLowerCase() aligns with the canonical-symbol path and
        // is the correct key for all tokens users are likely to import.
        const key = imp.token.toLowerCase();
        const queue = lots.get(key) ?? [];
        queue.push({
            date: new Date(imp.date),
            amount: imp.amount,
            costBasisPerUnit: imp.costBasisPerUnit,
            token: imp.token,
            chain: imp.chain,
            txHash: "imported",
            isYield: false,
        });
        lots.set(key, queue);
    }
    // Tracks all acquisition dates per tokenKey for wash-sale detection
    const acquisitionTimeline = new Map<string, Array<{ time: number; txHash: string }>>(); // tokenKey → {time, txHash}[]
    // Maps each created TaxEvent back to its tokenKey + the acquisition lot's txHash for post-scan lookup
    const eventTokenKey = new Map<TaxEvent, { tokenKey: string; acquiredTxHash: string }>();
    const shortTermEvents: TaxEvent[] = [];
    const longTermEvents: TaxEvent[] = [];
    const income: IncomeEvent[] = [];
    let totalFees = 0;

    for (const tx of sorted) {
        // Accumulate gas fees
        totalFees += tx.gasFeesUsd;

        // Pre-compute proportional gas allocation across sell+buy transfers
        const gasAllocations = new Map<number, number>();
        if (tx.gasFeesUsd > 0) {
            const eligible = tx.transfers
                .map((t, i) => ({ t, i }))
                // buy/sell/fee are the treatments that create tax events (acquisitions and
                // disposals); gas is pro-rated across exactly those, matching the disposal branch
                // below which treats "sell" and "fee" identically.
                .filter(({ t }) => t.treatment === "sell" || t.treatment === "buy" || t.treatment === "fee");
            const totalValue = eligible.reduce((s, { t }) => s + t.amount * t.rate, 0);
            if (totalValue > 0) {
                for (const { t, i } of eligible) {
                    gasAllocations.set(i, tx.gasFeesUsd * ((t.amount * t.rate) / totalValue));
                }
            }
        }

        tx.transfers.forEach((transfer, transferIdx) => {
            const rawKey = getCanonicalKey(tx.chain, transfer.token.contractAddress);
            // CEX transactions (chain starts with "cex-") use symbol.toLowerCase() so their lots
            // merge with on-chain canonical keys (e.g. Coinbase ETH → "eth" = on-chain ETH).
            // If the token wasn't in the hardcoded canonical registry (key contains ":") but is a
            // stablecoin (either hardcoded or dynamically detected from balances_v2), use its
            // lowercase symbol as the cross-chain FIFO key so that e.g. PYUSD on Ethereum and
            // PYUSD on Polygon share the same acquisition queue.
            const baseKey = tx.chain.startsWith("cex-")
                ? transfer.token.symbol.toLowerCase()
                : rawKey.includes(":") && isStablecoin(tx.chain, transfer.token.contractAddress)
                  ? transfer.token.symbol.toLowerCase()
                  : rawKey;
            // For NFTs each tokenId is a distinct asset — append it so every NFT gets its own lot.
            const tokenKey = transfer.token.tokenId ? `${baseKey}#${transfer.token.tokenId}` : baseKey;
            const gasForThis = gasAllocations.get(transferIdx) ?? 0;

            if (transfer.treatment === "buy" || transfer.treatment === "withdraw") {
                // Acquisition — bump cost basis by allocated gas
                const adjustedCostBasisPerUnit =
                    transfer.rate + (transfer.amount > 0 ? gasForThis / transfer.amount : 0);
                const queue = lots.get(tokenKey) ?? [];
                queue.push({
                    date: tx.timestamp,
                    amount: transfer.amount,
                    costBasisPerUnit: adjustedCostBasisPerUnit,
                    token: transfer.token.symbol,
                    chain: tx.chain,
                    txHash: tx.hash,
                    isYield: false,
                });
                lots.set(tokenKey, queue);
                const acqList = acquisitionTimeline.get(tokenKey) ?? [];
                acqList.push({ time: tx.timestamp.getTime(), txHash: tx.hash });
                acquisitionTimeline.set(tokenKey, acqList);
            } else if (transfer.treatment === "sell" || transfer.treatment === "fee") {
                // Disposal — lot-method match, reduce proceeds by allocated gas
                let remaining = transfer.amount;
                const grossProceeds = transfer.amount * transfer.rate;
                // Clamp at 0: if allocated gas exceeds gross proceeds, net proceeds shouldn't
                // go negative (which would overstate the loss). The full gas is still captured
                // in totalFees regardless.
                const netProceeds = Math.max(0, grossProceeds - gasForThis);
                const queue = lots.get(tokenKey) ?? [];

                // ACB: collapse all lots to a single weighted-average lot before matching
                if (method === "ACB") collapseToAcb(queue);

                while (remaining > 0 && queue.length > 0) {
                    const idx = pickLotIndex(queue, method);
                    const lot = queue[idx]!;
                    const matched = Math.min(remaining, lot.amount);
                    const costBasis = matched * lot.costBasisPerUnit;
                    const matchedProceeds = (matched / transfer.amount) * netProceeds;

                    const holdingPeriod = isLongTerm(lot.date, tx.timestamp) ? "long-term" : "short-term";

                    const displaySymbol = getCanonicalSymbol(baseKey) ?? transfer.token.symbol;
                    const tokenLabel = transfer.token.tokenId
                        ? `${displaySymbol} #${transfer.token.tokenId}`
                        : displaySymbol;
                    const event: TaxEvent = {
                        description: `${tokenLabel} (${tx.chain})`,
                        token: displaySymbol,
                        amount: matched,
                        dateAcquired: lot.date,
                        dateSold: tx.timestamp,
                        proceeds: matchedProceeds,
                        costBasis,
                        gainLoss: matchedProceeds - costBasis,
                        holdingPeriod,
                        chain: tx.chain,
                        txHash: tx.hash,
                    };

                    eventTokenKey.set(event, { tokenKey, acquiredTxHash: lot.txHash });
                    if (!taxYear || tx.timestamp.getFullYear() === taxYear) {
                        if (holdingPeriod === "short-term") {
                            shortTermEvents.push(event);
                        } else {
                            longTermEvents.push(event);
                        }
                    }

                    lot.amount -= matched;
                    remaining -= matched;

                    if (lot.amount <= 0.000000001) {
                        queue.splice(idx, 1);
                    }
                }

                // Unknown basis remainder
                if (remaining > 0.000000001) {
                    const displaySymbol = getCanonicalSymbol(baseKey) ?? transfer.token.symbol;
                    const tokenLabel = transfer.token.tokenId
                        ? `${displaySymbol} #${transfer.token.tokenId}`
                        : displaySymbol;
                    const unknownEvent: TaxEvent = {
                        description: `${tokenLabel} (${tx.chain}) [unknown basis]`,
                        token: displaySymbol,
                        amount: remaining,
                        dateAcquired: tx.timestamp,
                        dateSold: tx.timestamp,
                        proceeds: (remaining / transfer.amount) * netProceeds,
                        costBasis: 0,
                        gainLoss: (remaining / transfer.amount) * netProceeds,
                        holdingPeriod: "short-term",
                        chain: tx.chain,
                        txHash: tx.hash,
                    };
                    eventTokenKey.set(unknownEvent, { tokenKey, acquiredTxHash: "" });
                    if (!taxYear || tx.timestamp.getFullYear() === taxYear) {
                        shortTermEvents.push(unknownEvent);
                    }
                }
            } else if (transfer.treatment === "income") {
                const fmv = transfer.amount * transfer.rate;
                const incomeSymbol = getCanonicalSymbol(baseKey) ?? transfer.token.symbol;
                if (!taxYear || tx.timestamp.getFullYear() === taxYear) {
                    income.push({
                        date: tx.timestamp,
                        description: `${incomeSymbol} income (${tx.chain})`,
                        token: incomeSymbol,
                        amount: transfer.amount,
                        fairMarketValueUsd: fmv,
                        chain: tx.chain,
                        txHash: tx.hash,
                    });
                }
                const queue = lots.get(tokenKey) ?? [];
                queue.push({
                    date: tx.timestamp,
                    amount: transfer.amount,
                    costBasisPerUnit: transfer.rate,
                    token: transfer.token.symbol,
                    chain: tx.chain,
                    txHash: tx.hash,
                    isYield: true,
                });
                lots.set(tokenKey, queue);
                const acqListI = acquisitionTimeline.get(tokenKey) ?? [];
                acqListI.push({ time: tx.timestamp.getTime(), txHash: tx.hash });
                acquisitionTimeline.set(tokenKey, acqListI);
            }
            // deposit, withdraw, ignore → no tax event
        });
    }

    // Wash-sale scan (advisory): flag loss events where the same token is re-acquired within ±30
    // days. This is informational only — crypto is property, not a security, so IRC §1091 does not
    // currently apply and the loss is NOT disallowed in the totals below.
    const WASH_WINDOW_MS = 30 * MS_PER_DAY;
    let washSaleCount = 0;
    let washSaleDisallowedLoss = 0;

    for (const event of [...shortTermEvents, ...longTermEvents]) {
        if (event.gainLoss >= 0) continue;
        const entry = eventTokenKey.get(event);
        if (!entry) continue;
        const { tokenKey, acquiredTxHash } = entry;
        const saleTime = event.dateSold.getTime();
        const acqList = acquisitionTimeline.get(tokenKey) ?? [];
        // Find if there's a DIFFERENT acquisition within ±30 days
        const isWash = acqList.some(({ time, txHash }) => {
            // Skip the exact lot that was consumed: same txHash and same time
            if (txHash === acquiredTxHash && time === event.dateAcquired.getTime()) return false;
            return Math.abs(time - saleTime) <= WASH_WINDOW_MS;
        });
        if (isWash) {
            event.washSale = true;
            washSaleCount++;
            washSaleDisallowedLoss += Math.abs(event.gainLoss);
        }
    }

    const allEvents = [...shortTermEvents, ...longTermEvents];
    const unknownBasisEvents = allEvents.filter((e) => e.costBasis === 0 && e.proceeds > 0);

    // Only count transfers that actually affect tax calculations (exclude ignore-treated transfers,
    // e.g. SELF category, BORROW/REPAY receipt tokens, SPAM). rate=0 on an ignored transfer has
    // no tax impact and would just produce noise in the warning banner.
    const zeroRateTransferCount = transactions.reduce(
        (count, tx) =>
            count + tx.transfers.filter((t) => t.rate === 0 && t.amount > 0 && t.treatment !== "ignore").length,
        0
    );

    const unknownTxCount = transactions.filter((tx) => tx.category === "UNKNOWN").length;

    return {
        shortTermEvents,
        longTermEvents,
        income,
        totalShortTermGain: shortTermEvents.reduce((sum, e) => sum + e.gainLoss, 0),
        totalLongTermGain: longTermEvents.reduce((sum, e) => sum + e.gainLoss, 0),
        totalIncome: income.reduce((sum, e) => sum + e.fairMarketValueUsd, 0),
        totalFees,
        currency,
        unknownBasisCount: unknownBasisEvents.length,
        unknownBasisValueAtRisk: unknownBasisEvents.reduce((sum, e) => sum + e.proceeds, 0),
        zeroRateTransferCount,
        washSaleCount,
        washSaleDisallowedLoss,
        unknownTxCount,
    };
}
