/**
 * CEX CSV importers.
 *
 * Each exchange has a detect() + parse() pair.
 * detect() receives the raw header row cells; parse() receives all rows
 * (including the header row) and returns a list of Transactions.
 *
 * CEX transactions use chain = "cex-<exchange>" so taxCalc.ts can
 * use symbol.toLowerCase() as the canonical FIFO key, which aligns
 * with the canonical registry keys for well-known assets (eth, usdc, …).
 */
import type { Category, Token, Transaction, Transfer } from "./types";

// ─── Minimal CSV parser ────────────────────────────────────────────────────

export function parseCsvText(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
        if (!line.trim()) continue;
        const cells: string[] = [];
        let inQuote = false;
        let cell = "";
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]!;
            if (ch === '"') {
                if (inQuote && line[i + 1] === '"') {
                    cell += '"';
                    i++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (ch === "," && !inQuote) {
                cells.push(cell.trim());
                cell = "";
            } else {
                cell += ch;
            }
        }
        cells.push(cell.trim());
        rows.push(cells);
    }
    return rows;
}

// ─── Shared helpers ────────────────────────────────────────────────────────

/** Strip currency symbols and commas from a number string like "$1,234.56" */
function parseNum(s: string | undefined): number {
    if (!s) return 0;
    return parseFloat(s.replace(/[^0-9.\-]/g, "")) || 0;
}

/** Extract numeric value and symbol from strings like "0.5 ETH" or "1500.00 USDT" */
function parseAmountWithSymbol(s: string): { amount: number; symbol: string } | null {
    const m = s.trim().match(/^([0-9,.]+)\s+([A-Za-z]+)$/);
    if (!m) return null;
    return { amount: parseFloat(m[1]!.replace(/,/g, "")) || 0, symbol: m[2]!.toUpperCase() };
}

const STABLE_SYMBOLS = new Set(["USD", "USDT", "USDC", "BUSD", "DAI", "TUSD", "USDP", "GUSD", "EUR", "GBP"]);

function isStableSymbol(s: string): boolean {
    return STABLE_SYMBOLS.has(s.toUpperCase());
}

let _txCounter = 0;
function makeCexHash(exchange: string): string {
    return `cex-${exchange}-${Date.now()}-${(++_txCounter).toString(36)}`;
}

function makeCexToken(symbol: string): Token {
    return {
        contractAddress: symbol.toLowerCase(),
        symbol: symbol.toUpperCase(),
        decimals: 18,
        name: symbol.toUpperCase(),
    };
}

function makeCexTx(
    exchange: string,
    date: Date,
    transfers: Transfer[],
    category: Category,
    feeUsd = 0,
    label: string | null = null
): Transaction {
    return {
        hash: makeCexHash(exchange),
        timestamp: date,
        chain: `cex-${exchange.toLowerCase()}`,
        chainDisplayName: exchange,
        blockHeight: 0,
        transfers,
        category,
        counterparty: "",
        counterpartyLabel: label,
        gasFeeNative: 0,
        gasFeesUsd: feeUsd,
        successful: true,
        rawMethodId: "",
    };
}

// ─── Coinbase ──────────────────────────────────────────────────────────────
// Export: account → statements → generate report (CSV)
// Headers: Timestamp,Transaction Type,Asset,Quantity Transacted,
//          Spot Price Currency,Spot Price at Transaction,Subtotal,
//          Total (inclusive of fees and/or spread),Fees and/or Spread,Notes

const COINBASE_ID_HEADERS = ["Timestamp", "Transaction Type", "Asset", "Quantity Transacted"];

export function detectCoinbase(headers: string[]): boolean {
    return COINBASE_ID_HEADERS.every((h) => headers.includes(h));
}

