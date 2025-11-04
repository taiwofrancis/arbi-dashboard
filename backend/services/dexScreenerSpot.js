// backend/services/dexScreenerSpot.js
import { upsertQuote } from "./priceStore.js";

/**
 * DexScreener poller that uses the search API instead of hard-coding pair addresses.
 * For each watch item, we search "<token> USDT", filter by preferred chains,
 * select the pair with the highest liquidity, and push priceUsd as bid/ask.
 */

const POLL_MS = 6000;

// Tokens you want from DEX (will show alongside CEX in your UI)
const DEX_WATCH = [
    { query: "BNB USDT", symbol: "BNB-USDT", preferChains: ["bsc"] },
    { query: "USDC USDT", symbol: "USDC-USDT", preferChains: ["ethereum", "arbitrum", "base"] },
    { query: "CAKE USDT", symbol: "CAKE-USDT", preferChains: ["bsc"] },
    { query: "MATIC USDT", symbol: "MATIC-USDT", preferChains: ["polygon"] },
];

// simple safe fetch -> json
async function getJson(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(9000),
        headers: { "Accept": "application/json", "User-Agent": "arbi-dashboard/1.0" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

// pick best pair by preferred chains and highest liquidity.usd
function pickBestPair(pairs, preferChains) {
    if (!Array.isArray(pairs) || pairs.length === 0) return null;

    let filtered = pairs;
    if (Array.isArray(preferChains) && preferChains.length > 0) {
        const set = new Set(preferChains.map((c) => c.toLowerCase()));
        filtered = pairs.filter((p) => set.has(String(p.chainId || p.chain || p.chainName).toLowerCase()));
        if (filtered.length === 0) filtered = pairs; // fallback to any chain
    }

    filtered.sort((a, b) => {
        const la = Number(a?.liquidity?.usd || 0);
        const lb = Number(b?.liquidity?.usd || 0);
        return lb - la;
    });
    return filtered[0] || null;
}

export function startDexScreenerPoller() {
    console.log("[dexscreener] poller started (search-mode)…");

    async function pollOnce() {
        for (const w of DEX_WATCH) {
            try {
                const url = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(w.query)}`;
                const json = await getJson(url);

                // API shape: { pairs: [...] }
                const best = pickBestPair(json?.pairs, w.preferChains);
                if (!best) {
                    console.warn(`[dexscreener] no pairs found for "${w.query}"`);
                    continue;
                }

                const priceUsd = Number(best.priceUsd || 0);
                if (!priceUsd) {
                    console.warn(`[dexscreener] no priceUsd for "${w.query}" (pair ${best.pairAddress || "-"})`);
                    continue;
                }

                // We’re using priceUsd as the mid. Add a tiny synthetic spread.
                const bid = priceUsd * 0.9999;
                const ask = priceUsd * 1.0001;

                upsertQuote({
                    exchange: "dexscreener",
                    marketType: "spot",
                    symbol: w.symbol,   // keep your canonical name, e.g. "BNB-USDT"
                    bid,
                    ask,
                    ts: Date.now(),
                });
            } catch (e) {
                console.error("[dexscreener] fetch error for", w.query, e.message);
            }
        }
    }

    // start now, then repeat
    pollOnce();
    setInterval(pollOnce, POLL_MS);
}
