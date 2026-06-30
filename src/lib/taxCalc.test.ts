import { describe, expect, it } from "vitest";
import { calculateTaxes } from "./taxCalc";
import type { CostBasisMethod, Token, Transaction, Transfer, Treatment } from "./types";

const TOKEN: Token = { contractAddress: "0xtoken", symbol: "TKN", decimals: 18, name: "Token" };

function xfer(treatment: Treatment, amount: number, rate: number): Transfer {
    return { from: "0xfrom", to: "0xto", amount, token: TOKEN, rate, treatment, bucket: "SENT" };
}

let counter = 0;
function tx(timestamp: string, transfers: Transfer[], gasFeesUsd = 0): Transaction {
    counter += 1;
    return {
        hash: `0xhash${counter}`,
        timestamp: new Date(timestamp),
        chain: "eth-mainnet",
        chainDisplayName: "Ethereum",
        blockHeight: counter,
        transfers,
        category: "SWAP",
        counterparty: "0xcp",
        counterpartyLabel: null,
        gasFeeNative: 0,
        gasFeesUsd,
        successful: true,
        rawMethodId: "",
    };
}

function run(txs: Transaction[], method: CostBasisMethod = "FIFO", taxYear?: number) {
    return calculateTaxes(txs, taxYear, "USD", [], method);
}

describe("calculateTaxes — basic FIFO", () => {
    it("computes gain = proceeds - cost basis", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2020-06-01T00:00:00Z", [xfer("sell", 1, 150)]),
        ]);
        expect(report.shortTermEvents).toHaveLength(1);
        expect(report.longTermEvents).toHaveLength(0);
        expect(report.shortTermEvents[0]!.gainLoss).toBeCloseTo(50);
        expect(report.shortTermEvents[0]!.costBasis).toBeCloseTo(100);
        expect(report.shortTermEvents[0]!.proceeds).toBeCloseTo(150);
    });

    it("consumes the oldest lot first (FIFO)", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2020-02-01T00:00:00Z", [xfer("buy", 1, 300)]),
            tx("2020-03-01T00:00:00Z", [xfer("sell", 1, 250)]),
        ]);
        // FIFO sells the $100 lot first → gain 150
        expect(report.shortTermEvents[0]!.gainLoss).toBeCloseTo(150);
    });
});

describe("holding period boundary (IRS 'more than one year')", () => {
    it("treats exactly one year as SHORT-term", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2021-01-01T00:00:00Z", [xfer("sell", 1, 100)]),
        ]);
        expect(report.shortTermEvents).toHaveLength(1);
        expect(report.longTermEvents).toHaveLength(0);
    });

    it("treats one year and a day as LONG-term", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2021-01-02T00:00:00Z", [xfer("sell", 1, 100)]),
        ]);
        expect(report.shortTermEvents).toHaveLength(0);
        expect(report.longTermEvents).toHaveLength(1);
    });

    it("keeps a 366-day leap-year span (exactly one calendar year) SHORT-term", () => {
        // 2020 is a leap year, so 2020-01-01 → 2021-01-01 spans 366 days. A naive
        // ">365 days" rule would wrongly call this long-term; the calendar-based rule
        // correctly keeps it short-term (held exactly one year, not *more than* one year).
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2021-01-01T00:00:00Z", [xfer("sell", 1, 100)]),
        ]);
        expect(report.shortTermEvents).toHaveLength(1);
        expect(report.longTermEvents).toHaveLength(0);
    });
});

describe("wash-sale detection (advisory flag, loss not disallowed)", () => {
    it("flags a loss when the same token is re-acquired within 30 days", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2020-01-10T00:00:00Z", [xfer("sell", 1, 50)]), // loss
            tx("2020-01-15T00:00:00Z", [xfer("buy", 1, 50)]), // re-acquire within 30d
        ]);
        expect(report.washSaleCount).toBe(1);
        expect(report.washSaleDisallowedLoss).toBeCloseTo(50);
        expect(report.shortTermEvents[0]!.washSale).toBe(true);
        // The loss is still reflected in the totals (NOT disallowed) — advisory only.
        expect(report.totalShortTermGain).toBeCloseTo(-50);
    });

    it("does not flag when there is no re-acquisition", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
            tx("2020-06-01T00:00:00Z", [xfer("sell", 1, 50)]),
        ]);
        expect(report.washSaleCount).toBe(0);
    });
});

describe("ACB (average cost basis)", () => {
    it("uses the weighted-average cost across all lots", () => {
        const report = run(
            [
                tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 100)]),
                tx("2020-02-01T00:00:00Z", [xfer("buy", 1, 300)]),
                tx("2020-03-01T00:00:00Z", [xfer("sell", 1, 250)]),
            ],
            "ACB"
        );
        // Avg basis = (100 + 300) / 2 = 200 → gain = 250 - 200 = 50 (vs FIFO's 150)
        expect(report.shortTermEvents[0]!.costBasis).toBeCloseTo(200);
        expect(report.shortTermEvents[0]!.gainLoss).toBeCloseTo(50);
    });
});

describe("unknown cost basis", () => {
    it("treats a disposal with no prior acquisition as zero-basis short-term", () => {
        const report = run([tx("2020-05-01T00:00:00Z", [xfer("sell", 1, 100)])]);
        expect(report.shortTermEvents).toHaveLength(1);
        expect(report.shortTermEvents[0]!.costBasis).toBe(0);
        expect(report.shortTermEvents[0]!.gainLoss).toBeCloseTo(100);
        expect(report.unknownBasisCount).toBe(1);
        expect(report.shortTermEvents[0]!.description).toContain("unknown basis");
    });
});

describe("negative-proceeds clamp", () => {
    it("never lets gas push net proceeds below zero", () => {
        const report = run([
            tx("2020-01-01T00:00:00Z", [xfer("buy", 1, 5)]),
            tx("2020-02-01T00:00:00Z", [xfer("sell", 1, 10)], 50), // gas 50 > gross 10
        ]);
        const event = report.shortTermEvents[0]!;
        expect(event.proceeds).toBe(0); // clamped, not -40
        expect(event.gainLoss).toBeCloseTo(-5); // 0 proceeds - 5 basis
    });
});

describe("tax-year filter", () => {
    it("only includes disposals in the selected year", () => {
        const report = run(
            [
                tx("2020-01-01T00:00:00Z", [xfer("buy", 2, 100)]),
                tx("2020-06-01T00:00:00Z", [xfer("sell", 1, 150)]),
                tx("2021-06-01T00:00:00Z", [xfer("sell", 1, 150)]),
            ],
            "FIFO",
            2021
        );
        expect(report.shortTermEvents.concat(report.longTermEvents)).toHaveLength(1);
        expect(report.longTermEvents).toHaveLength(1); // held > 1yr by 2021
    });
});