export function parseCoinbase(allRows: string[][]): Transaction[] {
    const headerIdx = allRows.findIndex((r) => r.includes("Timestamp") && r.includes("Transaction Type"));
    if (headerIdx === -1) return [];
    const h = allRows[headerIdx]!;

    const col = (name: string) => h.indexOf(name);
    const iDate = col("Timestamp");
    const iType = col("Transaction Type");
    const iAsset = col("Asset");
    const iQty = col("Quantity Transacted");
    const iPrice = col("Spot Price at Transaction");
    const iFee = col("Fees and/or Spread");
    const iNotes = col("Notes");

    const txs: Transaction[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const r = allRows[i]!;
        if (!r[iDate]) continue;

        const rawType = r[iType]?.trim() ?? "";
        const asset = r[iAsset]?.trim().toUpperCase() ?? "";
        const amount = parseNum(r[iQty]);
        const price = parseNum(r[iPrice]);
        const fee = parseNum(r[iFee]);
        const date = new Date(r[iDate]);
        const notes = r[iNotes] ?? "";

        if (!asset || amount <= 0 || isNaN(date.getTime())) continue;

        const token = makeCexToken(asset);

        switch (rawType) {
            case "Buy":
                txs.push(
                    makeCexTx(
                        "Coinbase",
                        date,
                        [{ from: "", to: "cex", amount, token, rate: price, treatment: "buy", bucket: "RECEIVED" }],
                        "TRANSFER_IN",
                        fee
                    )
                );
                break;

            case "Sell":
                txs.push(
                    makeCexTx(
                        "Coinbase",
                        date,
                        [{ from: "cex", to: "", amount, token, rate: price, treatment: "sell", bucket: "SENT" }],
                        "TRANSFER_OUT",
                        fee
                    )
                );
                break;

            case "Receive":
            case "Deposit":
                txs.push(
                    makeCexTx(
                        "Coinbase",
                        date,
                        [{ from: "", to: "cex", amount, token, rate: price, treatment: "buy", bucket: "RECEIVED" }],
                        "TRANSFER_IN",
                        fee,
                        notes || null
                    )
                );
                break;

            case "Send":
            case "Withdrawal":
                txs.push(
                    makeCexTx(
                        "Coinbase",
                        date,
                        [{ from: "cex", to: "", amount, token, rate: price, treatment: "sell", bucket: "SENT" }],
                        "TRANSFER_OUT",
                        fee
                    )
                );
                break;

            case "Convert": {
                // Notes field: "Converted 0.5 ETH to 1500 USDT"
                const noteMatch = notes.match(/Converted\s+([\d.]+)\s+(\w+)\s+to\s+([\d.]+)\s+(\w+)/i);
                if (noteMatch) {
                    const fromAmt = parseFloat(noteMatch[1]!) || amount;
                    const fromSym = noteMatch[2]!.toUpperCase();
                    const toAmt = parseFloat(noteMatch[3]!) || 0;
                    const toSym = noteMatch[4]!.toUpperCase();
                    const impliedPrice = toAmt > 0 ? (fromAmt * price) / toAmt : price;
                    txs.push(
                        makeCexTx(
                            "Coinbase",
                            date,
                            [
                                {
                                    from: "cex",
                                    to: "",
                                    amount: fromAmt,
                                    token: makeCexToken(fromSym),
                                    rate: price,
                                    treatment: "sell",
                                    bucket: "SENT",
                                },
                                {
                                    from: "",
                                    to: "cex",
                                    amount: toAmt,
                                    token: makeCexToken(toSym),
                                    rate: impliedPrice,
                                    treatment: "buy",
                                    bucket: "RECEIVED",
                                },
                            ],
                            "SWAP",
                            fee
                        )
                    );
                } else {
                    // Fallback: treat as sell
                    txs.push(
                        makeCexTx(
                            "Coinbase",
                            date,
                            [{ from: "cex", to: "", amount, token, rate: price, treatment: "sell", bucket: "SENT" }],
                            "TRANSFER_OUT",
                            fee
                        )
                    );
                }
                break;
            }

            case "Rewards Income":
            case "Learning Reward":
            case "Interest Income":
            case "Staking Income":
            case "Coinbase Earn":
            case "Inflation Reward":
                txs.push(
                    makeCexTx(
                        "Coinbase",
                        date,
                        [{ from: "", to: "cex", amount, token, rate: price, treatment: "income", bucket: "RECEIVED" }],
                        "INCOME",
                        0
                    )
                );
                break;

            default:
                // Skip unknown types
                break;
        }
    }
    return txs;
}

// ─── Binance ───────────────────────────────────────────────────────────────
// Export: Orders → Trade History → Export
// Headers: Date(UTC),Pair,Side,Price,Executed,Amount,Fee
//   OR the newer: Date(UTC),OrderNo,Pair,Type,Order Price,Order Amount,AvgTradingPrice,Filled,Total,TradingTotal,status

const BINANCE_TRADE_HEADERS = ["Date(UTC)", "Pair", "Side"];
const BINANCE_STATEMENT_HEADERS = ["UTC_Time", "Account", "Operation", "Coin", "Change"];

export function detectBinance(headers: string[]): boolean {
    return (
        (BINANCE_TRADE_HEADERS.every((h) => headers.includes(h)) && headers.includes("Executed")) ||
        BINANCE_STATEMENT_HEADERS.every((h) => headers.includes(h))
    );
}

