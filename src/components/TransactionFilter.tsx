import type { Transaction } from "../lib/types";

interface TransactionFilterProps {
    transactions: Transaction[];
    categoryFilter: string;
    chainFilter: string;
    onCategoryChange: (v: string) => void;
    onChainChange: (v: string) => void;
}

export function TransactionFilter({
    transactions,
    categoryFilter,
    chainFilter,
    onCategoryChange,
    onChainChange,
}: TransactionFilterProps) {
    const categories = Array.from(new Set(transactions.map((t) => t.category))).sort();
    const chains = Array.from(new Set(transactions.map((t) => t.chain))).sort();

    return (
        <div className="tx-filter">
            <select
                className="tx-filter-select"
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
            >
                <option value="">All Categories</option>
                {categories.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
            <select className="tx-filter-select" value={chainFilter} onChange={(e) => onChainChange(e.target.value)}>
                <option value="">All Chains</option>
                {chains.map((c) => (
                    <option key={c} value={c}>
                        {c}
                    </option>
                ))}
            </select>
        </div>
    );
}
