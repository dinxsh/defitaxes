import type { Transaction } from "../lib/types";
import { useCallback } from "react";

const CACHE_VERSION = 3;
const CACHE_KEY_PREFIX = "defitaxes:cache:v3:";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry {
    version: number;
    wallet: string;
    currency: string;
    cachedAt: number; // Unix timestamp ms
    transactions: SerializedTransaction[];
}

/** Minimal serializable form of Transaction (Date → ISO string) */
interface SerializedTransaction extends Omit<Transaction, "timestamp"> {
    timestamp: string;
}

function cacheKey(wallet: string, currency: string): string {
    return `${CACHE_KEY_PREFIX}${wallet.toLowerCase()}:${currency.toLowerCase()}`;
}

function serialize(transactions: Transaction[]): SerializedTransaction[] {
    return transactions.map((tx) => ({ ...tx, timestamp: tx.timestamp.toISOString() }));
}

function deserialize(entries: SerializedTransaction[]): Transaction[] {
    return entries.map((tx) => ({ ...tx, timestamp: new Date(tx.timestamp) }));
}

export interface CachedResult {
    transactions: Transaction[];
    cachedAt: Date;
    wallet: string;
    currency: string;
}

export function useResultCache() {
    const save = useCallback((wallet: string, currency: string, transactions: Transaction[]) => {
        try {
            const entry: CacheEntry = {
                version: CACHE_VERSION,
                wallet: wallet.toLowerCase(),
                currency: currency.toLowerCase(),
                cachedAt: Date.now(),
                transactions: serialize(transactions),
            };
            localStorage.setItem(cacheKey(wallet, currency), JSON.stringify(entry));
        } catch {
            // localStorage quota exceeded or unavailable — silently ignore
        }
    }, []);

    const load = useCallback((wallet: string, currency: string): CachedResult | null => {
        try {
            const raw = localStorage.getItem(cacheKey(wallet, currency));
            if (!raw) return null;
            const entry: CacheEntry = JSON.parse(raw) as CacheEntry;
            if (entry.version !== CACHE_VERSION) return null;
            if (Date.now() - entry.cachedAt > MAX_AGE_MS) {
                localStorage.removeItem(cacheKey(wallet, currency));
                return null;
            }
            return {
                transactions: deserialize(entry.transactions),
                cachedAt: new Date(entry.cachedAt),
                wallet: entry.wallet,
                currency: entry.currency,
            };
        } catch {
            return null;
        }
    }, []);

    const clear = useCallback((wallet: string, currency: string) => {
        try {
            localStorage.removeItem(cacheKey(wallet, currency));
        } catch {
            // ignore
        }
    }, []);

    return { save, load, clear };
}
