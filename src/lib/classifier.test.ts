import { describe, expect, it } from "vitest";
import { classifyTransaction } from "./classifier";
import type { Token, Transaction, Transfer } from "./types";

const A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const X = "0xcccccccccccccccccccccccccccccccccccccccc";
const ZERO = "0x0000000000000000000000000000000000000000";

function token(addr: string, symbol: string): Token {
    return { contractAddress: addr, symbol, decimals: 18, name: symbol };
}

function transfer(from: string, to: string, tok: Token, amount: number, rate: number): Transfer {
    return { from, to, amount, token: tok, rate, treatment: "ignore", bucket: "SELF" };
}

function tx(transfers: Transfer[]): Transaction {
    return {
        hash: "0xhash",
        timestamp: new Date("2021-01-01T00:00:00Z"),
        chain: "eth-mainnet",
        chainDisplayName: "Ethereum",
        blockHeight: 1,
        transfers,
        category: "UNKNOWN",
        counterparty: X,
        counterpartyLabel: null,
        gasFeeNative: 0,
        gasFeesUsd: 1,
        successful: true,
        rawMethodId: "",
    };
}

describe("multi-wallet internal transfers (#1)", () => {
    const t = tx([transfer(A, B, token("0xtkn", "TKN"), 1, 2000)]);

    it("classifies a move between two OWNED wallets as a non-taxable SELF", () => {
        const result = classifyTransaction(t, [A, B]);
        expect(result.category).toBe("SELF");
        // No transfer should be a buy/sell/income — purely internal.
        expect(result.transfers.every((x) => x.treatment === "ignore")).toBe(true);
    });

    it("WITHOUT the receiving wallet in the owned set it looks like a disposal", () => {
        const result = classifyTransaction(t, [A]);
        expect(result.category).toBe("TRANSFER_OUT");
        expect(result.transfers[0]!.treatment).toBe("sell");
    });
});

describe("swap classification", () => {
    it("sent one token + received another → SWAP (sell + buy)", () => {
        const result = classifyTransaction(
            tx([
                transfer(A, X, token("0xt1", "AAA"), 1, 100),
                transfer(X, A, token("0xt2", "BBB"), 50, 2),
            ]),
            [A]
        );
        expect(result.category).toBe("SWAP");
        const sent = result.transfers.find((x) => x.bucket === "SENT");
        const received = result.transfers.find((x) => x.bucket === "RECEIVED");
        expect(sent!.treatment).toBe("sell");
        expect(received!.treatment).toBe("buy");
    });
});

describe("income classification", () => {
    it("token minted from the zero address → INCOME", () => {
        const result = classifyTransaction(tx([transfer(ZERO, A, token("0xrwd", "RWD"), 10, 5)]), [A]);
        expect(result.category).toBe("INCOME");
        const received = result.transfers.find((x) => x.bucket === "MINTED");
        expect(received!.treatment).toBe("income");
    });
});
