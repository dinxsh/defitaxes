import type { ImportedLotInput } from "../lib/types";
import { useCallback, useState } from "react";

const STORAGE_KEY = "defitaxes:imported-lots:v1";

function loadFromStorage(): ImportedLotInput[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        return JSON.parse(raw) as ImportedLotInput[];
    } catch {
        return [];
    }
}

export function useImportedLots() {
    const [importedLots, setImportedLots] = useState<ImportedLotInput[]>(loadFromStorage);

    const importLots = useCallback((lots: ImportedLotInput[]) => {
        setImportedLots(lots);
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(lots));
        } catch {
            // quota exceeded — ignore
        }
    }, []);

    const clearImportedLots = useCallback(() => {
        setImportedLots([]);
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch {
            // ignore
        }
    }, []);

    return { importedLots, importLots, clearImportedLots };
}
