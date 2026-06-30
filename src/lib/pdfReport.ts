import type { CostBasisMethod, IncomeEvent, TaxEvent, TaxReport } from "./types";
import { formatAmount, formatDateIrs } from "./utils";

function fmt(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return `$${value.toFixed(2)}`;
    }
}

function gainClass(v: number): string {
    return v >= 0 ? "gain" : "loss";
}

function eventRows(events: TaxEvent[], currency: string): string {
    if (events.length === 0) return `<tr><td colspan="6" class="empty">No events</td></tr>`;
    return events
        .map(
            (e) => `
        <tr>
            <td>${e.description}${e.washSale ? ' <span class="ws-badge">W</span>' : ""}</td>
            <td>${formatDateIrs(e.dateAcquired)}</td>
            <td>${formatDateIrs(e.dateSold)}</td>
            <td class="num">${fmt(e.proceeds, currency)}</td>
            <td class="num">${fmt(e.costBasis, currency)}</td>
            <td class="num ${gainClass(e.gainLoss)}">${fmt(e.gainLoss, currency)}</td>
        </tr>`
        )
        .join("");
}

function incomeRows(events: IncomeEvent[], currency: string): string {
    if (events.length === 0) return `<tr><td colspan="4" class="empty">No income events</td></tr>`;
    return events
        .map(
            (e) => `
        <tr>
            <td>${formatDateIrs(e.date)}</td>
            <td>${e.description}</td>
            <td class="num">${formatAmount(e.amount)}</td>
            <td class="num gain">${fmt(e.fairMarketValueUsd, currency)}</td>
        </tr>`
        )
        .join("");
}

