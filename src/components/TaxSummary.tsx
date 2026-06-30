import type { TaxReport } from "../lib/types";
import { formatFiat } from "../lib/utils";

interface TaxSummaryProps {
    report: TaxReport;
    onShowZeroRate?: () => void;
    onShowUnknown?: () => void;
}

export function TaxSummary({ report, onShowZeroRate, onShowUnknown }: TaxSummaryProps) {
    const netGain = report.totalShortTermGain + report.totalLongTermGain;
    const fmt = (v: number) => formatFiat(v, report.currency);

    return (
        <div className="tax-summary">
            <div className="summary-cards">
                <div className="summary-card">
                    <div className="summary-card-label">Short-Term Gain/Loss</div>
                    <div className={`summary-card-value ${report.totalShortTermGain >= 0 ? "gain" : "loss"}`}>
                        {fmt(report.totalShortTermGain)}
                    </div>
                    <div className="summary-card-count">{report.shortTermEvents.length} events</div>
                </div>
                <div className="summary-card">
                    <div className="summary-card-label">Long-Term Gain/Loss</div>
                    <div className={`summary-card-value ${report.totalLongTermGain >= 0 ? "gain" : "loss"}`}>
                        {fmt(report.totalLongTermGain)}
                    </div>
                    <div className="summary-card-count">{report.longTermEvents.length} events</div>
                </div>
                <div className="summary-card">
                    <div className="summary-card-label">Ordinary Income</div>
                    <div className="summary-card-value">{fmt(report.totalIncome)}</div>
                    <div className="summary-card-count">{report.income.length} events</div>
                </div>
                <div className="summary-card">
                    <div className="summary-card-label">Gas Fees Paid</div>
                    <div className="summary-card-value loss">{fmt(report.totalFees)}</div>
                </div>
            </div>

            <div className="summary-net">
                <span className="summary-net-label">Net Capital Gain/Loss</span>
                <span className={`summary-net-value ${netGain >= 0 ? "gain" : "loss"}`}>{fmt(netGain)}</span>
            </div>

            {report.unknownBasisCount > 0 && report.unknownBasisValueAtRisk >= 0.01 && (
                <div className="unknown-basis-warning">
                    <strong>
                        ⚠ {report.unknownBasisCount} event{report.unknownBasisCount !== 1 ? "s" : ""} with unknown cost
                        basis
                    </strong>
                    <span>
                        {" "}
                        — {fmt(report.unknownBasisValueAtRisk)} proceeds may be over-reported as gains. These likely
                        represent tokens acquired before tracking began.
                    </span>
                </div>
            )}

            {report.zeroRateTransferCount > 0 && (
                <div
                    className={`zero-rate-warning${onShowZeroRate ? " zero-rate-warning--clickable" : ""}`}
                    onClick={onShowZeroRate}
                    role={onShowZeroRate ? "button" : undefined}
                    tabIndex={onShowZeroRate ? 0 : undefined}
                    onKeyDown={onShowZeroRate ? (e) => e.key === "Enter" && onShowZeroRate() : undefined}
                >
                    <strong>
                        ⚠ {report.zeroRateTransferCount} transfer{report.zeroRateTransferCount !== 1 ? "s" : ""} with no
                        price data
                    </strong>
                    <span>
                        {" "}
                        — cost basis and proceeds for these transfers could not be computed.
                        {onShowZeroRate ? " Click to filter." : " Export transactions CSV to identify them."}
                    </span>
                </div>
            )}

            {report.unknownTxCount > 0 && (
                <div
                    className={`unknown-tx-warning${onShowUnknown ? " unknown-tx-warning--clickable" : ""}`}
                    onClick={onShowUnknown}
                    role={onShowUnknown ? "button" : undefined}
                    tabIndex={onShowUnknown ? 0 : undefined}
                    onKeyDown={onShowUnknown ? (e) => e.key === "Enter" && onShowUnknown() : undefined}
                >
                    <strong>
                        ⚠ {report.unknownTxCount} unclassified transaction
                        {report.unknownTxCount !== 1 ? "s" : ""}
                    </strong>
                    <span>
                        {" "}
                        — these could not be automatically categorised and are excluded from tax calculations.
                        {onShowUnknown
                            ? " Click to filter."
                            : " Review them in the transaction table and set a category manually."}
                    </span>
                </div>
            )}

            {report.washSaleCount > 0 && (
                <div className="wash-sale-warning">
                    <strong>
                        ⚠ {report.washSaleCount} potential wash sale{report.washSaleCount !== 1 ? "s" : ""}
                    </strong>
                    <span>
                        {" "}
                        — {fmt(report.washSaleDisallowedLoss)} in losses flagged (same token re-acquired within 30 days
                        of sale). Advisory only: under current US law crypto is treated as property, not a security, so
                        IRC §1091 wash-sale rules generally do not apply and these losses remain deductible. Consult a
                        tax professional.
                    </span>
                </div>
            )}

            {report.shortTermEvents.length + report.longTermEvents.length > 0 && (
                <div className="form-8949-preview">
                    <div className="form-8949-header">Form 8949 Preview (first 10)</div>
                    <table className="form-8949-table">
                        <thead>
                            <tr>
                                <th>Description</th>
                                <th>Acquired</th>
                                <th>Sold</th>
                                <th>Proceeds</th>
                                <th>Basis</th>
                                <th>Gain/Loss</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...report.shortTermEvents, ...report.longTermEvents].slice(0, 10).map((e, i) => (
                                <tr key={i}>
                                    <td>{e.description}</td>
                                    <td>{e.dateAcquired.toLocaleDateString()}</td>
                                    <td>{e.dateSold.toLocaleDateString()}</td>
                                    <td>{fmt(e.proceeds)}</td>
                                    <td>{fmt(e.costBasis)}</td>
                                    <td className={e.gainLoss >= 0 ? "gain" : "loss"}>{fmt(e.gainLoss)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
