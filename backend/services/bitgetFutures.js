import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

const WS_URL = "wss://ws.bitget.com/v2/ws/public";
const PERPS = ["BTC-USDT", "ETH-USDT"];

export function startBitgetFutures() {
    function connect() {
        const ws = new WebSocket(WS_URL);
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[bitget:futures] connected");
            const args = PERPS.map(sym => ({
                instType: "USDT-FUTURES",
                channel: "ticker",
                instId: sym.replace("-", "_")
            }));
            ws.send(JSON.stringify({ op: "subscribe", args }));
            pingTimer = setInterval(() => ws.send("ping"), 15000);
        });

        ws.on("message", raw => {
            try {
                const msg = JSON.parse(raw);
                if (msg.arg?.channel !== "ticker") return;
                const data = msg.data?.[0];
                if (!data) return;

                const bid = parseFloat(data.bidPr);
                const ask = parseFloat(data.askPr);
                const symbol = toCanonical("bitget", msg.arg.instId, "futures");

                if (!isNaN(bid) && !isNaN(ask)) {
                    upsertQuote({
                        exchange: "bitget",
                        marketType: "futures",
                        symbol,
                        bid,
                        ask,
                        ts: Date.now(),
                    });
                }
            } catch { }
        });

        ws.on("close", () => {
            console.log("[bitget:futures] socket closed");
            if (pingTimer) clearInterval(pingTimer);
            setTimeout(connect, 3000);
        });

        ws.on("error", err => console.error("[bitget:futures] error", err.message));
    }

    connect();
}
