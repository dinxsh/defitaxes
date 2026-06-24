import type { Category, Treatment } from "./types";

export interface CategoryInfo {
    label: string;
    color: string;
    description: string;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
    FEE: { label: "Fee", color: "#6b7280", description: "Gas fee only, no value transfer" },
    SWAP: { label: "Swap", color: "#a855f7", description: "Token exchange" },
    ADD_LIQUIDITY: { label: "Add LP", color: "#3b82f6", description: "Provide liquidity to pool" },
    REMOVE_LIQUIDITY: { label: "Remove LP", color: "#3b82f6", description: "Withdraw from liquidity pool" },
    STAKE: { label: "Stake", color: "#f59e0b", description: "Stake tokens" },
    UNSTAKE: { label: "Unstake", color: "#f59e0b", description: "Unstake tokens" },
    DEPOSIT: { label: "Deposit", color: "#06b6d4", description: "Deposit into protocol" },
    WITHDRAW: { label: "Withdraw", color: "#06b6d4", description: "Withdraw from protocol" },
    BRIDGE_OUT: { label: "Bridge Out", color: "#ec4899", description: "Bridge to another chain" },
    BRIDGE_IN: { label: "Bridge In", color: "#ec4899", description: "Bridge from another chain" },
    WRAP: { label: "Wrap", color: "#8b5cf6", description: "Wrap native token" },
    UNWRAP: { label: "Unwrap", color: "#8b5cf6", description: "Unwrap to native token" },
    BORROW: { label: "Borrow", color: "#ef4444", description: "Borrow from lending protocol" },
    REPAY: { label: "Repay", color: "#ef4444", description: "Repay borrowed amount" },
    LIQUIDATION: { label: "Liquidation", color: "#ef4444", description: "Collateral seized by lending protocol" },
    AIRDROP: { label: "Airdrop", color: "#22c55e", description: "Received airdrop" },
    INCOME: { label: "Income", color: "#22c55e", description: "Earned income (rewards, interest)" },
    COMPOUND: { label: "Compound", color: "#14b8a6", description: "Reinvest rewards" },
    SELF: { label: "Self", color: "#6b7280", description: "Self-transfer" },
    SPAM: { label: "Spam", color: "#374151", description: "Spam / dust transaction" },
    ERROR: { label: "Error", color: "#ef4444", description: "Failed transaction" },
    TRANSFER_OUT: { label: "Send", color: "#f97316", description: "Transfer out" },
    TRANSFER_IN: { label: "Receive", color: "#22c55e", description: "Transfer in" },
    UNKNOWN: { label: "Unknown", color: "#6b7280", description: "Unclassified" },
};

/** Default treatments for each category */
export const CATEGORY_TREATMENTS: Record<Category, { sent: Treatment; received: Treatment }> = {
    FEE: { sent: "fee", received: "ignore" },
    SWAP: { sent: "sell", received: "buy" },
    ADD_LIQUIDITY: { sent: "deposit", received: "buy" },
    REMOVE_LIQUIDITY: { sent: "sell", received: "withdraw" },
    STAKE: { sent: "deposit", received: "ignore" },
    UNSTAKE: { sent: "ignore", received: "withdraw" },
    DEPOSIT: { sent: "deposit", received: "ignore" },
    WITHDRAW: { sent: "ignore", received: "withdraw" },
    BRIDGE_OUT: { sent: "deposit", received: "ignore" },
    BRIDGE_IN: { sent: "ignore", received: "withdraw" },
    WRAP: { sent: "deposit", received: "withdraw" },
    UNWRAP: { sent: "deposit", received: "withdraw" },
    BORROW: { sent: "ignore", received: "ignore" },
    REPAY: { sent: "ignore", received: "ignore" },
    LIQUIDATION: { sent: "sell", received: "ignore" },
    AIRDROP: { sent: "ignore", received: "income" },
    INCOME: { sent: "ignore", received: "income" },
    COMPOUND: { sent: "ignore", received: "income" },
    SELF: { sent: "ignore", received: "ignore" },
    SPAM: { sent: "ignore", received: "ignore" },
    ERROR: { sent: "ignore", received: "ignore" },
    TRANSFER_OUT: { sent: "sell", received: "ignore" },
    TRANSFER_IN: { sent: "ignore", received: "buy" },
    UNKNOWN: { sent: "ignore", received: "ignore" },
};
