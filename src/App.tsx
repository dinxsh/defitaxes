import { CexImportPanel } from "./components/CexImportPanel";
import { ExportPanel } from "./components/ExportPanel";
import { ManualEntryPanel } from "./components/ManualEntryPanel";
import { MultiWalletInput } from "./components/MultiWalletInput";
import { ProcessingStatus } from "./components/ProcessingStatus";
import { TaxSummary } from "./components/TaxSummary";
import { TransactionFilter } from "./components/TransactionFilter";
import { TransactionTable } from "./components/TransactionTable";
import { useCategoryOverrides } from "./hooks/useCategoryOverrides";
import { useCexImport } from "./hooks/useCexImport";
import { useGoldRush } from "./hooks/useGoldRush";
import { useImportedLots } from "./hooks/useImportedLots";
import { useManualTransactions } from "./hooks/useManualTransactions";
import { useProcessing } from "./hooks/useProcessing";
import { useResultCache } from "./hooks/useResultCache";
import type { CachedResult } from "./hooks/useResultCache";
import { useTaxYear } from "./hooks/useTaxYear";
import { applyTreatments } from "./lib/classifier";
import type { CostBasisMethod } from "./lib/types";
import { useState, useEffect, useMemo } from "react";

const SUPPORTED_CURRENCIES = [
    { code: "USD", label: "USD — US Dollar" },
    { code: "EUR", label: "EUR — Euro" },
    { code: "GBP", label: "GBP — British Pound" },
    { code: "CAD", label: "CAD — Canadian Dollar" },
    { code: "AUD", label: "AUD — Australian Dollar" },
    { code: "CHF", label: "CHF — Swiss Franc" },
    { code: "JPY", label: "JPY — Japanese Yen" },
];

