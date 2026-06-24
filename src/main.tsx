import App from "./App";
import "./style.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("app");
if (!root) throw new Error("Root element #app not found");

const apiKey = import.meta.env.VITE_GOLDRUSH_API_KEY as string | undefined;
if (!apiKey) {
    root.innerHTML = `
        <div style="padding:2rem;color:#ef4444;font-family:monospace">
            <h2>Missing API Key</h2>
            <p>Set <code>VITE_GOLDRUSH_API_KEY</code> in your <code>.env</code> file.</p>
            <p>Get one at <a href="https://goldrush.dev/platform/apikey" style="color:#00d084">goldrush.dev</a></p>
        </div>
    `;
} else {
    createRoot(root).render(
        <StrictMode>
            <App />
        </StrictMode>
    );
}
