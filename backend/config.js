// Which base/quote pairs we will monitor (canonical BASE-USDT)
export const TRACK_SYMBOLS = [

    // --- Brazil view ---
    "BRL-USDT",
    // --- Majors ---
    "BTC-USDT",
    "ETH-USDT",
    "BNB-USDT",
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
    "ATOM-USDT",
    "ETC-USDT",

    // --- Layer 2 + Infra ---
    "OP-USDT",
    "ARB-USDT",
    "BASE-USDT",
    "MANTA-USDT",
    "METIS-USDT",
    "COTI-USDT",
    "SKL-USDT",

    // --- High Volume ALT L1s ---
    "NEAR-USDT",
    "APT-USDT",
    "SUI-USDT",
    "FTM-USDT",
    "ALGO-USDT",
    "XTZ-USDT",
    "KAS-USDT",
    "ICP-USDT",
    "FIL-USDT",
    "HNT-USDT",

    // --- AI / DePIN / Big narrative coins ---
    "RNDR-USDT",
    "FET-USDT",
    "AGIX-USDT",
    "OCEAN-USDT",
    "WLD-USDT",
    "TAO-USDT",
    "GRT-USDT",
    "NKN-USDT",
    "MDT-USDT",

    // --- Oracle / DeFi / Infrastructure ---
    "AAVE-USDT",
    "CRV-USDT",
    "SNX-USDT",
    "COMP-USDT",
    "UNI-USDT",
    "YFI-USDT",
    "LDO-USDT",
    "RPL-USDT",

    // --- New Gen High Volume Coins ---
    "TIA-USDT",
    "SEI-USDT",
    "PYTH-USDT",
    "JUP-USDT",
    "ENA-USDT",
    "PORTAL-USDT",
    "AEVO-USDT",
    "ALT-USDT",

    // --- Meme / Volume monsters ---
    "PEPE-USDT",
    "SHIB-USDT",
    "WIF-USDT",
    "FLOKI-USDT",
    "BONK-USDT",
    "MEME-USDT",
    "DOG-USDT",

    // --- Stablecoins / FX ---
    "USDC-USDT",
    "FDUSD-USDT",
    "TUSD-USDT",
    "DAI-USDT",

    // --- Commodity tokens / extra ---
    "XAU-USDT",   // Gold token (if supported)
    "XAG-USDT",   // Silver token


];


// Broadcast cadence to the frontend
export const BROADCAST_INTERVAL_MS = 700;

// Binance WS bases
export const BINANCE_SPOT_WS_BASE = "wss://stream.binance.com:9443/stream";
export const BINANCE_FUTURES_WS_BASE = "wss://fstream.binance.com/stream";

// Bybit WS bases (v5)
export const BYBIT_SPOT_WS_BASE = "wss://stream.bybit.com/v5/public/spot";
export const BYBIT_FUTURES_WS_BASE = "wss://stream.bybit.com/v5/public/linear";

// Gate.io WS bases (v4)
export const GATE_SPOT_WS_BASE = "wss://api.gateio.ws/ws/v4/";
export const GATE_FUTURES_WS_BASE = "wss://fx-ws.gateio.ws/v4/ws/usdt";

// Coinbase spot WS (note: -USD products; we map to -USDT canonical)
export const COINBASE_WS_BASE = "wss://ws-feed.exchange.coinbase.com";

// Kraken futures WS (perps like PI-XBTUSD etc.)
export const KRAKEN_FUTURES_WS_BASE = "wss://futures.kraken.com/ws/v1";
