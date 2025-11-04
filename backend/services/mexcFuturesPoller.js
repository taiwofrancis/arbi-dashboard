// backend/services/mexcFuturesPoller.js
// Poll MEXC USDT-M perpetuals (contract API). Batch if available; otherwise loop politely.

import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS } from "../config.js";

const BASE = "https://contract.mexc.com/api/v1/contract";
// Some deployments also mirror at: https://futures.mexc.com/api/v1/contract

// MEXC futures uses "BTC_USDT" symbol format.
const WANT = TRACK_SYMBOLS.map(s => s.replace("-", "_").toUpperCase());

// Log once helpers
const warned = new Set();

export function startMexcFuturesPoller() {
    console.log("[mexc:futures:poll] starting…");

    async function pollOnce() {
        try {
            // Try batch first (supported on most current deployments)
            // GET /ticker?symbol=all  -> [{symbol:'BTC_USDT', lastPrice:'', bid1:'', ask1:''}, ...]
            const res = await fetch(`${BASE}/ticker?symbol=all`, { cache: "no-store" });
            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows?.data)) {
                    let n = 0;
                    for (const r of rows.data) {
                        const sym = r.symbol?.toUpperCase();
                        if (!sym || !WANT.includes(sym)) continue;

                        const bid = parseFloat(r.bid1 ?? r.bestBid ?? r.bidPrice);
                        const ask = parseFloat(r.ask1 ?? r.bestAsk ?? r.askPrice);
                        if (!isFinite(bid) || !isFinite(ask)) continue;

                        // canonical "BTC-USDT"
                        const canon = sym.replace("_", "-");

                        upsertQuote({
                            exchange: "mexc",
                            marketType: "futures",
                            symbol: canon,
                            bid,
                            ask,
                            ts: Date.now(),
                        });
                        n++;
                    }
                    if (n === 0 && !warned.has("empty-batch")) {
                        warned.add("empty-batch");
                        console.warn("[mexc:futures:poll] no tracked symbols found in batch");
                    }
                    return;
                }
            }

            // Fallback: polite per-symbol loop (slower but works everywhere)
            for (const sym of WANT) {
                try {
                    const r = await fetch(`${BASE}/ticker?symbol=${sym}`, { cache: "no-store" });
                    if (!r.ok) {
                        if (!warned.has(`${sym}-${r.status}`)) {
                            warned.add(`${sym}-${r.status}`);
                            console.warn("[mexc:futures:poll] HTTP", r.status, "for", sym);
                        }
                        continue;
                    }
                    const json = await r.json();
                    const row = Array.isArray(json?.data) ? json.data[0] : json?.data;
                    if (!row) continue;

                    const bid = parseFloat(row.bid1 ?? row.bestBid ?? row.bidPrice);
                    const ask = parseFloat(row.ask1 ?? row.bestAsk ?? row.askPrice);
                    if (!isFinite(bid) || !isFinite(ask)) continue;

                    const canon = sym.replace("_", "-"); // BTC_USDT -> BTC-USDT
                    upsertQuote({
                        exchange: "mexc",
                        marketType: "futures",
                        symbol: canon,
                        bid,
                        ask,
                        ts: Date.now(),
                    });

                    // small delay between symbols to avoid burst
                    await new Promise(r => setTimeout(r, 80));
                } catch (e) {
                    if (!warned.has(sym)) {
                        warned.add(sym);
                        console.warn("[mexc:futures:poll] error", sym, e.message);
                    }
                }
            }
        } catch (err) {
            console.error("[mexc:futures:poll] fetch error:", err.message);
        }
    }

    pollOnce();
    setInterval(pollOnce, 3000);
}
