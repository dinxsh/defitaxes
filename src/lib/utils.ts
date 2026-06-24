/** Shorten an address to 0x1234…abcd */
export function shortenAddress(address: string): string {
    if (address.length <= 10) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** Format USD value */
export function formatUsd(value: number): string {
    return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
}

/**
 * Format a monetary value in any supported fiat currency.
 * Falls back to USD if the currency code is unknown to the runtime.
 */
export function formatFiat(value: number, currency: string): string {
    try {
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    } catch {
        return formatUsd(value);
    }
}

/** Format token amount with appropriate precision */
export function formatAmount(amount: number): string {
    if (amount === 0) return "0";
    if (Math.abs(amount) < 0.000001) return amount.toExponential(4);
    if (Math.abs(amount) < 1) return amount.toFixed(6);
    if (Math.abs(amount) < 1000) return amount.toFixed(4);
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(amount);
}

/** Format date as YYYY-MM-DD */
export function formatDate(date: Date): string {
    return date.toISOString().split("T")[0] ?? "";
}

/** Format date as MM/DD/YYYY (IRS format) */
export function formatDateIrs(date: Date): string {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const y = date.getFullYear();
    return `${m}/${d}/${y}`;
}

/** Generate CSV string from rows */
export function toCsv(headers: string[], rows: string[][]): string {
    const escape = (v: string) => {
        if (v.includes(",") || v.includes('"') || v.includes("\n")) {
            return `"${v.replace(/"/g, '""')}"`;
        }
        return v;
    };
    const lines = [headers.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))];
    return lines.join("\n");
}

/** Trigger browser download of a string as a file */
export function downloadFile(content: string, filename: string, mimeType = "text/csv"): void {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

/** Check if address is zero address */
export function isZeroAddress(address: string): boolean {
    return address === "0x0000000000000000000000000000000000000000";
}

/** Normalize address to lowercase */
export function normalizeAddress(address: string): string {
    return address.toLowerCase();
}

/** Date to YYYY-MM-DD string */
export function dateToKey(date: Date): string {
    return date.toISOString().slice(0, 10);
}
