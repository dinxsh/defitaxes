import type { Category } from "../lib/types";
import { useCallback, useState } from "react";

const STORAGE_KEY = "defitaxes:category-overrides:v1";

function loadFromStorage(): Map<string, Category> {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return new Map();
        const entries = JSON.parse(raw) as Array<[string, Category]>;
        return new Map(entries);
    } catch {
        return new Map();
    }
}

function saveToStorage(map: Map<string, Category>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(map.entries())));
    } catch {
        // quota exceeded — silently ignore
    }
}

export function useCategoryOverrides() {
    const [overrides, setOverrides] = useState<Map<string, Category>>(loadFromStorage);

    const setOverride = useCallback((hash: string, category: Category) => {
        setOverrides((prev) => {
            const next = new Map(prev);
            next.set(hash, category);
            saveToStorage(next);
            return next;
        });
    }, []);

    const clearOverride = useCallback((hash: string) => {
        setOverrides((prev) => {
            const next = new Map(prev);
            next.delete(hash);
            saveToStorage(next);
            return next;
        });
    }, []);

    const clearAllOverrides = useCallback(() => {
        const empty = new Map<string, Category>();
        saveToStorage(empty);
        setOverrides(empty);
    }, []);

    return { overrides, setOverride, clearOverride, clearAllOverrides };
}
