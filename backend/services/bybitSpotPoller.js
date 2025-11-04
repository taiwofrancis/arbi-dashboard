// services/bybitSpotPoller.js
import { upsertQuote } from "./priceStore.js";
import { toCanonical } from "../utils/symbolMap.js";
import { TRACK_SYMBOLS } from "../config.js";

// Build Bybit symbol list from TRACK_SYMBOLS (USDT-only), e.g. "BTC-USDT" -> "BTCUSDT"
const BYBIT_POLL_PAIRS = TRACK_SYMBOLS
    .filter((s) => s.toUpperCase().endsWith("-USDT"))
    .map((s) => s.replace("-", "").toUpperCase());

// REST endpoint for spot tickers
const BYBIT_TICKER_URL = "https://api.bybit.com/v5/market/tickers?category=spot&symbol=";

// Poll every N ms
const INTERVAL_MS = 2000;

async function getJson(url, { signal } = {}) {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

export function startBybitSpotPoller() {
    console.log("[bybit:spot:poll] starting (", BYBIT_POLL_PAIRS.join(", "), ")");

    let timer = null;
    let aborter = null;

    async function tick() {
        try {
            aborter = new AbortController();

            // sequential & polite (Bybit rate-limits if hammered)
            for (const sym of BYBIT_POLL_PAIRS) {
                const url = BYBIT_TICKER_URL + encodeURIComponent(sym);
                const json = await getJson(url, { signal: aborter.signal });

                const list = json?.result?.list;
                if (!Array.isArray(list) || list.length === 0) continue;

                const d = list[0];
                const rawSymbol = d.symbol; // "BTCUSDT"
                const bid = parseFloat(d.bid1Price ?? d.bestBidPrice);
                const ask = parseFloat(d.ask1Price ?? d.bestAskPrice);

                if (!rawSymbol || isNaN(bid) || isNaN(ask)) {
                    // one-time helpful log
                    console.log("[bybit:spot:poll] missing bid/ask", rawSymbol, "keys:", Object.keys(d));
                    continue;
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
            }
        } catch (err) {
            console.log("[bybit:spot:poll] error", err.message);
        } finally {
            timer = setTimeout(tick, INTERVAL_MS);
        }
    }

    tick();

    return () => {
        if (timer) clearTimeout(timer);
        if (aborter) aborter.abort();
        console.log("[bybit:spot:poll] stopped");
    };
}