export function parseBinance(allRows: string[][]): Transaction[] {
    // Check which format
    const tradeHeaderIdx = allRows.findIndex(
        (r) => r.includes("Date(UTC)") && r.includes("Pair") && r.includes("Side") && r.includes("Executed")
    );
    const stmtHeaderIdx = allRows.findIndex((r) => r.includes("UTC_Time") && r.includes("Operation"));

    if (tradeHeaderIdx !== -1) return parseBinanceTrades(allRows, tradeHeaderIdx);
    if (stmtHeaderIdx !== -1) return parseBinanceStatement(allRows, stmtHeaderIdx);
    return [];
}

function parseBinanceTrades(allRows: string[][], headerIdx: number): Transaction[] {
    const h = allRows[headerIdx]!;
    const iDate = h.indexOf("Date(UTC)");
    const iSide = h.indexOf("Side");
    const iPrice = h.indexOf("Price");
    const iExecuted = h.indexOf("Executed");
    const iFee = h.indexOf("Fee");

    const txs: Transaction[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const r = allRows[i]!;
        if (!r[iDate]) continue;

        const date = new Date(r[iDate] + " UTC");
        if (isNaN(date.getTime())) continue;

        const side = r[iSide]?.trim().toUpperCase() ?? "";
        const price = parseNum(r[iPrice]);

        const executed = parseAmountWithSymbol(r[iExecuted] ?? "");
        if (!executed || executed.amount <= 0) continue;
        if (isStableSymbol(executed.symbol)) continue; // skip stablecoin execution legs

        const feeRaw = r[iFee] ?? "";
        const feeParsed = parseAmountWithSymbol(feeRaw);
        let feeUsd = 0;
        if (feeParsed) {
            if (isStableSymbol(feeParsed.symbol)) feeUsd = feeParsed.amount;
            else feeUsd = feeParsed.amount * price;
        }

        const token = makeCexToken(executed.symbol);
        const isBuy = side === "BUY";

        txs.push(
            makeCexTx(
                "Binance",
                date,
                [
                    {
                        from: isBuy ? "" : "cex",
                        to: isBuy ? "cex" : "",
                        amount: executed.amount,
                        token,
                        rate: price,
                        treatment: isBuy ? "buy" : "sell",
                        bucket: isBuy ? "RECEIVED" : "SENT",
                    },
                ],
                isBuy ? "TRANSFER_IN" : "TRANSFER_OUT",
                feeUsd
            )
        );
    }
    return txs;
}

function parseBinanceStatement(allRows: string[][], headerIdx: number): Transaction[] {
    const h = allRows[headerIdx]!;
    const iDate = h.indexOf("UTC_Time");
    const iOp = h.indexOf("Operation");
    const iCoin = h.indexOf("Coin");
    const iChange = h.indexOf("Change");

    const INCOME_OPS = new Set([
        "ETH 2.0 Staking Rewards",
        "Staking Rewards",
        "POS savings interest",
        "Launchpool Interest",
        "Savings Interest",
        "Simple Earn Flexible Interest",
        "Simple Earn Locked Rewards",
        "Airdrop Assets",
        "Cash Voucher distribution",
    ]);
    const SKIP_OPS = new Set([
        "Transaction Related",
        "Commission History",
        "Referral Kickback",
        "Small assets exchange BNB",
        "Transfer Between Spot Account and UM Futures Account",
        "Transfer Between Spot Account and CM Futures Account",
    ]);

    const txs: Transaction[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const r = allRows[i]!;
        if (!r[iDate]) continue;

        const op = r[iOp]?.trim() ?? "";
        if (SKIP_OPS.has(op)) continue;

        const date = new Date(r[iDate] + " UTC");
        if (isNaN(date.getTime())) continue;

        const coin = r[iCoin]?.trim().toUpperCase() ?? "";
        const change = parseNum(r[iChange]);
        if (!coin || change === 0) continue;
        if (isStableSymbol(coin)) continue;

        const amount = Math.abs(change);
        const token = makeCexToken(coin);

        if (INCOME_OPS.has(op)) {
            txs.push(
                makeCexTx(
                    "Binance",
                    date,
                    [{ from: "", to: "cex", amount, token, rate: 0, treatment: "income", bucket: "RECEIVED" }],
                    "INCOME"
                )
            );
        } else if (op === "Buy" || (op === "Deposit" && change > 0)) {
            txs.push(
                makeCexTx(
                    "Binance",
                    date,
                    [{ from: "", to: "cex", amount, token, rate: 0, treatment: "buy", bucket: "RECEIVED" }],
                    "TRANSFER_IN"
                )
            );
        } else if (op === "Sell" || (op === "Withdrawal" && change < 0)) {
            txs.push(
                makeCexTx(
                    "Binance",
                    date,
                    [{ from: "cex", to: "", amount, token, rate: 0, treatment: "sell", bucket: "SENT" }],
                    "TRANSFER_OUT"
                )
            );
        }
    }
    return txs;
}

