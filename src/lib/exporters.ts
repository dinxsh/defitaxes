import { CATEGORY_INFO } from "./categories";
import type { TaxEvent, TaxReport, Transaction } from "./types";
import { formatAmount, formatDateIrs, toCsv, downloadFile } from "./utils";

/** Shared row builder for Form 8949 — includes IRS Box, Adjustment Code, Adjustment Amount */
function taxEventToRow(e: TaxEvent, box: "C" | "F"): string[] {
    const adjCode = e.washSale ? "W" : "";
    const adjAmount = e.washSale ? Math.abs(e.gainLoss).toFixed(2) : "";
    return [
        e.description,
        formatDateIrs(e.dateAcquired),
        formatDateIrs(e.dateSold),
        e.proceeds.toFixed(2),
        e.costBasis.toFixed(2),
        adjCode,
        adjAmount,
        e.gainLoss.toFixed(2),
        box,
        e.costBasis === 0 && e.proceeds > 0 ? "Missing Price" : "",
    ];
}

const FORM_8949_HEADERS = [
    "Description of Property",
    "Date Acquired",
    "Date Sold",
    "Proceeds",
    "Cost or Other Basis",
    "Adjustment Code",
    "Adjustment Amount",
    "Gain or (Loss)",
    "Box",
    "Notes",
];

export function exportForm8949ShortTerm(report: TaxReport, filename = "form-8949-part-i-short-term.csv"): void {
    const rows = report.shortTermEvents.map((e) => taxEventToRow(e, "C"));
    downloadFile(toCsv(FORM_8949_HEADERS, rows), filename);
}

export function exportForm8949LongTerm(report: TaxReport, filename = "form-8949-part-ii-long-term.csv"): void {
    const rows = report.longTermEvents.map((e) => taxEventToRow(e, "F"));
    downloadFile(toCsv(FORM_8949_HEADERS, rows), filename);
}

export function exportForm8949(report: TaxReport, filename = "form-8949.csv"): void {
    const rows = [
        ...report.shortTermEvents.map((e) => taxEventToRow(e, "C")),
        ...report.longTermEvents.map((e) => taxEventToRow(e, "F")),
    ];
    downloadFile(toCsv(FORM_8949_HEADERS, rows), filename);
}

/** Export Schedule D as structured IRS-aligned CSV */
export function exportScheduleD(report: TaxReport, filename = "schedule-d-summary.csv"): void {
    const stProceeds = report.shortTermEvents.reduce((s, e) => s + e.proceeds, 0);
    const stBasis = report.shortTermEvents.reduce((s, e) => s + e.costBasis, 0);
    const ltProceeds = report.longTermEvents.reduce((s, e) => s + e.proceeds, 0);
    const ltBasis = report.longTermEvents.reduce((s, e) => s + e.costBasis, 0);
    const net = report.totalShortTermGain + report.totalLongTermGain;

    const headers = ["Section", "Line", "Description", "Proceeds", "Cost Basis", "Gain or (Loss)"];
    const rows: string[][] = [
        // Part I — Short-Term
        [
            "Part I",
            "1a",
            "Totals for all short-term transactions reported on Form 1099-B",
            stProceeds.toFixed(2),
            stBasis.toFixed(2),
            report.totalShortTermGain.toFixed(2),
        ],
        ["Part I", "1b", "Totals for all transactions where basis was NOT reported to IRS", "", "", ""],
        ["Part I", "2", "Totals for all short-term transactions reported on Form 1099-B (basis reported)", "", "", ""],
        ["Part I", "3", "Short-term gain from Form 6252", "", "", ""],
        [
            "Part I",
            "7",
            "Net short-term capital gain or (loss)",
            stProceeds.toFixed(2),
            stBasis.toFixed(2),
            report.totalShortTermGain.toFixed(2),
        ],
        // Part II — Long-Term
        [
            "Part II",
            "8a",
            "Totals for all long-term transactions reported on Form 1099-B",
            ltProceeds.toFixed(2),
            ltBasis.toFixed(2),
            report.totalLongTermGain.toFixed(2),
        ],
        ["Part II", "8b", "Totals for all transactions where basis was NOT reported to IRS", "", "", ""],
        ["Part II", "9", "Long-term gain from installment sales", "", "", ""],
        [
            "Part II",
            "15",
            "Net long-term capital gain or (loss)",
            ltProceeds.toFixed(2),
            ltBasis.toFixed(2),
            report.totalLongTermGain.toFixed(2),
        ],
        // Part III — Summary
        [
            "Part III",
            "16",
            "Combine lines 7 and 15 — Net capital gain or (loss)",
            (stProceeds + ltProceeds).toFixed(2),
            (stBasis + ltBasis).toFixed(2),
            net.toFixed(2),
        ],
    ];

    downloadFile(toCsv(headers, rows), filename, "text/csv");
}

/** Export TurboTax-compatible CSV */
export function exportTurboTax(report: TaxReport, filename = "turbotax-import.csv"): void {
    const headers = ["Currency Name", "Purchase Date", "Cost Basis", "Date Sold", "Proceeds"];

    const allEvents = [...report.shortTermEvents, ...report.longTermEvents];

    // TurboTax has a 3999-row limit per file
    const BATCH_SIZE = 3999;
    if (allEvents.length <= BATCH_SIZE) {
        const rows = allEvents.map((e) => [
            e.token,
            formatDateIrs(e.dateAcquired),
            e.costBasis.toFixed(2),
            formatDateIrs(e.dateSold),
            e.proceeds.toFixed(2),
        ]);
        downloadFile(toCsv(headers, rows), filename);
    } else {
        // Multiple files — just do the first batch for now
        for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
            const batch = allEvents.slice(i, i + BATCH_SIZE);
            const rows = batch.map((e) => [
                e.token,
                formatDateIrs(e.dateAcquired),
                e.costBasis.toFixed(2),
                formatDateIrs(e.dateSold),
                e.proceeds.toFixed(2),
            ]);
            const part = Math.floor(i / BATCH_SIZE) + 1;
            downloadFile(toCsv(headers, rows), filename.replace(".csv", `-part${part}.csv`));
        }
    }
}

/** Export full classified transaction list */
export function exportTransactions(transactions: Transaction[], filename = "transactions.csv"): void {
    const headers = [
        "Date",
        "Chain",
        "Tx Hash",
        "Category",
        "Counterparty",
        "Gas Fee (USD)",
        "Transfers",
        "Missing Price",
    ];

    const rows = transactions.map((tx) => {
        const transferStr = tx.transfers
            .map((t) => `${t.bucket}: ${formatAmount(t.amount)} ${t.token.symbol} (${t.treatment})`)
            .join("; ");

        return [
            tx.timestamp.toISOString(),
            tx.chain,
            tx.hash,
            CATEGORY_INFO[tx.category]?.label ?? tx.category,
            tx.counterpartyLabel ?? tx.counterparty,
            tx.gasFeesUsd.toFixed(2),
            transferStr,
            tx.transfers.some((t) => t.rate === 0 && t.amount > 0) ? "YES" : "",
        ];
    });

    downloadFile(toCsv(headers, rows), filename);
}
