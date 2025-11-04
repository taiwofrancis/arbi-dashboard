// backend/services/mexcSpotPoller.js
// Poll MEXC spot best bid/ask via a single batch request, then filter.
// Avoids 400s from per-symbol requests.

import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS } from "../config.js";

const BASE = "https://api.mexc.com";
const BATCH_PATH = "/api/v3/ticker/bookTicker";

// Build a set of raw symbols like "BTCUSDT"
const WANT = new Set(TRACK_SYMBOLS.map(s => s.replace("-", "").toUpperCase()));

// only warn once per missing symbol
const warnedMissing = new Set();

export function startMexcSpotPoller() {
    console.log("[mexc:spot:poll] starting…");

    async function pollOnce() {
        try {
            // One request returns ALL spot symbols with best bid/ask
            const res = await fetch(`${BASE}${BATCH_PATH}`, { cache: "no-store" });
            if (!res.ok) {
                console.error("[mexc:spot:poll] HTTP", res.status);
                return;
            }

            /** @type {{symbol:string,bidPrice:string,askPrice:string}[]} */
            const rows = await res.json();
            if (!Array.isArray(rows)) return;

            let hits = 0;

            for (const row of rows) {
                const raw = row.symbol?.toUpperCase();
                if (!raw || !WANT.has(raw)) continue; // only the pairs we track

                const bid = parseFloat(row.bidPrice);
                const ask = parseFloat(row.askPrice);
                if (!isFinite(bid) || !isFinite(ask)) continue;

                // Canonical symbol "BTC-USDT"
                const sym = raw.replace("USDT", "-USDT");

                upsertQuote({
                    exchange: "mexc",
                    marketType: "spot",
                    symbol: sym,
                    bid,
                    ask,
                    ts: Date.now(),
                });

                hits++;
            }

            // Optional: warn once for pairs we want but MEXC didn't return
            for (const want of WANT) {
                const seen = rows.some(r => r.symbol?.toUpperCase() === want);
                if (!seen && !warnedMissing.has(want)) {
                    warnedMissing.add(want);
                    console.warn("[mexc:spot:poll] missing from batch:", want);
                }
            }

            if (hits === 0) {
                // keep logs tame; this happens briefly at start
                // console.log("[mexc:spot:poll] no tracked symbols found in batch");
            }
        } catch (err) {
            console.error("[mexc:spot:poll] fetch error:", err.message);
        }
    }

    // first run quickly, then every 3s (safe cadence)
    pollOnce();
    setInterval(pollOnce, 3000);
}
