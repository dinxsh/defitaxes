import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "http";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), "");

    return {
        plugins: [
            react(),
            {
                name: "covalent-proxy",
                configureServer(server) {
                    server.middlewares.use("/api/covalent-proxy", (req: IncomingMessage, res: ServerResponse) => {
                        const apiKey = env.VITE_GOLDRUSH_API_KEY ?? "";
                        const reqUrl = new URL(req.url ?? "/", "http://localhost");
                        const path = reqUrl.searchParams.get("path") ?? "";

                        if (!path) {
                            res.statusCode = 400;
                            res.setHeader("Content-Type", "application/json");
                            res.end(
                                JSON.stringify({ status: 400, error_message: "Missing required query param: path" })
                            );
                            return;
                        }

                        const upstream = new URL(`https://api.covalenthq.com/v1/${path}`);
                        for (const [k, v] of reqUrl.searchParams.entries()) {
                            if (k !== "path") upstream.searchParams.set(k, v);
                        }
                        upstream.searchParams.set("key", apiKey);

                        fetch(upstream.toString(), {
                            headers: { Accept: "application/json" },
                            redirect: "follow",
                        })
                            .then(async (r) => {
                                const body = await r.text();
                                res.statusCode = r.status;
                                res.setHeader("Content-Type", "application/json");
                                res.setHeader("Access-Control-Allow-Origin", "*");
                                res.end(body);
                            })
                            .catch((err: unknown) => {
                                const msg = err instanceof Error ? err.message : String(err);
                                res.statusCode = 502;
                                res.setHeader("Content-Type", "application/json");
                                res.end(JSON.stringify({ status: 502, error_message: msg }));
                            });
                    });
                },
            },
        ],
        server: {
            port: 5174,
        },
    };
});
