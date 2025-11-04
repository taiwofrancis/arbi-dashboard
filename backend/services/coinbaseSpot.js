import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS, COINBASE_WS_BASE } from "../config.js";

export function startCoinbaseSpot() {
    function connect() {
        const ws = new WebSocket(COINBASE_WS_BASE);

        ws.on("open", () => {
            console.log("[coinbase:spot] connected");

            // Coinbase wants product_ids like "BTC-USD"
            // We'll map our TRACK_SYMBOLS (BTC-USDT etc.) -> BTC-USD
            // by replacing the quote with USD.
            const product_ids = TRACK_SYMBOLS.map(sym => {
                const base = sym.split("-")[0]; // BTC
                return `${base}-USD`;          // BTC-USD
            });

            ws.send(
                JSON.stringify({
                    type: "subscribe",
                    channels: [
                        {
                            name: "ticker",        // "ticker" channel streams best bid/ask
                            product_ids
                        }
                    ]
                })
            );
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                // Coinbase "ticker" payload example:
                // {
                //   type: "ticker",
                //   product_id: "BTC-USD",
                //   bid: "62000.11",
                //   ask: "62001.02",
                //   ...
                // }

                if (
                    msg.type === "ticker" &&
                    msg.product_id &&
                    msg.bid &&
                    msg.ask
                ) {
                    const canonical = toCanonical(
                        "coinbase",
                        msg.product_id, // e.g. BTC-USD
                        "spot"
                    );

                    const bid = parseFloat(msg.bid);
                    const ask = parseFloat(msg.ask);

                    if (!isNaN(bid) && !isNaN(ask)) {
                        upsertQuote({
                            exchange: "coinbase",
                            marketType: "spot",
                            symbol: canonical, // BTC-USD
                            bid,
                            ask,
                            ts: Date.now()
                        });
                    }
                }
            } catch (_) { }
        });

        ws.on("error", (err) => {
            console.error("[coinbase:spot] error", err.message);
            try { ws.close(); } catch { }
        });

        ws.on("close", () => {
            console.log("[coinbase:spot] socket closed");
            setTimeout(connect, 3000);
        });
    }

    connect();
}