// ─── Kraken ────────────────────────────────────────────────────────────────
// Export: History → Ledgers → Export
// Headers: txid,refid,time,type,subtype,aclass,asset,amount,fee,balance

const KRAKEN_HEADERS = ["txid", "refid", "time", "type", "aclass", "asset", "amount", "fee"];

export function detectKraken(headers: string[]): boolean {
    return KRAKEN_HEADERS.every((h) => headers.includes(h));
}

const KRAKEN_ASSET_MAP: Record<string, string> = {
    XETH: "ETH",
    XXBT: "BTC",
    XLTC: "LTC",
    XXRP: "XRP",
    XXLM: "XLM",
    XXMR: "XMR",
    XZEC: "ZEC",
    ZUSD: "USD",
    ZEUR: "EUR",
    ZGBP: "GBP",
    ZCAD: "CAD",
    ZJPY: "JPY",
    ZAUD: "AUD",
    XICN: "ICN",
    XMLN: "MLN",
    XREP: "REP",
    XXDG: "XDG",
};

function normalizeKrakenAsset(asset: string): string {
    return KRAKEN_ASSET_MAP[asset] ?? (asset.startsWith("X") || asset.startsWith("Z") ? asset.slice(1) : asset);
}

export function parseKraken(allRows: string[][]): Transaction[] {
    const headerIdx = allRows.findIndex((r) => r.includes("txid") && r.includes("refid") && r.includes("type"));
    if (headerIdx === -1) return [];
    const h = allRows[headerIdx]!;

    const iRefid = h.indexOf("refid");
    const iTime = h.indexOf("time");
    const iType = h.indexOf("type");
    const iAsset = h.indexOf("asset");
    const iAmount = h.indexOf("amount");
    const iFee = h.indexOf("fee");

    interface KrakenLedger {
        refid: string;
        time: Date;
        type: string;
        asset: string;
        amount: number;
        fee: number;
    }
    const ledgers: KrakenLedger[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const r = allRows[i]!;
        if (!r[iTime]) continue;
        const date = new Date(r[iTime]);
        if (isNaN(date.getTime())) continue;

        ledgers.push({
            refid: r[iRefid] ?? "",
            time: date,
            type: r[iType]?.trim() ?? "",
            asset: normalizeKrakenAsset(r[iAsset]?.trim() ?? ""),
            amount: parseNum(r[iAmount]),
            fee: parseNum(r[iFee]),
        });
    }

    // Group by refid to pair trade legs
    const byRef = new Map<string, KrakenLedger[]>();
    for (const l of ledgers) {
        if (!l.refid) continue;
        const group = byRef.get(l.refid) ?? [];
        group.push(l);
        byRef.set(l.refid, group);
    }

    const txs: Transaction[] = [];

    for (const group of byRef.values()) {
        const first = group[0]!;

        if (first.type === "trade") {
            // Trade legs: one negative (sold), one positive (bought)
            const sold = group.find((l) => l.amount < 0 && !isStableSymbol(l.asset));
            const bought = group.find((l) => l.amount > 0 && !isStableSymbol(l.asset));
            const stableLeg = group.find((l) => isStableSymbol(l.asset));

            const proceeds = stableLeg ? Math.abs(stableLeg.amount) : 0;
            const feeUsd = group.reduce((s, l) => s + l.fee, 0); // simplified: sum all fees

            if (sold && bought) {
                // Crypto-to-crypto swap
                const soldPrice = proceeds > 0 ? proceeds / Math.abs(sold.amount) : 0;
                const boughtPrice = proceeds > 0 ? proceeds / bought.amount : 0;
                txs.push(
                    makeCexTx(
                        "Kraken",
                        first.time,
                        [
                            {
                                from: "cex",
                                to: "",
                                amount: Math.abs(sold.amount),
                                token: makeCexToken(sold.asset),
                                rate: soldPrice,
                                treatment: "sell",
                                bucket: "SENT",
                            },
                            {
                                from: "",
                                to: "cex",
                                amount: bought.amount,
                                token: makeCexToken(bought.asset),
                                rate: boughtPrice,
                                treatment: "buy",
                                bucket: "RECEIVED",
                            },
                        ],
                        "SWAP",
                        feeUsd
                    )
                );
            } else if (sold) {
                const soldPrice = proceeds > 0 ? proceeds / Math.abs(sold.amount) : 0;
                txs.push(
                    makeCexTx(
                        "Kraken",
                        first.time,
                        [
                            {
                                from: "cex",
                                to: "",
                                amount: Math.abs(sold.amount),
                                token: makeCexToken(sold.asset),
                                rate: soldPrice,
                                treatment: "sell",
                                bucket: "SENT",
                            },
                        ],
                        "TRANSFER_OUT",
                        feeUsd
                    )
                );
            } else if (bought) {
                const boughtPrice = proceeds > 0 ? proceeds / bought.amount : 0;
                txs.push(
                    makeCexTx(
                        "Kraken",
                        first.time,
                        [
                            {
                                from: "",
                                to: "cex",
                                amount: bought.amount,
                                token: makeCexToken(bought.asset),
                                rate: boughtPrice,
                                treatment: "buy",
                                bucket: "RECEIVED",
                            },
                        ],
                        "TRANSFER_IN",
                        feeUsd
                    )
                );
            }
        } else if (first.type === "deposit") {
            if (isStableSymbol(first.asset)) continue;
            txs.push(
                makeCexTx(
                    "Kraken",
                    first.time,
                    [
                        {
                            from: "",
                            to: "cex",
                            amount: Math.abs(first.amount),
                            token: makeCexToken(first.asset),
                            rate: 0,
                            treatment: "buy",
                            bucket: "RECEIVED",
                        },
                    ],
                    "TRANSFER_IN",
                    first.fee
                )
            );
        } else if (first.type === "withdrawal") {
            if (isStableSymbol(first.asset)) continue;
            txs.push(
                makeCexTx(
                    "Kraken",
                    first.time,
                    [
                        {
                            from: "cex",
                            to: "",
                            amount: Math.abs(first.amount),
                            token: makeCexToken(first.asset),
                            rate: 0,
                            treatment: "sell",
                            bucket: "SENT",
                        },
                    ],
                    "TRANSFER_OUT",
                    first.fee
                )
            );
        } else if (first.type === "staking" || first.type === "earn") {
            if (first.amount <= 0 || isStableSymbol(first.asset)) continue;
            txs.push(
                makeCexTx(
                    "Kraken",
                    first.time,
                    [
                        {
                            from: "",
                            to: "cex",
                            amount: first.amount,
                            token: makeCexToken(first.asset),
                            rate: 0,
                            treatment: "income",
                            bucket: "RECEIVED",
                        },
                    ],
                    "INCOME"
                )
            );
        }
    }

    return txs;
}

