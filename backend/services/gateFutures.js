// backend/services/gateFutures.js
import WebSocket from "ws";
import { TRACK_SYMBOLS } from "../config.js";
import { upsertQuote } from "./priceStore.js";

/**
 * Gate.io PERP (USDT-settled)
 * We subscribe to BOTH:
 *   - futures.book_ticker  (best for bid/ask)
 *   - futures.tickers      (fallback on some regions/markets)
 *
 * Endpoint is already scoped to USDT settlement:
 *   wss://fx-ws.gateio.ws/v4/ws/usdt
 */

const WS_BASE = "wss://fx-ws.gateio.ws/v4/ws/usdt";

// "BTC-USDT" -> "BTC_USDT"
const CONTRACTS = TRACK_SYMBOLS
    .filter(s => s.toUpperCase().endsWith("-USDT"))
    .map(s => s.replace("-", "_").toUpperCase());

const once = new Set();

function nowSec() {
    return Math.floor(Date.now() / 1000);
}

function coerceBidAsk(r) {
    // Gate may use various keys depending on channel/version:
    // book_ticker: { best_bid, best_ask }
    // tickers: { best_bid, best_ask } OR { highest_bid, lowest_ask } in some docs
    // some libs show { bid, ask } or camelCase variants
    const tryKeys = [
        ["best_bid", "best_ask"],
        ["highest_bid", "lowest_ask"],
        ["bid", "ask"],
        ["bestBid", "bestAsk"],
        ["b", "a"], // just in case
    ];

    for (const [kb, ka] of tryKeys) {
        const bid = parseFloat(r[kb]);
        const ask = parseFloat(r[ka]);
        if (!Number.isNaN(bid) && !Number.isNaN(ask)) return { bid, ask };
    }
    return { bid: NaN, ask: NaN };
}

export function startGateFutures() {
    function connect() {
        const ws = new WebSocket(WS_BASE);
        let pingTimer = null;

        ws.on("open", () => {
            console.log("[gate:futures] connected. subscribing:", CONTRACTS.join(", "));

            // Primary: book_ticker
            ws.send(JSON.stringify({
                time: nowSec(),
                channel: "futures.book_ticker",
                event: "subscribe",
                payload: CONTRACTS
            }));

            // Fallback: tickers (some regions/markets only push here)
            ws.send(JSON.stringify({
                time: nowSec(),
                channel: "futures.tickers",
                event: "subscribe",
                payload: CONTRACTS
            }));

            // keepalive
            pingTimer = setInterval(() => {
                if (ws.readyState === 1) {
                    ws.send(JSON.stringify({ time: nowSec(), event: "ping" }));
                }
            }, 10000);
        });

        ws.on("message", (raw) => {
            try {
                const msg = JSON.parse(raw.toString());

                // Heartbeats/acks
                if (msg.event === "pong" || msg.event === "subscribe") return;

                // We handle both channels
                if ((msg.channel === "futures.book_ticker" || msg.channel === "futures.tickers") && msg.result) {
                    const r = msg.result;

                    // contract name "BTC_USDT"
                    const rawContract = String(r.contract || r.s || r.symbol || "");
                    if (!rawContract) return;

                    const canonical = rawContract.replace("_", "-").toUpperCase(); // -> "BTC-USDT"

                    const { bid, ask } = coerceBidAsk(r);
                    if (Number.isNaN(bid) || Number.isNaN(ask)) {
                        const key = `skip:${msg.channel}:${rawContract}`;
                        if (!once.has(key)) {
                            once.add(key);
                            console.log("[gate:futures] skipping (no bid/ask)", {
                                channel: msg.channel,
                                contract: rawContract,
                                have: Object.keys(r)
                            });
                        }
                        return;
                    }

                    upsertQuote({
                        exchange: "gate",
                        marketType: "futures",
                        symbol: canonical,
                        bid,
                        ask,
                        ts: Date.now(),
                    });

                    const ok = `ok:${canonical}`;
                    if (!once.has(ok)) {
                        once.add(ok);
                        console.log(`[gate:futures] upsert ${canonical} bid ${bid} ask ${ask}`);
                    }
                }
            } catch {
                // ignore frame parse errors
            }
        });

        ws.on("close", () => {
            console.log("[gate:futures] socket closed (reconnecting)");
            if (pingTimer) clearInterval(pingTimer);
            setTimeout(connect, 1500);
        });

        ws.on("error", (err) => {
            console.error("[gate:futures] error", err.message);
            if (pingTimer) clearInterval(pingTimer);
            try { ws.close(); } catch { }
        });
    }

    connect();
}
