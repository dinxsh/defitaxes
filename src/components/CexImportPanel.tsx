import { parseCexCsv } from "../lib/cexParsers";
import type { Transaction } from "../lib/types";
import { Upload, X } from "lucide-react";
import { useRef, useState } from "react";

interface CexImportPanelProps {
    cexTransactions: Transaction[];
    onAdd: (txs: Transaction[]) => void;
    onClear: () => void;
}

const EXCHANGE_DOCS: Record<string, string> = {
    Coinbase: "Account → Statements → Generate Report → CSV",
    Binance: "Orders → Trade History → Export (CSV) or Account → Transaction History",
    Kraken: "History → Ledgers → Export Ledger History",
    Gemini: "Account → Transaction History → Download",
};

interface ImportResult {
    exchange: string;
    count: number;
    file: string;
}

export function CexImportPanel({ cexTransactions, onAdd, onClear }: CexImportPanelProps) {
    const [results, setResults] = useState<ImportResult[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const byExchange = cexTransactions.reduce<Record<string, number>>((acc, tx) => {
        const ex = tx.chainDisplayName;
        acc[ex] = (acc[ex] ?? 0) + 1;
        return acc;
    }, {});

    async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setError(null);

        const newResults: ImportResult[] = [];
        const allTxs: Transaction[] = [];

        for (const file of files) {
            const text = await file.text();
            const result = parseCexCsv(text);
            if (!result) {
                setError(
                    `Could not detect exchange format in "${file.name}". ` +
                        `Supported: Coinbase, Binance (Trade History or Statement), Kraken (Ledger), Gemini.`
                );
                continue;
            }
            allTxs.push(...result.transactions);
            newResults.push({ exchange: result.exchange, count: result.transactions.length, file: file.name });
        }

        if (allTxs.length > 0) {
            onAdd(allTxs);
            setResults((prev) => [...prev, ...newResults]);
        }

        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    return (
        <div className="cex-import-panel">
            <div className="cex-import-header">
                <span className="cex-import-title">CEX Import</span>
                <span className="cex-import-exchanges">Coinbase · Binance · Kraken · Gemini</span>
                {cexTransactions.length > 0 && <span className="import-badge">{cexTransactions.length} txs</span>}
                <button
                    className="btn-icon"
                    title="How to export"
                    onClick={() => setShowHelp((s) => !s)}
                    style={{ marginLeft: "auto" }}
                >
                    ?
                </button>
                {cexTransactions.length > 0 && (
                    <button
                        className="btn btn--secondary"
                        onClick={() => {
                            onClear();
                            setResults([]);
                        }}
                    >
                        Clear all
                    </button>
                )}
                <label className="btn btn--secondary cex-upload-btn" style={{ cursor: "pointer" }}>
                    <Upload size={13} />
                    Import CSV
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        multiple
                        style={{ display: "none" }}
                        onChange={handleFiles}
                    />
                </label>
            </div>

            {showHelp && (
                <div className="cex-help">
                    {Object.entries(EXCHANGE_DOCS).map(([ex, path]) => (
                        <div key={ex} className="cex-help-row">
                            <span className="cex-help-name">{ex}</span>
                            <span className="cex-help-path">{path}</span>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div className="cex-error">
                    <X size={12} />
                    {error}
                </div>
            )}

            {results.length > 0 && (
                <div className="cex-results">
                    {results.map((r, i) => (
                        <span key={i} className="cex-result-badge">
                            {r.exchange}: {r.count} txs from {r.file}
                        </span>
                    ))}
                </div>
            )}

            {Object.keys(byExchange).length > 0 && (
                <div className="cex-summary">
                    {Object.entries(byExchange).map(([ex, count]) => (
                        <span key={ex} className="cex-summary-item">
                            {ex}: {count}
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}
