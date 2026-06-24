import { CATEGORY_INFO } from "../lib/categories";
import type { Category, Transaction } from "../lib/types";
import { formatAmount, formatDate, formatFiat, shortenAddress } from "../lib/utils";
import React, { useEffect, useState } from "react";

interface TransactionTableProps {
    transactions: Transaction[];
    currency?: string;
    onPatchRate?: (txHash: string, chain: string, transferIndex: number, rate: number) => void;
    showWallet?: boolean;
    onSetCategoryOverride?: (hash: string, category: Category) => void;
    onClearCategoryOverride?: (hash: string) => void;
    overrides?: Map<string, Category>;
}

const ALL_CATEGORIES = Object.keys(CATEGORY_INFO) as Category[];

function PriceInput({ onCommit }: { onCommit: (price: number) => void }) {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState("");

    if (!editing) {
        return (
            <button className="price-edit-btn" onClick={() => setEditing(true)} title="Set price per unit">
                ✏ set price
            </button>
        );
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "Enter") {
            const price = parseFloat(value);
            if (!isNaN(price) && price >= 0) {
                onCommit(price);
                setEditing(false);
                setValue("");
            }
        } else if (e.key === "Escape") {
            setEditing(false);
            setValue("");
        }
    }

    return (
        <input
            className="price-edit-input"
            type="number"
            min="0"
            step="any"
            placeholder="price/unit"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
                setEditing(false);
                setValue("");
            }}
            autoFocus
        />
    );
}

const PAGE_SIZE = 100;

export function TransactionTable({
    transactions,
    currency = "USD",
    onPatchRate,
    showWallet,
    onSetCategoryOverride,
    onClearCategoryOverride,
    overrides,
}: TransactionTableProps) {
    const [page, setPage] = useState(0);

    useEffect(() => {
        setPage(0);
    }, [transactions]);

    if (transactions.length === 0) {
        return <div className="panel-empty">No transactions to display</div>;
    }

    const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
    const pageTransactions = transactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    return (
        <div className="tx-table-wrap">
            <table className="tx-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        {showWallet && <th>Wallet</th>}
                        <th>Chain</th>
                        <th>Type</th>
                        <th>Out</th>
                        <th>In</th>
                        <th>Fee</th>
                        <th>Counterparty</th>
                    </tr>
                </thead>
                <tbody>
                    {pageTransactions.map((tx) => {
                        const catInfo = CATEGORY_INFO[tx.category];
                        const sent = tx.transfers.filter((t) => t.bucket === "SENT" || t.bucket === "BURNED");
                        const received = tx.transfers.filter((t) => t.bucket === "RECEIVED" || t.bucket === "MINTED");

                        return (
                            <tr
                                key={`${tx.hash}-${tx.chain}`}
                                className={[
                                    tx.successful ? "" : "tx-row--failed",
                                    overrides?.has(tx.hash) ? "tx-row--overridden" : "",
                                ]
                                    .filter(Boolean)
                                    .join(" ")}
                            >
                                <td className="tx-date">{formatDate(tx.timestamp)}</td>
                                {showWallet && (
                                    <td className="tx-wallet">
                                        {tx.walletAddress ? shortenAddress(tx.walletAddress) : "—"}
                                    </td>
                                )}
                                <td className="tx-chain">{tx.chainDisplayName}</td>
                                <td>
                                    {onSetCategoryOverride ? (
                                        <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                                            <select
                                                className={`category-select${overrides?.has(tx.hash) ? " category-select--overridden" : ""}`}
                                                style={{ borderColor: catInfo?.color, color: catInfo?.color }}
                                                value={tx.category}
                                                title={
                                                    overrides?.has(tx.hash)
                                                        ? "Overridden — select to change"
                                                        : "Select to override category"
                                                }
                                                onChange={(e) =>
                                                    onSetCategoryOverride(tx.hash, e.target.value as Category)
                                                }
                                            >
                                                {ALL_CATEGORIES.map((cat) => (
                                                    <option key={cat} value={cat}>
                                                        {CATEGORY_INFO[cat]?.label ?? cat}
                                                    </option>
                                                ))}
                                            </select>
                                            {overrides?.has(tx.hash) && onClearCategoryOverride && (
                                                <button
                                                    className="override-reset-btn"
                                                    title="Reset to auto-detected category"
                                                    onClick={() => onClearCategoryOverride(tx.hash)}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </span>
                                    ) : (
                                        <span
                                            className="category-badge"
                                            style={{ borderColor: catInfo?.color, color: catInfo?.color }}
                                        >
                                            {catInfo?.label ?? tx.category}
                                        </span>
                                    )}
                                </td>
                                <td className="tx-amount tx-amount--out">
                                    {sent.map((t) => {
                                        const transferIndex = tx.transfers.indexOf(t);
                                        const hasRate = t.rate > 0;
                                        return (
                                            <div key={transferIndex} className="tx-transfer-row">
                                                <span>
                                                    {t.token.tokenId
                                                        ? `${t.token.symbol} #${t.token.tokenId}`
                                                        : `${formatAmount(t.amount)} ${t.token.symbol}`}
                                                </span>
                                                {!hasRate && onPatchRate && (
                                                    <PriceInput
                                                        onCommit={(price) =>
                                                            onPatchRate(tx.hash, tx.chain, transferIndex, price)
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </td>
                                <td className="tx-amount tx-amount--in">
                                    {received.map((t) => {
                                        const transferIndex = tx.transfers.indexOf(t);
                                        const hasRate = t.rate > 0;
                                        return (
                                            <div key={transferIndex} className="tx-transfer-row">
                                                <span>
                                                    {t.token.tokenId
                                                        ? `${t.token.symbol} #${t.token.tokenId}`
                                                        : `${formatAmount(t.amount)} ${t.token.symbol}`}
                                                </span>
                                                {!hasRate && onPatchRate && (
                                                    <PriceInput
                                                        onCommit={(price) =>
                                                            onPatchRate(tx.hash, tx.chain, transferIndex, price)
                                                        }
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </td>
                                <td className="tx-fee">{formatFiat(tx.gasFeesUsd, currency)}</td>
                                <td className="tx-counterparty">
                                    {tx.counterpartyLabel ?? shortenAddress(tx.counterparty)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
            {totalPages > 1 && (
                <div className="tx-pagination">
                    <button className="btn btn--secondary" onClick={() => setPage((p) => p - 1)} disabled={page === 0}>
                        ← Prev
                    </button>
                    <span className="tx-pagination-info">
                        Page {page + 1} of {totalPages} ({transactions.length} rows)
                    </span>
                    <button
                        className="btn btn--secondary"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page === totalPages - 1}
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
