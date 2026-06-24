import type { ProcessingStep } from "../lib/types";
import { Search, RotateCcw } from "lucide-react";
import { useState } from "react";

interface AddressInputProps {
    onSubmit: (address: string) => void;
    onReset: () => void;
    step: ProcessingStep;
}

export function AddressInput({ onSubmit, onReset, step }: AddressInputProps) {
    const [address, setAddress] = useState("");

    const isProcessing = step !== "idle" && step !== "done";
    const isDone = step === "done";

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = address.trim();
        if (trimmed && /^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
            onSubmit(trimmed);
        }
    };

    const isValid = /^0x[a-fA-F0-9]{40}$/.test(address.trim());

    return (
        <form className="address-input" onSubmit={handleSubmit}>
            <div className="address-input-row">
                <div className="address-input-field">
                    <Search size={14} className="address-input-icon" />
                    <input
                        type="text"
                        placeholder="Enter wallet address (0x...)"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        disabled={isProcessing}
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>
                {isDone ? (
                    <button type="button" className="btn btn--secondary" onClick={onReset}>
                        <RotateCcw size={14} />
                        New
                    </button>
                ) : (
                    <button type="submit" className="btn btn--primary" disabled={!isValid || isProcessing}>
                        {isProcessing ? "Processing..." : "Analyze"}
                    </button>
                )}
            </div>
        </form>
    );
}
