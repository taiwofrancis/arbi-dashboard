// services/bybitSpotPoller.js
import { upsertQuote } from "./priceStore.js";
import { toCanonical } from "../utils/symbolMap.js";

// ✅ Only coins we actually want to track on BYBIT SPOT.
// You can extend this list as you confirm support.
const BYBIT_SPOT_LIST = [
    "BTC-USDT",
    "ETH-USDT",
    "SOL-USDT",
    "XRP-USDT",
    "ADA-USDT",
    "DOGE-USDT",
    "TRX-USDT",
    "MATIC-USDT",
    "LTC-USDT",
    "LINK-USDT",
    "BCH-USDT",
    "DOT-USDT",
    "AVAX-USDT",
    "TON-USDT",
];

const BYBIT_POLL_PAIRS = BYBIT_SPOT_LIST.map((s) =>
    s.replace("-", "").toUpperCase()
);

// REST endpoint for spot tickers
const BYBIT_TICKER_URL =
    "https://api.bybit.com/v5/market/tickers?category=spot&symbol=";

const INTERVAL_MS = 2000;

// one-time logs + disabled symbols
const warned = new Set();
const disabled = new Set(); // symbols we’ll stop polling (4xx etc.)

export function startBybitSpotPoller() {
    console.log(
        "[bybit:spot:poll] starting (",
        BYBIT_POLL_PAIRS.join(", "),
        ")"
    );

    let timer = null;
    let aborter = null;

    async function tick() {
        try {
            aborter = new AbortController();

            for (const sym of BYBIT_POLL_PAIRS) {
                if (disabled.has(sym)) continue;

                try {
                    const url = BYBIT_TICKER_URL + encodeURIComponent(sym);
                    const res = await fetch(url, {
                        signal: aborter.signal,
                        cache: "no-store",
                    });

                    if (!res.ok) {
                        const key = `${sym}-${res.status}`;
                        if (!warned.has(key)) {
                            warned.add(key);
                            console.warn(
                                "[bybit:spot:poll] HTTP",
                                res.status,
                                "for",
                                sym,
                                res.status >= 400 && res.status < 500
                                    ? "→ disabling this symbol"
                                    : ""
                            );
                        }
                        if (res.status >= 400 && res.status < 500) {
                            disabled.add(sym);
                        }
                        continue;
                    }

                    const json = await res.json();
                    const list = json?.result?.list;
                    if (!Array.isArray(list) || list.length === 0) {
                        const key = `nodata-${sym}`;
                        if (!warned.has(key)) {
                            warned.add(key);
                            console.warn("[bybit:spot:poll] no data for", sym);
                        }
                        continue;
                    }

                    const d = list[0];
                    const rawSymbol = d.symbol; // e.g. "BTCUSDT"

                    const bid = parseFloat(d.bid1Price ?? d.bestBidPrice);
                    const ask = parseFloat(d.ask1Price ?? d.bestAskPrice);

                    if (!rawSymbol || isNaN(bid) || isNaN(ask)) {
                        const key = `nobidask-${sym}`;
                        if (!warned.has(key)) {
                            warned.add(key);
                            console.warn(
                                "[bybit:spot:poll] missing bid/ask for",
                                sym,
                                "keys:",
                                Object.keys(d)
                            );
                        }
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
                } catch (err) {
                    const key = `error-${sym}`;
                    if (!warned.has(key)) {
                        warned.add(key);
                        console.warn("[bybit:spot:poll] error for", sym, err.message);
                    }
                }
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
