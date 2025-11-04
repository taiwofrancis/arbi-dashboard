import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

const WS_URL = "wss://ws.bitget.com/v2/ws/public";
const PAIRS = ["BTC-USDT", "ETH-USDT"];

export function startBitgetSpot() {
    function connect() {
        const ws = new WebSocket(WS_URL);
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[bitget:spot] connected");
            const args = PAIRS.map(sym => ({
                instType: "SPOT",
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
                const symbol = toCanonical("bitget", msg.arg.instId, "spot");

                if (!isNaN(bid) && !isNaN(ask)) {
                    upsertQuote({
                        exchange: "bitget",
                        marketType: "spot",
                        symbol,
                        bid,
                        ask,
                        ts: Date.now(),
                    });
                }
            } catch { }
        });

        ws.on("close", () => {
            console.log("[bitget:spot] socket closed");
            if (pingTimer) clearInterval(pingTimer);
            setTimeout(connect, 3000);
        });

        ws.on("error", err => console.error("[bitget:spot] error", err.message));
    }

    connect();
}
