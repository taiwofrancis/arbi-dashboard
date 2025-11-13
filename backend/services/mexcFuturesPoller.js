// backend/services/mexcFuturesPoller.js
// Poll MEXC USDT-M perpetuals (contract API). Batch if available; otherwise loop politely.

import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS } from "../config.js";

const BASE = "https://contract.mexc.com/api/v1/contract";

// MEXC futures uses "BTC_USDT" symbol format.
const WANT = TRACK_SYMBOLS.map((s) => s.replace("-", "_").toUpperCase());

// Log-once helpers
const warned = new Set();
// Symbols that returned 403 (forbidden) – we stop polling them after first 403
const disabled = new Set();

export function startMexcFuturesPoller() {
    console.log("[mexc:futures:poll] starting…");

    async function pollOnce() {
        try {
            // 1) Try batch ticker first: /ticker?symbol=all
            //    This avoids hammering per-symbol endpoints.
            const res = await fetch(`${BASE}/ticker?symbol=all`, { cache: "no-store" });

            if (res.ok) {
                const rows = await res.json();
                if (Array.isArray(rows?.data)) {
                    let n = 0;
                    for (const r of rows.data) {
                        const sym = r.symbol?.toUpperCase();
                        if (!sym || !WANT.includes(sym)) continue;
                        if (disabled.has(sym)) continue; // skip forbidden ones

                        const bid = parseFloat(r.bid1 ?? r.bestBid ?? r.bidPrice);
                        const ask = parseFloat(r.ask1 ?? r.bestAsk ?? r.askPrice);
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
                        n++;
                    }

                    if (n === 0 && !warned.has("empty-batch")) {
                        warned.add("empty-batch");
                        console.warn("[mexc:futures:poll] no tracked symbols found in batch");
                    }

                    // Batch succeeded – no need to hit the per-symbol fallback.
                    return;
                }
            } else if (!warned.has(`batch-${res.status}`)) {
                warned.add(`batch-${res.status}`);
                console.warn("[mexc:futures:poll] batch HTTP", res.status);
            }

            // 2) Fallback: polite per-symbol loop for deployments that don’t support 'symbol=all'
            for (const sym of WANT) {
                if (disabled.has(sym)) continue;

                try {
                    const r = await fetch(`${BASE}/ticker?symbol=${sym}`, { cache: "no-store" });

                    if (!r.ok) {
                        // 403 = forbidden → probably not available without auth; disable permanently
                        if (r.status === 403) {
                            if (!warned.has(`${sym}-403`)) {
                                warned.add(`${sym}-403`);
                                console.warn("[mexc:futures:poll] HTTP 403 for", sym, "→ disabling this symbol");
                            }
                            disabled.add(sym);
                            continue;
                        }

                        // Other status codes: warn once per (sym,status)
                        const key = `${sym}-${r.status}`;
                        if (!warned.has(key)) {
                            warned.add(key);
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

                    // tiny delay between symbols to avoid hammering the API
                    await new Promise((resolve) => setTimeout(resolve, 80));
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

    // First run immediately, then every 3s
    pollOnce();
    setInterval(pollOnce, 3000);
}
