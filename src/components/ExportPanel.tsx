import {
    exportForm8949ShortTerm,
    exportForm8949LongTerm,
    exportScheduleD,
    exportTurboTax,
    exportTransactions,
} from "../lib/exporters";
import { openPdfReport } from "../lib/pdfReport";
import type { CostBasisMethod, ImportedLotInput, TaxReport, Transaction } from "../lib/types";
import { Download, FileText, Upload } from "lucide-react";
import { useState } from "react";

interface ExportPanelProps {
    report: TaxReport;
    transactions: Transaction[];
    importedLotCount: number;
    costBasisMethod: CostBasisMethod;
    taxYear: number | null;
    onImportLots: (lots: ImportedLotInput[]) => void;
    onClearImportedLots: () => void;
}

export function ExportPanel({
    report,
    transactions,
    importedLotCount,
    costBasisMethod,
    taxYear,
    onImportLots,
    onClearImportedLots,
}: ExportPanelProps) {
    const hasEvents = report.shortTermEvents.length + report.longTermEvents.length > 0;
    const [importFeedback, setImportFeedback] = useState<{ accepted: number; skipped: number } | null>(null);

    async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        setImportFeedback(null);
        try {
            const text = await file.text();
            const data = JSON.parse(text) as unknown;
            if (!Array.isArray(data)) {
                alert("Import file must be a JSON array.");
                e.target.value = "";
                return;
            }
            const valid: ImportedLotInput[] = [];
            let skipped = 0;
            for (const item of data) {
                const row = item as Record<string, unknown>;
                if (
                    typeof row.token === "string" &&
                    row.token.trim() !== "" &&
                    typeof row.chain === "string" &&
                    row.chain.trim() !== "" &&
                    typeof row.amount === "number" &&
                    row.amount > 0 &&
                    typeof row.costBasisPerUnit === "number" &&
                    row.costBasisPerUnit >= 0 &&
                    typeof row.date === "string" &&
                    /^\d{4}-\d{2}-\d{2}$/.test(row.date)
                ) {
                    valid.push(row as unknown as ImportedLotInput);
                } else {
                    skipped++;
                }
            }
            onImportLots(valid);
            setImportFeedback({ accepted: valid.length, skipped });
        } catch {
            alert("Failed to parse import file. Make sure it is valid JSON.");
        }
        // reset so same file can be re-imported
        e.target.value = "";
    }

    return (
        <div className="export-panel">
            <div className="export-panel-title">Export Reports</div>
            <div className="export-buttons">
                <button
                    className="btn btn--export btn--export-pdf"
                    onClick={() => openPdfReport(report, costBasisMethod, taxYear)}
                    disabled={report.shortTermEvents.length + report.longTermEvents.length + report.income.length === 0}
                    title="Open print/PDF view in new tab"
                >
                    <FileText size={14} />
                    PDF Report
                </button>
                <button
                    className="btn btn--export"
                    onClick={() => exportForm8949ShortTerm(report)}
                    disabled={report.shortTermEvents.length === 0}
                >
                    <Download size={14} />
                    Form 8949 Part I (Short-Term)
                </button>
                <button
                    className="btn btn--export"
                    onClick={() => exportForm8949LongTerm(report)}
                    disabled={report.longTermEvents.length === 0}
                >
                    <Download size={14} />
                    Form 8949 Part II (Long-Term)
                </button>
                <button className="btn btn--export" onClick={() => exportScheduleD(report)} disabled={!hasEvents}>
                    <Download size={14} />
                    Schedule D Summary
                </button>
                <button className="btn btn--export" onClick={() => exportTurboTax(report)} disabled={!hasEvents}>
                    <Download size={14} />
                    TurboTax CSV
                </button>
                <button
                    className="btn btn--export"
                    onClick={() => exportTransactions(transactions)}
                    disabled={transactions.length === 0}
                >
                    <Download size={14} />
                    All Transactions
                </button>
            </div>
            <div className="import-section">
                <label className="btn btn--secondary" style={{ cursor: "pointer" }}>
                    <Upload size={14} />
                    Import Cost Basis JSON
                    {importedLotCount > 0 && <span className="import-badge">{importedLotCount} lots</span>}
                    <input type="file" accept=".json" style={{ display: "none" }} onChange={handleImportFile} />
                </label>
                {importedLotCount > 0 && (
                    <button
                        className="btn btn--secondary"
                        onClick={() => {
                            onClearImportedLots();
                            setImportFeedback(null);
                        }}
                    >
                        Clear
                    </button>
                )}
            </div>
            {importFeedback && (
                <div className="import-feedback">
                    {importFeedback.accepted} lot{importFeedback.accepted !== 1 ? "s" : ""} imported
                    {importFeedback.skipped > 0 && (
                        <span className="import-feedback--skipped">
                            {" "}
                            · {importFeedback.skipped} row{importFeedback.skipped !== 1 ? "s" : ""} skipped (invalid)
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
