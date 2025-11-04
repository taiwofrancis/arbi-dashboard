// Which base/quote pairs we will monitor (canonical BASE-USDT)
export const TRACK_SYMBOLS = [
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