export default function App() {
    const client = useGoldRush();
    const [currency, setCurrency] = useState("USD");
    const { state, transactions, start, reset, patchTransferRate } = useProcessing(client);

    const { save, load, clear } = useResultCache();
    const [cachedResult, setCachedResult] = useState<CachedResult | null>(null);
    const [walletInputs, setWalletInputs] = useState<string[]>([]);
    const [pendingCache, setPendingCache] = useState<CachedResult | null>(null);

    const { overrides, setOverride, clearOverride, clearAllOverrides } = useCategoryOverrides();
    const [costBasisMethod, setCostBasisMethod] = useState<CostBasisMethod>("FIFO");
    const { manualTransactions, addManualTransaction, removeManualTransaction, clearManualTransactions } =
        useManualTransactions();
    const { cexTransactions, addCexTransactions, clearCexTransactions } = useCexImport();

    const rawTransactions = cachedResult ? cachedResult.transactions : transactions;
    const extraTransactions = [...manualTransactions, ...cexTransactions];
    const baseTransactions =
        extraTransactions.length > 0 ? [...rawTransactions, ...extraTransactions] : rawTransactions;
    const activeTransactions = useMemo(
        () =>
            overrides.size === 0
                ? baseTransactions
                : baseTransactions.map((tx) => {
                      const ov = overrides.get(tx.hash);
                      if (!ov) return tx;
                      const newTransfers = tx.transfers.map((t) => ({ ...t }));
                      applyTreatments(newTransfers, ov);
                      return { ...tx, category: ov, transfers: newTransfers };
                  }),
        [baseTransactions, overrides]
    );

    const { importedLots, importLots, clearImportedLots } = useImportedLots();

    const { taxYear, availableYears, filteredTransactions, report, selectYear } = useTaxYear(
        activeTransactions,
        currency,
        importedLots,
        costBasisMethod
    );

    const [categoryFilter, setCategoryFilter] = useState("");
    const [chainFilter, setChainFilter] = useState("");
    const [zeroRateOnly, setZeroRateOnly] = useState(false);

    useEffect(() => {
        setCategoryFilter("");
        setChainFilter("");
        setZeroRateOnly(false);
    }, [filteredTransactions]);

    // Save to cache when processing completes
    useEffect(() => {
        if (state.step === "done" && transactions.length > 0 && walletInputs.length === 1) {
            save(walletInputs[0]!, currency, transactions);
        }
    }, [state.step, transactions, walletInputs, currency, save]);

    // Check for pending cache when wallet input / currency / step changes
    useEffect(() => {
        if (walletInputs.length === 1 && state.step === "idle" && cachedResult === null) {
            setPendingCache(load(walletInputs[0]!, currency));
        } else {
            setPendingCache(null);
        }
    }, [walletInputs, state.step, currency, cachedResult, load]);

    const displayTransactions = filteredTransactions.filter((tx) => {
        if (categoryFilter && tx.category !== categoryFilter) return false;
        if (chainFilter && tx.chain !== chainFilter) return false;
        if (zeroRateOnly && !tx.transfers.some((t) => t.rate === 0 && t.amount > 0)) return false;
        return true;
    });

    function handleStart(wallets: string[]) {
        setWalletInputs(wallets);
        setCachedResult(null);
        start(wallets, currency);
    }

    const isRunning = state.step !== "idle" && state.step !== "done";

    // Determine whether to show results (either from live run or from cache)
    const showResults = (state.step === "done" && !cachedResult) || cachedResult !== null;

    return (
        <div className="app">
            <header className="header">
                <div className="header-left">
                    <span className="header-title">DeFi Taxes</span>
                    <span className="header-badge">Agent Wallet Tax Reports</span>
                </div>
                <div className="header-right">
                    {cachedResult && (
                        <button
                            className="btn btn--cache"
                            onClick={() => {
                                clear(cachedResult.wallet, cachedResult.currency);
                                setCachedResult(null);
                                handleStart([cachedResult.wallet]);
                            }}
                        >
                            ↻ Refresh
                        </button>
                    )}
                    <select
                        className="currency-select"
                        value={costBasisMethod}
                        onChange={(e) => setCostBasisMethod(e.target.value as CostBasisMethod)}
                        title="Cost basis accounting method"
                    >
                        <option value="FIFO">FIFO</option>
                        <option value="LIFO">LIFO</option>
                        <option value="HIFO">HIFO</option>
                        <option value="ACB">ACB (Avg)</option>
                    </select>
                    <select
                        className="currency-select"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        disabled={isRunning}
                        title="Report currency — select before running"
                    >
                        {SUPPORTED_CURRENCIES.map((c) => (
                            <option key={c.code} value={c.code}>
                                {c.label}
                            </option>
                        ))}
                    </select>
                    {availableYears.length > 0 && (
                        <div className="year-selector">
                            <button
                                className={`year-btn ${taxYear === null ? "year-btn--active" : ""}`}
                                onClick={() => selectYear(null)}
                            >
                                All Years
                            </button>
                            {availableYears.map((y) => (
                                <button
                                    key={y}
                                    className={`year-btn ${taxYear === y ? "year-btn--active" : ""}`}
                                    onClick={() => selectYear(y)}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </header>

            <main className="main">
                <div className="disclaimer-banner">
                    <strong>Not tax advice.</strong> DeFi Taxes is a software tool for informational purposes only. It
                    does not constitute tax, legal, or financial advice. Tax laws vary by jurisdiction and change
                    frequently. Always consult a qualified tax professional before filing. The creators of this tool are
                    not liable for errors, omissions, or reliance on this output.
                </div>

                <MultiWalletInput onSubmit={handleStart} onReset={reset} step={state.step} />

                {pendingCache && (
                    <div className="cache-banner">
                        <span>
                            Cached results from {Math.round((Date.now() - pendingCache.cachedAt.getTime()) / 60000)}m
                            ago available.
                        </span>
                        <button
                            className="btn btn--cache"
                            onClick={() => pendingCache && setCachedResult(pendingCache)}
                        >
                            Load Cache
                        </button>
                        <button className="btn btn--primary" onClick={() => handleStart(walletInputs)}>
                            Refresh
                        </button>
                    </div>
                )}

                <ProcessingStatus state={state} />

                {showResults && report && (
                    <>
                        <TaxSummary
                            report={report}
                            onShowZeroRate={() => setZeroRateOnly(true)}
                            onShowUnknown={() => setCategoryFilter("UNKNOWN")}
                        />
                        <ExportPanel
                            report={report}
                            transactions={filteredTransactions}
                            importedLotCount={importedLots.length}
                            costBasisMethod={costBasisMethod}
                            taxYear={taxYear}
                            onImportLots={importLots}
                            onClearImportedLots={clearImportedLots}
                        />
                        <CexImportPanel
                            cexTransactions={cexTransactions}
                            onAdd={addCexTransactions}
                            onClear={clearCexTransactions}
                        />
                        <ManualEntryPanel
                            manualTransactions={manualTransactions}
                            onAdd={addManualTransaction}
                            onRemove={removeManualTransaction}
                            onClear={clearManualTransactions}
                        />
                        <div className="section">
                            <div className="section-header">
                                Transactions ({displayTransactions.length} of {filteredTransactions.length})
                                {zeroRateOnly && (
                                    <button
                                        className="btn btn--secondary"
                                        style={{ marginLeft: 8 }}
                                        onClick={() => setZeroRateOnly(false)}
                                    >
                                        ✕ Clear price filter
                                    </button>
                                )}
                                {overrides.size > 0 && (
                                    <button
                                        className="btn btn--secondary"
                                        style={{ marginLeft: 8 }}
                                        onClick={clearAllOverrides}
                                        title="Remove all manual category overrides"
                                    >
                                        ✕ Clear {overrides.size} override{overrides.size !== 1 ? "s" : ""}
                                    </button>
                                )}
                            </div>
                            <TransactionFilter
                                transactions={filteredTransactions}
                                categoryFilter={categoryFilter}
                                chainFilter={chainFilter}
                                onCategoryChange={setCategoryFilter}
                                onChainChange={setChainFilter}
                            />
                            <TransactionTable
                                transactions={displayTransactions}
                                currency={currency}
                                onPatchRate={patchTransferRate}
                                showWallet={walletInputs.length > 1}
                                onSetCategoryOverride={setOverride}
                                onClearCategoryOverride={clearOverride}
                                overrides={overrides}
                            />
                        </div>
                    </>
                )}
            </main>

            <footer className="footer-disclaimer">
                DeFi Taxes is not a tax advisor. Results are estimates based on on-chain data and may be incomplete.
                Consult a qualified tax professional. US-only export formats (Form 8949, Schedule D, TurboTax).
            </footer>
        </div>
    );
}
