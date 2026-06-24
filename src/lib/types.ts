/** Treatment assigned to each transfer within a transaction */
export type Treatment = "buy" | "sell" | "fee" | "deposit" | "withdraw" | "income" | "ignore";

/** Transaction categories */
export type Category =
    | "FEE"
    | "SWAP"
    | "ADD_LIQUIDITY"
    | "REMOVE_LIQUIDITY"
    | "STAKE"
    | "UNSTAKE"
    | "DEPOSIT"
    | "WITHDRAW"
    | "BRIDGE_OUT"
    | "BRIDGE_IN"
    | "WRAP"
    | "UNWRAP"
    | "BORROW"
    | "REPAY"
    | "LIQUIDATION"
    | "AIRDROP"
    | "INCOME"
    | "COMPOUND"
    | "SELF"
    | "SPAM"
    | "ERROR"
    | "TRANSFER_OUT"
    | "TRANSFER_IN"
    | "UNKNOWN";

/** Token identity */
export interface Token {
    contractAddress: string;
    symbol: string;
    decimals: number;
    name: string;
    /** ERC-721 / ERC-1155 token ID. Present only for NFT transfers. */
    tokenId?: string;
}

/** A single value transfer within a transaction */
export interface Transfer {
    from: string;
    to: string;
    amount: number;
    token: Token;
    /** USD rate at time of transfer */
    rate: number;
    treatment: Treatment;
    /** Bucket classification */
    bucket: "SENT" | "RECEIVED" | "SELF" | "BURNED" | "MINTED";
}

/** Classified transaction */
export interface Transaction {
    hash: string;
    timestamp: Date;
    chain: string;
    chainDisplayName: string;
    blockHeight: number;
    transfers: Transfer[];
    category: Category;
    counterparty: string;
    counterpartyLabel: string | null;
    gasFeeNative: number;
    gasFeesUsd: number;
    successful: boolean;
    rawMethodId: string;
    walletAddress?: string;
}

/** A single tax event (disposal or acquisition) */
export interface TaxEvent {
    description: string;
    token: string;
    amount: number;
    dateAcquired: Date;
    dateSold: Date;
    proceeds: number;
    costBasis: number;
    gainLoss: number;
    holdingPeriod: "short-term" | "long-term";
    chain: string;
    txHash: string;
    washSale?: boolean;
}

/** Income event */
export interface IncomeEvent {
    date: Date;
    description: string;
    token: string;
    amount: number;
    fairMarketValueUsd: number;
    chain: string;
    txHash: string;
}

/** Full tax report */
export interface TaxReport {
    shortTermEvents: TaxEvent[];
    longTermEvents: TaxEvent[];
    income: IncomeEvent[];
    totalShortTermGain: number;
    totalLongTermGain: number;
    totalIncome: number;
    totalFees: number;
    /** Number of tax events with unknown cost basis (costBasis === 0 && proceeds > 0) */
    unknownBasisCount: number;
    /** Total proceeds at risk from unknown-basis events */
    unknownBasisValueAtRisk: number;
    /** Number of transfers across all transactions where rate === 0 (price unavailable) */
    zeroRateTransferCount: number;
    /** ISO 4217 currency code all monetary values are denominated in (e.g. "USD", "EUR") */
    currency: string;
    /** Number of wash-sale events detected */
    washSaleCount: number;
    /** Total disallowed loss from wash-sale events */
    washSaleDisallowedLoss: number;
    /** Number of transactions that could not be classified (category === "UNKNOWN") */
    unknownTxCount: number;
}

/** Cost basis accounting method */
export type CostBasisMethod = "FIFO" | "LIFO" | "HIFO" | "ACB";

/** Processing pipeline state */
export type ProcessingStep = "idle" | "discovering" | "fetching" | "pricing" | "classifying" | "calculating" | "done";

export interface ProcessingState {
    step: ProcessingStep;
    progress: string;
    chainsFound: number;
    txFetched: number;
    txTotal: number;
    errors: string[];
    /** Errors from the most recent failed run — persists after step resets to idle */
    lastErrors: string[];
}

/** Price cache entry */
export interface PricePoint {
    date: string; // YYYY-MM-DD
    price: number;
}

/** FIFO acquisition lot */
export interface AcquisitionLot {
    date: Date;
    amount: number;
    costBasisPerUnit: number;
    token: string;
    chain: string;
    txHash: string;
    isYield?: boolean;
}

/** Imported lot input */
export interface ImportedLotInput {
    token: string; // symbol e.g. "ETH"
    chain: string; // e.g. "eth-mainnet"
    amount: number;
    costBasisPerUnit: number;
    date: string; // YYYY-MM-DD
}