export function openPdfReport(report: TaxReport, method: CostBasisMethod, taxYear: number | null): void {
    const netGain = report.totalShortTermGain + report.totalLongTermGain;
    const yearLabel = taxYear ? String(taxYear) : "All Years";
    const generatedAt = new Date().toLocaleString();

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>DeFi Tax Report — ${yearLabel}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #111;
    margin: 15mm 18mm;
    line-height: 1.4;
  }
  h1 { font-size: 15pt; font-weight: 700; margin-bottom: 2mm; }
  h2 {
    font-size: 10pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin: 7mm 0 2mm;
    padding-bottom: 1mm;
    border-bottom: 1pt solid #333;
  }
  .meta { font-size: 8pt; color: #555; margin-bottom: 6mm; }
  .disclaimer {
    font-size: 7.5pt;
    color: #888;
    border: 0.5pt solid #ccc;
    padding: 2mm 3mm;
    margin-bottom: 7mm;
  }
  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 4mm;
    margin-bottom: 6mm;
  }
  .summary-card {
    border: 0.5pt solid #ccc;
    padding: 3mm 4mm;
  }
  .summary-label { font-size: 7.5pt; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
  .summary-value { font-size: 13pt; font-weight: 700; margin-top: 1mm; }
  .summary-count { font-size: 7pt; color: #888; margin-top: 0.5mm; }
  .net-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    border-top: 1pt solid #333;
    border-bottom: 1pt solid #333;
    padding: 2.5mm 0;
    margin-bottom: 6mm;
    font-weight: 700;
    font-size: 11pt;
  }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6mm; font-size: 8.5pt; }
  th {
    text-align: left;
    font-weight: 600;
    letter-spacing: 0.04em;
    font-size: 7.5pt;
    text-transform: uppercase;
    padding: 2mm 2.5mm;
    background: #f5f5f5;
    border-bottom: 0.5pt solid #bbb;
  }
  td { padding: 1.5mm 2.5mm; border-bottom: 0.3pt solid #e5e5e5; }
  tr:last-child td { border-bottom: none; }
  .num { text-align: right; }
  .gain { color: #16a34a; }
  .loss { color: #dc2626; }
  .empty { color: #888; font-style: italic; text-align: center; padding: 4mm; }
  .ws-badge {
    display: inline-block;
    font-size: 6.5pt;
    font-weight: 700;
    background: #fef3c7;
    color: #92400e;
    border: 0.5pt solid #d97706;
    padding: 0 1.5mm;
    border-radius: 1pt;
    vertical-align: middle;
    margin-left: 1.5mm;
  }
  .warnings { margin-bottom: 6mm; }
  .warning-item {
    font-size: 8pt;
    color: #92400e;
    background: #fffbeb;
    border: 0.5pt solid #f59e0b;
    padding: 2mm 3mm;
    margin-bottom: 2mm;
  }
  @media print {
    body { margin: 10mm 12mm; }
    @page { margin: 0; }
  }
</style>
</head>
<body>

<h1>DeFi Tax Report</h1>
<div class="meta">
  Year: <strong>${yearLabel}</strong> &nbsp;|&nbsp;
  Currency: <strong>${report.currency}</strong> &nbsp;|&nbsp;
  Method: <strong>${method}</strong> &nbsp;|&nbsp;
  Generated: ${generatedAt}
</div>
<div class="disclaimer">
  <strong>Not tax advice.</strong> This report is generated from on-chain data and is for informational
  purposes only. It does not constitute tax, legal, or financial advice. Tax laws vary by jurisdiction.
  Always consult a qualified tax professional before filing.
</div>

<h2>Summary</h2>
<div class="summary-grid">
  <div class="summary-card">
    <div class="summary-label">Short-Term Gain/Loss</div>
    <div class="summary-value ${gainClass(report.totalShortTermGain)}">${fmt(report.totalShortTermGain, report.currency)}</div>
    <div class="summary-count">${report.shortTermEvents.length} events</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Long-Term Gain/Loss</div>
    <div class="summary-value ${gainClass(report.totalLongTermGain)}">${fmt(report.totalLongTermGain, report.currency)}</div>
    <div class="summary-count">${report.longTermEvents.length} events</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Ordinary Income</div>
    <div class="summary-value">${fmt(report.totalIncome, report.currency)}</div>
    <div class="summary-count">${report.income.length} events</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Gas Fees Paid</div>
    <div class="summary-value loss">${fmt(report.totalFees, report.currency)}</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Wash Sales Flagged</div>
    <div class="summary-value">${report.washSaleCount}</div>
    <div class="summary-count">${fmt(report.washSaleDisallowedLoss, report.currency)} flagged (advisory)</div>
  </div>
  <div class="summary-card">
    <div class="summary-label">Unknown Basis Events</div>
    <div class="summary-value">${report.unknownBasisCount}</div>
    <div class="summary-count">${fmt(report.unknownBasisValueAtRisk, report.currency)} at risk</div>
  </div>
</div>
<div class="net-row">
  <span>Net Capital Gain / Loss</span>
  <span class="${gainClass(netGain)}">${fmt(netGain, report.currency)}</span>
</div>

${
    report.washSaleCount > 0 || report.unknownBasisCount > 0 || report.zeroRateTransferCount > 0
        ? `<div class="warnings">
  ${report.washSaleCount > 0 ? `<div class="warning-item">⚠ ${report.washSaleCount} potential wash sale(s) flagged — ${fmt(report.washSaleDisallowedLoss, report.currency)} in losses. Advisory only: crypto is generally not subject to IRC §1091 under current US law, so these losses remain deductible.</div>` : ""}
  ${report.unknownBasisCount > 0 && report.unknownBasisValueAtRisk >= 0.01 ? `<div class="warning-item">⚠ ${report.unknownBasisCount} event(s) with unknown cost basis — ${fmt(report.unknownBasisValueAtRisk, report.currency)} proceeds may be over-reported.</div>` : ""}
  ${report.zeroRateTransferCount > 0 ? `<div class="warning-item">⚠ ${report.zeroRateTransferCount} transfer(s) with missing price data — cost basis may be understated.</div>` : ""}
</div>`
        : ""
}

<h2>Form 8949 — Part I: Short-Term Capital Gains and Losses</h2>
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Date Acquired</th>
      <th>Date Sold</th>
      <th class="num">Proceeds</th>
      <th class="num">Cost Basis</th>
      <th class="num">Gain / Loss</th>
    </tr>
  </thead>
  <tbody>${eventRows(report.shortTermEvents, report.currency)}</tbody>
</table>

<h2>Form 8949 — Part II: Long-Term Capital Gains and Losses</h2>
<table>
  <thead>
    <tr>
      <th>Description</th>
      <th>Date Acquired</th>
      <th>Date Sold</th>
      <th class="num">Proceeds</th>
      <th class="num">Cost Basis</th>
      <th class="num">Gain / Loss</th>
    </tr>
  </thead>
  <tbody>${eventRows(report.longTermEvents, report.currency)}</tbody>
</table>

<h2>Ordinary Income</h2>
<table>
  <thead>
    <tr>
      <th>Date</th>
      <th>Description</th>
      <th class="num">Amount</th>
      <th class="num">Fair Market Value</th>
    </tr>
  </thead>
  <tbody>${incomeRows(report.income, report.currency)}</tbody>
</table>

</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
        alert("Pop-up blocked. Please allow pop-ups for this site and try again.");
        return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    // Give browser time to render before triggering print
    setTimeout(() => win.print(), 300);
}
