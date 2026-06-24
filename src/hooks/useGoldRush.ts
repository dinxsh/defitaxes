import { GoldRushClient } from "@covalenthq/client-sdk";
import { useMemo } from "react";

let sharedClient: GoldRushClient | null = null;

function getClient(): GoldRushClient {
    if (!sharedClient) {
        const apiKey = import.meta.env.VITE_GOLDRUSH_API_KEY as string;
        if (!apiKey) throw new Error("VITE_GOLDRUSH_API_KEY is not set");
        sharedClient = new GoldRushClient(apiKey);
    }
    return sharedClient;
}

export function useGoldRush(): GoldRushClient {
    return useMemo(() => getClient(), []);
}
