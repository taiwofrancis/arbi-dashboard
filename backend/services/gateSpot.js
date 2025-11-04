import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS, GATE_SPOT_WS_BASE } from "../config.js";

export function startGateSpot() {
    function connect() {
        const ws = new WebSocket(GATE_SPOT_WS_BASE);

        ws.on("open", () => {
            console.log("[gate:spot] connected");

            // Gate wants "BTC_USDT" style
            const payloadSymbols = TRACK_SYMBOLS.map(sym =>
                sym.replace("-", "_") // BTC-USDT -> BTC_USDT
            );

            ws.send(
                JSON.stringify({
                    time: Date.now(),
                    channel: "spot.book_ticker",
                    event: "subscribe",
                    payload: payloadSymbols
                })
            );
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());
                // Example:
                // {
                //   "channel":"spot.book_ticker",
                //   "result":{
                //     "s":"BTC_USDT",
                //     "b":"10000.1",
                //     "a":"10000.2"
                //   }
                // }

                if (
                    msg.channel === "spot.book_ticker" &&
                    msg.result &&
                    msg.result.s &&
                    msg.result.b &&
                    msg.result.a
                ) {
                    const rawSymbol = msg.result.s; // "BTC_USDT"
                    const canonical = toCanonical(
                        "gate",
                        rawSymbol.replace("_", "-"),
                        "spot"
                    );

                    const bid = parseFloat(msg.result.b);
                    const ask = parseFloat(msg.result.a);

                    if (!isNaN(bid) && !isNaN(ask)) {
                        upsertQuote({
                            exchange: "gate",
                            marketType: "spot",
                            symbol: canonical,
                            bid,
                            ask,
                            ts: Date.now()
                        });
                    }
                }
            } catch (_) { }
        });

        ws.on("error", (err) => {
            console.error("[gate:spot] error", err.message);
            try { ws.close(); } catch { }
        });

        ws.on("close", () => {
            console.log("[gate:spot] socket closed");
            setTimeout(connect, 3000);
        });
    }

    connect();
}
