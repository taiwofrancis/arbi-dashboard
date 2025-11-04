// services/bybitSpot.js
import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

// Bybit SPOT WS (v5)
const BYBIT_SPOT_WS_BASE = "wss://stream.bybit.com/v5/public/spot";

// Keep it simple/reliable
const BYBIT_PAIRS = ["BTC-USDT", "ETH-USDT"];

// one-time log guards
const once = new Set();

export function startBybitSpot() {
    function connect() {
        const ws = new WebSocket(BYBIT_SPOT_WS_BASE);
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[bybit:spot] connected");

            // Use bookticker.* to guarantee bid/ask presence
            const args = BYBIT_PAIRS.map(
                (sym) => "bookticker." + sym.replace("-", "").toUpperCase()
            );
            ws.send(JSON.stringify({ op: "subscribe", args }));

            // keepalive
            pingTimer = setInterval(() => {
                if (ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" }));
            }, 10000);
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());

                if (msg.op === "pong") return;
                if (!msg.topic || !msg.topic.startsWith("bookticker.")) return;

                // Bybit may send array or object
                let d = null;
                if (Array.isArray(msg.data) && msg.data[0]) d = msg.data[0];
                else if (msg.data && typeof msg.data === "object") d = msg.data;
                if (!d) return;

                const rawSymbol = d.symbol; // "BTCUSDT"

                // bookticker provides these consistently for spot:
                // bidPrice, askPrice (strings)
                const bid = parseFloat(d.bidPrice);
                const ask = parseFloat(d.askPrice);

                if (!rawSymbol || isNaN(bid) || isNaN(ask)) {
                    const k = `skip:${rawSymbol}`;
                    if (rawSymbol && !once.has(k)) {
                        once.add(k);
                        console.log("[bybit:spot] frame missing bid/ask", {
                            symbol: rawSymbol,
                            have: Object.keys(d),
                        });
                    }
                    return;
                }

                const canonical = toCanonical("bybit", rawSymbol, "spot");

                upsertQuote({
                    exchange: "bybit",
                    marketType: "spot",
                    symbol: canonical,
                    bid,
                    ask,
                    ts: Date.now(),
                });

                const ok = `ok:${canonical}`;
                if (!once.has(ok)) {
                    once.add(ok);
                    console.log("[bybit:spot] upsert", canonical, "bid", bid, "ask", ask);
                }
            } catch {
                // ignore parse errors
            }
        });

        ws.on("close", () => {
            console.log("[bybit:spot] socket closed, reconnecting soon...");
            if (pingTimer) clearInterval(pingTimer);
            setTimeout(connect, 1500);
        });

        ws.on("error", (err) => {
            console.error("[bybit:spot] error", err.message);
            if (pingTimer) clearInterval(pingTimer);
            try { ws.close(); } catch { }
        });
    }

    connect();
}
