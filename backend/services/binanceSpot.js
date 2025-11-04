// services/binanceSpot.js
import WebSocket from "ws";
import { TRACK_SYMBOLS, BINANCE_SPOT_WS_BASE } from "../config.js";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

// Binance lets you subscribe to many streams via a single URL, but very long URLs can fail.
// We'll split into chunks (e.g. 60 streams per connection) to be safe.
const CHUNK_SIZE = 60;

function symbolToStream(sym) {
    // "BTC-USDT" -> "btcusdt@bookTicker"
    return sym.replace("-", "").toLowerCase() + "@bookTicker";
}

export function startBinanceSpot() {
    const streams = TRACK_SYMBOLS.map(symbolToStream);

    // chunk the streams array
    for (let i = 0; i < streams.length; i += CHUNK_SIZE) {
        const chunk = streams.slice(i, i + CHUNK_SIZE);
        startOne(chunk);
    }

    function startOne(streamList) {
        function connect() {
            const url = `${BINANCE_SPOT_WS_BASE}?streams=${streamList.join("/")}`;
            const ws = new WebSocket(url);

            ws.on("open", () => {
                console.log(
                    "[binance:spot] connected",
                    `(${streamList.length} streams: ${streamList.slice(0, 5).join(",")}${streamList.length > 5 ? ", ..." : ""})`
                );
            });

            ws.on("message", (raw) => {
                try {
                    const pkt = JSON.parse(raw.toString());
                    const data = pkt.data || pkt;

                    // bookTicker fields
                    const rawSymbol = data.s || data.symbol;
                    const bid = parseFloat(data.b);
                    const ask = parseFloat(data.a);
                    if (!rawSymbol || isNaN(bid) || isNaN(ask)) return;

                    const canonical = toCanonical("binance", rawSymbol, "spot");

                    upsertQuote({
                        exchange: "binance",
                        marketType: "spot",
                        symbol: canonical,
                        bid,
                        ask,
                        ts: Date.now(),
                    });
                } catch {
                    // ignore parse errors
                }
            });

            ws.on("error", (err) => {
                console.error("[binance:spot] error", err.message);
                try { ws.close(); } catch { }
            });

            ws.on("close", () => {
                console.log("[binance:spot] socket closed, reconnecting…");
                setTimeout(connect, 3000);
            });
        }

        connect();
    }
}
