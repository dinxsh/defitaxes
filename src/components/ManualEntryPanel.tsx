import { CHAINS } from "../lib/chains";
import type { Category, Transaction, Treatment } from "../lib/types";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";

interface ManualEntryPanelProps {
    manualTransactions: Transaction[];
    onAdd: (tx: Transaction) => void;
    onRemove: (hash: string) => void;
    onClear: () => void;
}

type EntryType = "buy" | "sell" | "income";

const ENTRY_LABEL: Record<EntryType, string> = { buy: "Buy", sell: "Sell", income: "Income" };
const ENTRY_TREATMENT: Record<EntryType, Treatment> = { buy: "buy", sell: "sell", income: "income" };
const ENTRY_CATEGORY: Record<EntryType, Category> = {
    buy: "TRANSFER_IN",
    sell: "TRANSFER_OUT",
    income: "INCOME",
};
const CHAIN_OPTIONS = Object.values(CHAINS).map((c) => ({ value: c.chainName, label: c.displayName }));

export function ManualEntryPanel({ manualTransactions, onAdd, onRemove, onClear }: ManualEntryPanelProps) {
    const [open, setOpen] = useState(false);
    const [entryType, setEntryType] = useState<EntryType>("buy");
    const [symbol, setSymbol] = useState("");
    const [amount, setAmount] = useState("");
    const [price, setPrice] = useState("");
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
    const [chain, setChain] = useState("eth-mainnet");

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const amt = parseFloat(amount);
        const rate = parseFloat(price) || 0;
        if (!symbol.trim() || !amt || amt <= 0 || !date) return;

        const sym = symbol.trim().toUpperCase();
        const treatment = ENTRY_TREATMENT[entryType];
        const bucket = entryType === "sell" ? ("SENT" as const) : ("RECEIVED" as const);
        const category = ENTRY_CATEGORY[entryType];
        const chainConfig = CHAINS[chain];

        const tx: Transaction = {
            hash: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            timestamp: new Date(`${date}T12:00:00`),
            chain,
            chainDisplayName: chainConfig?.displayName ?? chain,
            blockHeight: 0,
            transfers: [
                {
                    from: entryType === "sell" ? "manual" : "",
                    to: entryType === "sell" ? "" : "manual",
                    amount: amt,
                    token: {
                        contractAddress: sym.toLowerCase(),
                        symbol: sym,
                        decimals: 18,
                        name: sym,
                    },
                    rate,
                    treatment,
                    bucket,
                },
            ],
            category,
            counterparty: "",
            counterpartyLabel: null,
            gasFeeNative: 0,
            gasFeesUsd: 0,
            successful: true,
            rawMethodId: "",
        };

        onAdd(tx);
        setSymbol("");
        setAmount("");
        setPrice("");
    }

    return (
        <div className="manual-entry-panel">
            <div className="manual-entry-header">
                <span className="manual-entry-title">Manual Transactions</span>
                {manualTransactions.length > 0 && <span className="import-badge">{manualTransactions.length}</span>}
                {manualTransactions.length > 0 && (
                    <button className="btn btn--secondary" onClick={onClear} title="Remove all manual transactions">
                        Clear all
                    </button>
                )}
                <button className="btn btn--secondary" onClick={() => setOpen((o) => !o)}>
                    {open ? "Hide" : "+ Add"}
                </button>
            </div>

            {open && (
                <form className="manual-entry-form" onSubmit={handleSubmit}>
                    <div className="manual-entry-row">
                        <select
                            className="manual-field manual-field--type"
                            value={entryType}
                            onChange={(e) => setEntryType(e.target.value as EntryType)}
                        >
                            {(Object.keys(ENTRY_LABEL) as EntryType[]).map((t) => (
                                <option key={t} value={t}>
                                    {ENTRY_LABEL[t]}
                                </option>
                            ))}
                        </select>
                        <select
                            className="manual-field manual-field--chain"
                            value={chain}
                            onChange={(e) => setChain(e.target.value)}
                        >
                            {CHAIN_OPTIONS.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                        <input
                            className="manual-field manual-field--symbol"
                            type="text"
                            placeholder="Symbol (e.g. ETH)"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value)}
                            required
                        />
                        <input
                            className="manual-field manual-field--number"
                            type="number"
                            placeholder="Amount"
                            min="0"
                            step="any"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            required
                        />
                        <input
                            className="manual-field manual-field--number"
                            type="number"
                            placeholder="Price (USD)"
                            min="0"
                            step="any"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                        />
                        <input
                            className="manual-field manual-field--date"
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            required
                        />
                        <button className="btn btn--primary manual-submit" type="submit">
                            <Plus size={13} />
                            Add
                        </button>
                    </div>
                </form>
            )}

            {manualTransactions.length > 0 && (
                <table className="manual-entry-list">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Asset</th>
                            <th>Amount</th>
                            <th>Price</th>
                            <th>Chain</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {manualTransactions.map((tx) => {
                            const t = tx.transfers[0];
                            if (!t) return null;
                            const typeLabel =
                                t.treatment === "buy" ? "Buy" : t.treatment === "sell" ? "Sell" : "Income";
                            return (
                                <tr key={tx.hash}>
                                    <td>{tx.timestamp.toLocaleDateString()}</td>
                                    <td>{typeLabel}</td>
                                    <td>{t.token.symbol}</td>
                                    <td>{t.amount}</td>
                                    <td>{t.rate > 0 ? `$${t.rate}` : "—"}</td>
                                    <td>{tx.chainDisplayName}</td>
                                    <td>
                                        <button className="btn-icon" title="Remove" onClick={() => onRemove(tx.hash)}>
                                            <Trash2 size={12} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}
