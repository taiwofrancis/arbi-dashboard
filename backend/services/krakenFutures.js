// services/krakenFutures.js
// Kraken Futures public "ticker_lite" feed.
// It streams bid/ask for perpetual contracts like PI_XBTUSD (BTC/USD perp)
// and PI_ETHUSD (ETH/USD perp). 

import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

// Kraken Futures WS endpoint
const KRAKEN_FUTURES_WS = "wss://futures.kraken.com/ws/v1";

export function startKrakenFutures() {
    const ws = new WebSocket(KRAKEN_FUTURES_WS);

    ws.on("open", () => {
        console.log("[kraken:futures] connected");

        // Subscribe to perpetual BTC/USD and ETH/USD
        ws.send(
            JSON.stringify({
                event: "subscribe",
                feed: "ticker_lite",
                product_ids: ["PI_XBTUSD", "PI_ETHUSD"]
            })
        );
    });

    ws.on("message", (raw) => {
        try {
            const data = JSON.parse(raw.toString());

            // sample shape:
            // {
            //   feed: "ticker_lite",
            //   product_id: "PI_XBTUSD",
            //   bid: 68000.5,
            //   ask: 68001.0,
            //   ...
            // }

            if (
                (data.feed === "ticker" || data.feed === "ticker_lite") &&
                data.product_id &&
                data.bid !== undefined &&
                data.ask !== undefined
            ) {
                const canonical = toCanonical(
                    "kraken",
                    data.product_id,
                    "futures"
                );

                const bid = parseFloat(data.bid);
                const ask = parseFloat(data.ask);

                if (!isNaN(bid) && !isNaN(ask)) {
                    upsertQuote({
                        exchange: "kraken",
                        marketType: "futures",
                        symbol: canonical, // e.g. BTC-USD mapped from PI_XBTUSD
                        bid,
                        ask,
                        ts: Date.now()
                    });
                }
            }
        } catch (err) {
            // swallow parse errors
        }
    });

    ws.on("close", () => {
        console.log("[kraken:futures] socket closed");
    });

    ws.on("error", (err) => {
        console.error("[kraken:futures] error", err.message);
    });

    return ws;
}
