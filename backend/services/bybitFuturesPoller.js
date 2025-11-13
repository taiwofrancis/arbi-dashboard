// backend/services/bybitFuturesPoller.js
// Poll Bybit USDT perpetuals (linear category) via REST and feed into priceStore.

import { upsertQuote } from "./priceStore.js";
import { toCanonical } from "../utils/symbolMap.js";
import { TRACK_SYMBOLS } from "../config.js";

// We only care about -USDT futures.
const BYBIT_FUTURES_SYMBOLS = TRACK_SYMBOLS
    .filter((s) => s.toUpperCase().endsWith("-USDT"))
    .map((s) => s.replace("-", "").toUpperCase()); // "BTC-USDT" -> "BTCUSDT"

const BASE_URL =
    "https://api.bybit.com/v5/market/tickers?category=linear&symbol=";

const INTERVAL_MS = 3000; // whole set every 3s (similar to MEXC)
const warned = new Set();

async function getJson(url, { signal } = {}) {
    const res = await fetch(url, { signal, cache: "no-store" });
    if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return res.json();
}

export function startBybitFuturesPoller() {
    console.log(
        "[bybit:futures:poll] starting…",
        BYBIT_FUTURES_SYMBOLS.join(", ")
    );

    let timer = null;
    let aborter = null;

    async function tick() {
        try {
            aborter = new AbortController();

            for (const sym of BYBIT_FUTURES_SYMBOLS) {
                try {
                    const url = BASE_URL + encodeURIComponent(sym);
                    const json = await getJson(url, { signal: aborter.signal });

                    const list = json?.result?.list;
                    if (!Array.isArray(list) || list.length === 0) {
                        const k = `nodata-${sym}`;
                        if (!warned.has(k)) {
                            warned.add(k);
                            console.warn("[bybit:futures:poll] no data for", sym);
                        }
                        continue;
                    }

                    const d = list[0];
                    const rawSymbol = d.symbol; // e.g. "BTCUSDT"

                    const bid = parseFloat(
                        d.bid1Price ?? d.bestBidPrice ?? d.bidPrice
                    );
                    const ask = parseFloat(
                        d.ask1Price ?? d.bestAskPrice ?? d.askPrice
                    );

                    if (!rawSymbol || !Number.isFinite(bid) || !Number.isFinite(ask)) {
                        const k = `badframe-${sym}`;
                        if (!warned.has(k)) {
                            warned.add(k);
                            console.warn(
                                "[bybit:futures:poll] incomplete frame for",
                                sym,
                                "keys:",
                                Object.keys(d)
                            );
                        }
                        continue;
                    }

                    const canonical = toCanonical("bybit", rawSymbol, "futures"); // -> "BTC-USDT"

                    upsertQuote({
                        exchange: "bybit",
                        marketType: "futures",
                        symbol: canonical,
                        bid,
                        ask,
                        ts: Date.now(),
                    });
                } catch (err) {
                    const k = `err-${sym}-${err.message}`;
                    if (!warned.has(k)) {
                        warned.add(k);
                        console.warn(
                            "[bybit:futures:poll] error for",
                            sym,
                            err.message
                        );
                    }
                }

                // Small delay per symbol to be polite
                await new Promise((r) => setTimeout(r, 120));
            }
        } catch (err) {
            console.log("[bybit:futures:poll] loop error", err.message);
        } finally {
            timer = setTimeout(tick, INTERVAL_MS);
        }
    }

    tick();

    // simple stopper if you ever need it
    return () => {
        if (timer) clearTimeout(timer);
        if (aborter) aborter.abort();
        console.log("[bybit:futures:poll] stopped");
    };
}
