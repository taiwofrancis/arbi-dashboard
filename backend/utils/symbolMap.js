// backend/utils/symbolMap.js
//
// Normalize all exchange symbols into canonical "BASE-QUOTE"
// e.g. "BTC-USDT". Keeps logic minimal but robust across adapters.

const MANUAL_FUTURES_MAP = {
    // Kraken Futures perpetuals
    PI_XBTUSD: { base: "BTC", quote: "USD" },
    PI_ETHUSD: { base: "ETH", quote: "USD" },
};

// known quotes to help split concatenated pairs
const QUOTES = ["USDT", "USDC", "USD", "BUSD", "EUR", "GBP", "TRY"];

// Map odd bases to canonical
function normalizeBase(base) {
    const b = base.toUpperCase();
    if (b === "XBT") return "BTC";   // Kraken/KuCoin use XBT
    return b;
}
function normalizeQuote(q) {
    return q.toUpperCase();
}

export function toCanonical(exchange, rawSymbol, marketType = "spot") {
    if (!rawSymbol) return null;

    // Strings only
    let sym = String(rawSymbol);

    // 0) Quick trims and separators unified
    sym = sym.trim();
    sym = sym.replace(/\s+/g, "");
    sym = sym.replace(/\//g, "-");   // "XBT/USDT" -> "XBT-USDT"
    sym = sym.replace(/_/g, "-");    // "BTC_USDT" -> "BTC-USDT"

    // 1) Kraken Futures hard map (PI_XBTUSD, etc.)
    if (MANUAL_FUTURES_MAP[sym]) {
        const { base, quote } = MANUAL_FUTURES_MAP[sym];
        return `${normalizeBase(base)}-${normalizeQuote(quote)}`;
    }

    // 2) OKX perps: "BTC-USDT-SWAP" -> "BTC-USDT"
    if (sym.toUpperCase().endsWith("-SWAP")) {
        const trimmed = sym.slice(0, -5);
        const [b, q] = trimmed.toUpperCase().split("-");
        return `${normalizeBase(b)}-${normalizeQuote(q)}`;
    }

    // 3) Already looks like BASE-QUOTE
    if (sym.includes("-")) {
        const [rawB, rawQ] = sym.toUpperCase().split("-");
        const base = normalizeBase(rawB);
        const quote = normalizeQuote(rawQ);
        return `${base}-${quote}`;
    }

    // 4) KuCoin Futures concatenated with trailing 'M': e.g. XBTUSDTM, ETHUSDTM
    //    Strip terminal 'M' if present and then split base/quote.
    {
        const u = sym.toUpperCase();
        const withoutM = u.endsWith("M") ? u.slice(0, -1) : u;

        for (const q of QUOTES) {
            if (withoutM.endsWith(q)) {
                const base = withoutM.slice(0, withoutM.length - q.length);
                if (base) {
                    return `${normalizeBase(base)}-${normalizeQuote(q)}`;
                }
            }
        }
    }

    // 5) Generic concatenated like "BTCUSDT", "ETHUSD", Bybit/Binance style
    {
        const u = sym.toUpperCase().replace(/[^A-Z0-9]/g, "");
        for (const q of QUOTES) {
            if (u.endsWith(q)) {
                const base = u.slice(0, u.length - q.length);
                if (base) {
                    return `${normalizeBase(base)}-${normalizeQuote(q)}`;
                }
            }
        }
    }

    // 6) Fallback: uppercase as-is (rare)
    return sym.toUpperCase();
}