// ─── Gemini ────────────────────────────────────────────────────────────────
// Export: Account → Transaction History → Download as CSV
// Headers vary by account but always contain:
//   Date, Time (UTC), Type, Symbol, Specification, USD Amount, Fee (USD)

const GEMINI_HEADERS = ["Date", "Time (UTC)", "Type", "Symbol"];

export function detectGemini(headers: string[]): boolean {
    return GEMINI_HEADERS.every((h) => headers.includes(h)) && headers.includes("USD Amount");
}

export function parseGemini(allRows: string[][]): Transaction[] {
    const headerIdx = allRows.findIndex(
        (r) => r.includes("Date") && r.includes("Time (UTC)") && r.includes("Type") && r.includes("USD Amount")
    );
    if (headerIdx === -1) return [];
    const h = allRows[headerIdx]!;

    const iDate = h.indexOf("Date");
    const iTime = h.indexOf("Time (UTC)");
    const iType = h.indexOf("Type");
    const iSymbol = h.indexOf("Symbol");
    const iUsdAmount = h.indexOf("USD Amount");
    const iFeeUsd = h.indexOf("Fee (USD)");

    // Find asset amount column: first column after Fee (USD) that contains "Amount" but not "USD"
    const iAssetAmount = h.findIndex((col, idx) => idx > iFeeUsd && col.includes("Amount") && !col.includes("USD"));

    const txs: Transaction[] = [];
    for (let i = headerIdx + 1; i < allRows.length; i++) {
        const r = allRows[i]!;
        if (!r[iDate]) continue;

        const rawType = r[iType]?.trim() ?? "";
        const dateStr = `${r[iDate]} ${r[iTime]} UTC`;
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) continue;

        const symbolPair = r[iSymbol]?.trim() ?? ""; // e.g. "ETHUSD" or "BTCUSD"
        const usdAmount = Math.abs(parseNum(r[iUsdAmount]));
        const feeUsd = Math.abs(parseNum(r[iFeeUsd]));

        // Determine asset: strip trailing USD/USDT/USDC from symbol pair
        const asset = symbolPair.replace(/USD[TC]?$/, "").toUpperCase();
        if (!asset || isStableSymbol(asset)) continue;

        // Asset amount
        let assetAmount = 0;
        if (iAssetAmount !== -1) {
            assetAmount = Math.abs(parseNum(r[iAssetAmount]));
        }

        const price = assetAmount > 0 ? usdAmount / assetAmount : 0;
        const token = makeCexToken(asset);

        switch (rawType) {
            case "Buy":
                if (assetAmount <= 0) continue;
                txs.push(
                    makeCexTx(
                        "Gemini",
                        date,
                        [
                            {
                                from: "",
                                to: "cex",
                                amount: assetAmount,
                                token,
                                rate: price,
                                treatment: "buy",
                                bucket: "RECEIVED",
                            },
                        ],
                        "TRANSFER_IN",
                        feeUsd
                    )
                );
                break;

            case "Sell":
                if (assetAmount <= 0) continue;
                txs.push(
                    makeCexTx(
                        "Gemini",
                        date,
                        [
                            {
                                from: "cex",
                                to: "",
                                amount: assetAmount,
                                token,
                                rate: price,
                                treatment: "sell",
                                bucket: "SENT",
                            },
                        ],
                        "TRANSFER_OUT",
                        feeUsd
                    )
                );
                break;

            case "Credit":
            case "Earn Interest":
            case "Earn Reward":
                if (assetAmount <= 0) continue;
                txs.push(
                    makeCexTx(
                        "Gemini",
                        date,
                        [
                            {
                                from: "",
                                to: "cex",
                                amount: assetAmount,
                                token,
                                rate: price,
                                treatment: "income",
                                bucket: "RECEIVED",
                            },
                        ],
                        "INCOME"
                    )
                );
                break;

            case "Deposit":
                if (assetAmount <= 0) continue;
                txs.push(
                    makeCexTx(
                        "Gemini",
                        date,
                        [
                            {
                                from: "",
                                to: "cex",
                                amount: assetAmount,
                                token,
                                rate: price,
                                treatment: "buy",
                                bucket: "RECEIVED",
                            },
                        ],
                        "TRANSFER_IN",
                        feeUsd
                    )
                );
                break;

            case "Withdrawal":
                if (assetAmount <= 0) continue;
                txs.push(
                    makeCexTx(
                        "Gemini",
                        date,
                        [
                            {
                                from: "cex",
                                to: "",
                                amount: assetAmount,
                                token,
                                rate: price,
                                treatment: "sell",
                                bucket: "SENT",
                            },
                        ],
                        "TRANSFER_OUT",
                        feeUsd
                    )
                );
                break;

            default:
                break;
        }
    }
    return txs;
}

