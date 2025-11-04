// backend/services/okxFutures.js
import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

const OKX_WS_ENDPOINTS = [
    "wss://ws.okx.com:8443/ws/v5/public",
    "wss://wsaws.okx.com:8443/ws/v5/public",
    "wss://wspap.okx.com:8443/ws/v5/public?brokerId=9999",
];

const PERPS = ["BTC-USDT-SWAP", "ETH-USDT-SWAP"]; // add more if desired

export function startOkxFutures() {
    function connect(idx = 0) {
        const url = OKX_WS_ENDPOINTS[idx % OKX_WS_ENDPOINTS.length];
        const ws = new WebSocket(url, { headers: { Origin: "https://www.okx.com" } });
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[okx:futures] connected:", url);
            const args = PERPS.map((instId) => ({ channel: "tickers", instId }));
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

                const instId = msg.arg.instId; // e.g., "BTC-USDT-SWAP"
                const row = msg.data[0];
                if (!row) return;

                const bid = parseFloat(row.bidPx);
                const ask = parseFloat(row.askPx);
                if (Number.isNaN(bid) || Number.isNaN(ask)) return;

                const canonical = toCanonical("okx", instId, "futures"); // -> "BTC-USDT"
                upsertQuote({
                    exchange: "okx",
                    marketType: "futures",
                    symbol: canonical,
                    bid,
                    ask,
                    ts: Date.now(),
                });
            } catch { }
        });

        const cleanup = () => { if (pingTimer) clearInterval(pingTimer); };

        ws.on("error", (err) => {
            console.error("[okx:futures] error on", url, err?.message || err);
        });
        ws.on("close", () => {
            console.log("[okx:futures] socket closed, failover reconnect");
            cleanup();
            setTimeout(() => connect(idx + 1), 1500);
        });
    }
    connect(0);
}
