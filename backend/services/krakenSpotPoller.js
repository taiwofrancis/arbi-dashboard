// services/krakenSpotPoller.js
import { upsertQuote } from "./priceStore.js";
import { TRACK_SYMBOLS } from "../config.js";

/**
 * Kraken SPOT Poller (REST)
 * - Tries USDT alt pair first (e.g., XBTUSDT), then USD fallback (XBTUSD)
 * - Sequential polling to be polite and avoid rate limits
 * - No overlapping loops; next tick starts only after current finishes
 * - Uses AbortSignal.timeout for clean per-request timeouts
 */

const INTERVAL_MS = 3000;          // wait this long between full passes
const REQ_TIMEOUT_MS = 9000;       // per-request timeout

const K_TICKER = "https://api.kraken.com/0/public/Ticker?pair=";

// Map our canonical base to Kraken alt base (BTC->XBT)
const BASE_TO_KRAKEN = {
    BTC: "XBT",
    XBT: "XBT",
    ETH: "ETH",
    SOL: "SOL",
    XRP: "XRP",
    ADA: "ADA",
    DOGE: "DOGE",
    TRX: "TRX",
    MATIC: "MATIC",
    LTC: "LTC",
    LINK: "LINK",
    BCH: "BCH",
    DOT: "DOT",
    AVAX: "AVAX",
    TON: "TON",
};

function wantedCanonicalsUSDT() {
    return TRACK_SYMBOLS.filter((s) => s.toUpperCase().endsWith("-USDT"));
}

function toAltBase(base) {
    return BASE_TO_KRAKEN[base] || base;
}

// Build Kraken alt pair candidates for a canonical symbol
// e.g. "BTC-USDT" -> ["XBTUSDT", "XBTUSD"]
function buildAltCandidates(canonical) {
    const [base, quote] = canonical.toUpperCase().split("-");
    if (!base || quote !== "USDT") return [];
    const alt = toAltBase(base);
    return [`${alt}USDT`, `${alt}USD`];
}

// Simple JSON fetch with timeout
async function getJson(url) {
    const res = await fetch(url, {
        signal: AbortSignal.timeout(REQ_TIMEOUT_MS),
        headers: {
            "User-Agent": "arbi-dashboard/1.0",
            "Accept": "application/json",
        },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.json();
}

// Try one alt pair; return { bid, ask } or null
async function tryOneAltPair(altPair) {
    const url = K_TICKER + encodeURIComponent(altPair);
    const json = await getJson(url);

    if (Array.isArray(json?.error) && json.error.length > 0) {
        // e.g., ["EQuery:Unknown asset pair"]
        return null;
    }
    const result = json?.result || {};
    const key = Object.keys(result)[0];
    if (!key) return null;

    const t = result[key];
    const ask = parseFloat(t?.a?.[0]);
    const bid = parseFloat(t?.b?.[0]);
    if (isNaN(bid) || isNaN(ask)) return null;

    return { bid, ask };
}

// Try USDT first, then USD
async function fetchBestBidAskForCanonical(canonical) {
    const candidates = buildAltCandidates(canonical);
    for (const altPair of candidates) {
        try {
            const res = await tryOneAltPair(altPair);
            if (res) return res;
        } catch (e) {
            // Timeout or network error; continue to next candidate
            // console.log("[kraken:spot:poll] fetch error", altPair, e.message);
        }
    }
    return null;
}

export function startKrakenSpotPoller() {
    console.log("[kraken:spot:poll] starting REST poller…");

    let stopped = false;
    let timer = null;

    const canonList = wantedCanonicalsUSDT();
    if (canonList.length === 0) {
        console.log("[kraken:spot:poll] no USDT canonicals in TRACK_SYMBOLS");
        return () => { };
    }
    console.log(
        "[kraken:spot:poll] tracking",
        canonList.length,
        "symbols:",
        canonList.slice(0, 8).join(", "),
        canonList.length > 8 ? "..." : ""
    );

    async function runOnce() {
        for (const canonical of canonList) {
            if (stopped) return;
            const res = await fetchBestBidAskForCanonical(canonical);
            if (res) {
                upsertQuote({
                    exchange: "kraken",
                    marketType: "spot",
                    symbol: canonical,
                    bid: res.bid,
                    ask: res.ask,
                    ts: Date.now(),
                });
            }
        }
    }

    async function loop() {
        try {
            await runOnce();
        } finally {
            if (!stopped) {
                timer = setTimeout(loop, INTERVAL_MS);
            }
        }
    }

    loop();

    return () => {
        stopped = true;
        if (timer) clearTimeout(timer);
        console.log("[kraken:spot:poll] stopped");
    };
}