// ─── Auto-detect + dispatch ────────────────────────────────────────────────

export type SupportedExchange = "Coinbase" | "Binance" | "Kraken" | "Gemini";

export interface CexParseResult {
    exchange: SupportedExchange;
    transactions: Transaction[];
    skipped: number;
}

/**
 * Parse a CEX CSV file. Auto-detects the exchange from headers.
 * Returns null if the format is not recognised.
 */
export function parseCexCsv(text: string): CexParseResult | null {
    const rows = parseCsvText(text);
    if (rows.length < 2) return null;

    // Find first row that looks like a header (scan first 10 rows)
    const scanRows = rows.slice(0, 10);
    for (const row of scanRows) {
        if (detectCoinbase(row)) {
            const txs = parseCoinbase(rows);
            return { exchange: "Coinbase", transactions: txs, skipped: 0 };
        }
        if (detectBinance(row)) {
            const txs = parseBinance(rows);
            return { exchange: "Binance", transactions: txs, skipped: 0 };
        }
        if (detectKraken(row)) {
            const txs = parseKraken(rows);
            return { exchange: "Kraken", transactions: txs, skipped: 0 };
        }
        if (detectGemini(row)) {
            const txs = parseGemini(rows);
            return { exchange: "Gemini", transactions: txs, skipped: 0 };
        }
    }
    return null;
}
