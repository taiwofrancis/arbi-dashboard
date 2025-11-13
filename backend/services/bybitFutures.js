// services/bybitFutures.js
import WebSocket from "ws";
import { TRACK_SYMBOLS } from "../config.js";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

const WS_BASE = "wss://stream.bybit.com/v5/public/linear";

const PAIRS = TRACK_SYMBOLS
    .filter((s) => s.toUpperCase().endsWith("-USDT"))
    .map((s) => s.replace("-", "").toUpperCase()); // BTC-USDT -> BTCUSDT

const once = new Set();

export function startBybitFutures() {
    function connect() {
        const ws = new WebSocket(WS_BASE);
        let ping = null;

        ws.on("open", () => {
            console.log("[bybit:futures] connected");
            const args = PAIRS.map(sym => "tickers." + sym);
            ws.send(JSON.stringify({ op: "subscribe", args }));

            ping = setInterval(() => {
                if (ws.readyState === 1) ws.send(JSON.stringify({ op: "ping" }));
            }, 10000);
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                if (msg.op === "pong") return;
                if (!msg.topic || !msg.topic.startsWith("tickers.")) return;

                const d = Array.isArray(msg.data) ? msg.data[0] : msg.data;
                if (!d) return;

                const rawSymbol = d.symbol; // e.g. BTCUSDT

                const bid = parseFloat(d.bid1Price ?? d.bestBidPrice ?? d.bidPrice);
                const ask = parseFloat(d.ask1Price ?? d.bestAskPrice ?? d.askPrice);
                if (!rawSymbol || !Number.isFinite(bid) || !Number.isFinite(ask)) return;

                const canonical = toCanonical("bybit", rawSymbol, "futures");

                upsertQuote({
                    exchange: "bybit",
                    marketType: "futures",
                    symbol: canonical,
                    bid,
                    ask,
                    ts: Date.now(),
                });

                const k = `ok:${canonical}`;
                if (!once.has(k)) {
                    once.add(k);
                    console.log("[bybit:futures] upsert", canonical, "bid", bid, "ask", ask);
                }
            } catch { }
        });

        ws.on("close", () => {
            console.log("[bybit:futures] socket closed");
            if (ping) clearInterval(ping);
            setTimeout(connect, 1500);
        });

        ws.on("error", (err) => {
            console.error("[bybit:futures] error", err.message);
            if (ping) clearInterval(ping);
            try { ws.close(); } catch { }
        });
    }

    connect();
}
