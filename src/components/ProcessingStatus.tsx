import type { ProcessingState, ProcessingStep } from "../lib/types";
import { Loader2, CheckCircle2, AlertCircle, Search, ArrowDownUp, DollarSign, Tag, Calculator } from "lucide-react";

interface ProcessingStatusProps {
    state: ProcessingState;
}

const STEPS: { key: ProcessingStep; label: string; Icon: typeof Loader2 }[] = [
    { key: "discovering", label: "Discover Chains", Icon: Search },
    { key: "fetching", label: "Fetch Transactions", Icon: ArrowDownUp },
    { key: "pricing", label: "Resolve Prices", Icon: DollarSign },
    { key: "classifying", label: "Classify", Icon: Tag },
    { key: "calculating", label: "Calculate Taxes", Icon: Calculator },
];

const STEP_ORDER: ProcessingStep[] = ["discovering", "fetching", "pricing", "classifying", "calculating", "done"];

function stepIndex(step: ProcessingStep): number {
    return STEP_ORDER.indexOf(step);
}

export function ProcessingStatus({ state }: ProcessingStatusProps) {
    if (state.step === "idle") {
        if (state.lastErrors.length === 0) return null;
        // Show just the error list when idle with errors
        return (
            <div className="processing-status">
                <div className="processing-errors">
                    {state.lastErrors.map((err, i) => (
                        <div key={i} className="processing-error">
                            <AlertCircle size={12} />
                            <span>{err}</span>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="processing-status">
            <div className="processing-steps">
                {STEPS.map(({ key, label, Icon }) => {
                    const current = stepIndex(state.step);
                    const target = stepIndex(key);
                    const isActive = state.step === key;
                    const isDone = current > target || state.step === "done";

                    return (
                        <div
                            key={key}
                            className={`processing-step ${isActive ? "processing-step--active" : ""} ${isDone ? "processing-step--done" : ""}`}
                        >
                            {isDone ? (
                                <CheckCircle2 size={14} />
                            ) : isActive ? (
                                <Loader2 size={14} className="spin" />
                            ) : (
                                <Icon size={14} />
                            )}
                            <span>{label}</span>
                        </div>
                    );
                })}
            </div>
            <div className="processing-progress">{state.progress}</div>
            {state.errors.length > 0 && (
                <div className="processing-errors">
                    {state.errors.map((err, i) => (
                        <div key={i} className="processing-error">
                            <AlertCircle size={12} />
                            <span>{err}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
