// services/binanceFutures.js
// Binance USDT-margined futures best bid/ask via @bookTicker.
// We auto-reconnect on close so we don't lose data mid-session.

import WebSocket from "ws";
import { TRACK_SYMBOLS, BINANCE_FUTURES_WS_BASE } from "../config.js";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

export function startBinanceFutures() {
    function connect() {
        // TRACK_SYMBOLS might be ["BTC-USDT","ETH-USDT", ...]
        // Binance futures expects e.g. "btcusdt@bookTicker"
        const streams = TRACK_SYMBOLS.map(
            (sym) => sym.replace("-", "").toLowerCase() + "@bookTicker"
        );
        const url =
            `${BINANCE_FUTURES_WS_BASE}?streams=` + streams.join("/");

        const ws = new WebSocket(url);

        ws.on("open", () => {
            console.log("[binance:futures] connected");
        });

        ws.on("message", (raw) => {
            try {
                const pkt = JSON.parse(raw.toString());
                // combined stream returns { stream: "...", data: {...} }
                const data = pkt.data || pkt;

                // Example data from Binance futures:
                // {
                //   "e": "bookTicker",
                //   "u": 400900217,
                //   "s": "BTCUSDT",      // symbol
                //   "b": "33910.98",     // best bid
                //   "B": "0.001",        // bid qty
                //   "a": "33911.00",     // best ask
                //   "A": "0.002"         // ask qty
                // }
                const rawSymbol = data.s || data.symbol;
                const bid = parseFloat(data.b);
                const ask = parseFloat(data.a);

                if (!rawSymbol || isNaN(bid) || isNaN(ask)) return;

                const canonical = toCanonical(
                    "binance",
                    rawSymbol,
                    "futures"
                );

                upsertQuote({
                    exchange: "binance",
                    marketType: "futures",
                    symbol: canonical, // "BTC-USDT"
                    bid,
                    ask,
                    ts: Date.now()
                });
            } catch (err) {
                // ignore malformed frames
            }
        });

        ws.on("error", (err) => {
            console.error("[binance:futures] error", err.message);
            // When error fires, we'll explicitly close -> which will trigger reconnect in 'close'
            try { ws.close(); } catch (_) { }
        });

        ws.on("close", () => {
            console.log("[binance:futures] socket closed");
            // Reconnect after 3 seconds
            setTimeout(connect, 3000);
        });
    }

    connect();
}
