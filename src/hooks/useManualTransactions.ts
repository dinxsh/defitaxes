import type { Transaction } from "../lib/types";
import { useCallback, useState } from "react";

const STORAGE_KEY = "defitaxes:manual-transactions:v1";

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

export function useManualTransactions() {
    const [manualTransactions, setManualTransactions] = useState<Transaction[]>(loadFromStorage);

    const addManualTransaction = useCallback((tx: Transaction) => {
        setManualTransactions((prev) => {
            const next = [...prev, tx];
            try {
                localStorage.setItem(STORAGE_KEY, serialize(next));
            } catch {
                // quota exceeded
            }
            return next;
        });
    }, []);

    const removeManualTransaction = useCallback((hash: string) => {
        setManualTransactions((prev) => {
            const next = prev.filter((t) => t.hash !== hash);
            try {
                localStorage.setItem(STORAGE_KEY, serialize(next));
            } catch {
                // quota exceeded
            }
            return next;
        });
    }, []);

    const clearManualTransactions = useCallback(() => {
        setManualTransactions([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // quota exceeded
        }
    }, []);

    return { manualTransactions, addManualTransaction, removeManualTransaction, clearManualTransactions };
}
