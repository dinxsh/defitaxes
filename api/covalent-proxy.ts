/**
 * /api/covalent-proxy — server-side proxy for Covalent REST API v1.
 *
 * Keeps the Covalent API key server-side and follows redirects to avoid CORS.
 *
 * Usage:  GET /api/covalent-proxy?path=eth-mainnet/address/0x.../transactions_v3/
 * Proxies: GET https://api.covalenthq.com/v1/eth-mainnet/address/0x.../transactions_v3/?key=...
 */

export const config = { runtime: "edge" };

const COVALENT_BASE = "https://api.covalenthq.com/v1";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
} as const;

export default async function handler(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405, headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path");

    if (!path) {
        return new Response(JSON.stringify({ status: 400, error_message: "Missing required query param: path" }), {
            status: 400,
            headers: { "Content-Type": "application/json", ...CORS },
        });
    }

    const apiKey = process.env.COVALENT_API_KEY ?? process.env.VITE_GOLDRUSH_API_KEY ?? "";

    const upstream = new URL(`${COVALENT_BASE}/${path}`);
    for (const [k, v] of url.searchParams.entries()) {
        if (k !== "path") upstream.searchParams.set(k, v);
    }
    upstream.searchParams.set("key", apiKey);

    try {
        const res = await fetch(upstream.toString(), {
            headers: { Accept: "application/json" },
            redirect: "follow",
        });

        const body = await res.text();

        if (!res.ok) {
            let errorMsg = `HTTP ${res.status}`;
            try {
                const parsed = JSON.parse(body);
                errorMsg = parsed.error_message ?? parsed.message ?? errorMsg;
            } catch {
                /* body is not JSON */
            }
            return new Response(JSON.stringify({ status: res.status, error_message: errorMsg }), {
                status: res.status,
                headers: { "Content-Type": "application/json", ...CORS },
            });
        }

        return new Response(body, {
            status: res.status,
            headers: { "Content-Type": "application/json", ...CORS },
        });
    } catch (err) {
        const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        console.error(`[covalent-proxy] Upstream fetch failed: ${msg}`);
        return new Response(JSON.stringify({ status: 502, error_message: msg }), {
            status: 502,
            headers: { "Content-Type": "application/json", ...CORS },
        });
    }
}
