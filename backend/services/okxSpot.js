// backend/services/okxSpot.js
import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

// Try endpoints sequentially until one sticks
const OKX_WS_ENDPOINTS = [
    "wss://ws.okx.com:8443/ws/v5/public",
    "wss://wsaws.okx.com:8443/ws/v5/public",          // AWS global
    "wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999", // paper (last resort)
];

const PAIRS = ["BTC-USDT", "ETH-USDT"]; // expand later

export function startOkxSpot() {
    function connect(idx = 0) {
        const url = OKX_WS_ENDPOINTS[idx % OKX_WS_ENDPOINTS.length];
        const ws = new WebSocket(url, { headers: { Origin: "https://www.okx.com" } });
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[okx:spot] connected:", url);
            const args = PAIRS.map((instId) => ({ channel: "tickers", instId }));
            ws.send(JSON.stringify({ op: "subscribe", args }));

            pingTimer = setInterval(() => {
                if (ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" }));
            }, 10000);
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.event === "pong" || msg.op === "pong") return;
                if (!msg.data || !msg.arg || msg.arg.channel !== "tickers") return;

                const instId = msg.arg.instId;
                const row = msg.data[0];
                if (!row) return;

                const bid = parseFloat(row.bidPx);
                const ask = parseFloat(row.askPx);
                if (Number.isNaN(bid) || Number.isNaN(ask)) return;

                const canonical = toCanonical("okx", instId, "spot");
                upsertQuote({
                    exchange: "okx",
                    marketType: "spot",
                    symbol: canonical,
                    bid,
                    ask,
                    ts: Date.now(),
                });
            } catch { }
        });

        const cleanup = () => { if (pingTimer) clearInterval(pingTimer); };

        ws.on("error", (err) => {
            console.error("[okx:spot] error on", url, err?.message || err);
        });
        ws.on("close", () => {
            console.log("[okx:spot] socket closed, failover reconnect");
            cleanup();
            setTimeout(() => connect(idx + 1), 1500);
        });
    }
    connect(0);
}
