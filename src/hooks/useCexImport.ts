import type { Transaction } from "../lib/types";
import { useCallback, useState } from "react";

const STORAGE_KEY = "defitaxes:cex-transactions:v1";

function serialize(txs: Transaction[]): string {
    return JSON.stringify(txs.map((tx) => ({ ...tx, timestamp: tx.timestamp.toISOString() })));
}

function deserialize(raw: string): Transaction[] {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return parsed.map((tx) => ({ ...tx, timestamp: new Date(tx.timestamp as string) }) as Transaction);
}

function loadFromStorage(): Transaction[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return deserialize(raw);
    } catch {
        return [];
    }
}

export function useCexImport() {
    const [cexTransactions, setCexTransactions] = useState<Transaction[]>(loadFromStorage);

    const addCexTransactions = useCallback((txs: Transaction[]) => {
        setCexTransactions((prev) => {
            const next = [...prev, ...txs];
            try {
                localStorage.setItem(STORAGE_KEY, serialize(next));
            } catch {
                // quota exceeded
            }
            return next;
        });
    }, []);

    const clearCexTransactions = useCallback(() => {
        setCexTransactions([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // quota exceeded
        }
    }, []);

    return { cexTransactions, addCexTransactions, clearCexTransactions };
}
