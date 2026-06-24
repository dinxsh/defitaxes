import type { ProcessingStep } from "../lib/types";
import { Search, RotateCcw, Plus, X } from "lucide-react";
import { useState } from "react";

const MAX_WALLETS = 5;
const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

interface MultiWalletInputProps {
    onSubmit: (wallets: string[]) => void;
    onReset: () => void;
    step: ProcessingStep;
}

export function MultiWalletInput({ onSubmit, onReset, step }: MultiWalletInputProps) {
    const [wallets, setWallets] = useState<string[]>([""]);

    const isProcessing = step !== "idle" && step !== "done";
    const isDone = step === "done";

    const validWallets = wallets.filter((w) => ADDR_RE.test(w.trim()));
    const canSubmit = validWallets.length > 0 && !isProcessing;

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (canSubmit) onSubmit([...new Set(validWallets.map((w) => w.trim().toLowerCase()))]);
    }

    function setWallet(idx: number, val: string) {
        setWallets((prev) => prev.map((w, i) => (i === idx ? val : w)));
    }

    function addWallet() {
        if (wallets.length < MAX_WALLETS) setWallets((prev) => [...prev, ""]);
    }

    function removeWallet(idx: number) {
        setWallets((prev) => prev.filter((_, i) => i !== idx));
    }

    return (
        <form className="address-input" onSubmit={handleSubmit}>
            {wallets.map((w, idx) => (
                <div key={idx} className="address-input-row" style={{ marginBottom: idx < wallets.length - 1 ? 4 : 0 }}>
                    <div className="address-input-field">
                        <Search size={14} className="address-input-icon" />
                        <input
                            type="text"
                            placeholder={`Wallet ${idx + 1} (0x...)`}
                            value={w}
                            onChange={(e) => setWallet(idx, e.target.value)}
                            disabled={isProcessing}
                            spellCheck={false}
                            autoComplete="off"
                        />
                    </div>
                    {wallets.length > 1 && (
                        <button
                            type="button"
                            className="btn btn--secondary"
                            onClick={() => removeWallet(idx)}
                            disabled={isProcessing}
                            title="Remove wallet"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            ))}
            <div className="address-input-row" style={{ marginTop: 6 }}>
                {wallets.length < MAX_WALLETS && !isDone && (
                    <button type="button" className="btn btn--secondary" onClick={addWallet} disabled={isProcessing}>
                        <Plus size={14} />
                        Add wallet
                    </button>
                )}
                <div style={{ flex: 1 }} />
                {isDone ? (
                    <button type="button" className="btn btn--secondary" onClick={onReset}>
                        <RotateCcw size={14} />
                        New
                    </button>
                ) : (
                    <button type="submit" className="btn btn--primary" disabled={!canSubmit}>
                        {isProcessing ? "Processing..." : "Analyze"}
                    </button>
                )}
            </div>
        </form>
    );
}
