// backend/server.js
import express from "express";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

import { getSnapshot, computeSpreads } from "./services/priceStore.js";
import { BROADCAST_INTERVAL_MS } from "./config.js";

// --- Active feeds ---
import { startBinanceSpot } from "./services/binanceSpot.js";
import { startBinanceFutures } from "./services/binanceFutures.js";

import { startBybitSpotPoller } from "./services/bybitSpotPoller.js";
import { startBybitFutures } from "./services/bybitFutures.js";

import { startMexcSpotPoller } from "./services/mexcSpotPoller.js";
import { startMexcFuturesPoller } from "./services/mexcFuturesPoller.js";

// --- Optional feeds (leave disabled unless you want them on) ---
// import { startCoinbaseSpot } from "./services/coinbaseSpot.js";
// import { startKrakenSpotPoller } from "./services/krakenSpotPoller.js";
// import { startKrakenFutures } from "./services/krakenFutures.js";
// import { startGateSpot } from "./services/gateSpot.js";
// import { startGateFutures } from "./services/gateFutures.js";
// import { startDexScreenerPoller } from "./services/dexScreenerSpot.js";
// import { startOkxSpot } from "./services/okxSpot.js";
// import { startOkxFutures } from "./services/okxFutures.js";
// import { startKucoinSpot } from "./services/kucoinSpot.js";
// import { startKucoinFutures } from "./services/kucoinFutures.js";

const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/api/status", (_req, res) => {
    res.json({
        ok: true,
        exchanges: [
            "binance-spot",
            "binance-futures",
            "bybit-spot(poller)",
            "bybit-futures",
            "mexc-spot(poller)",
            "mexc-futures(poller)",
            // "coinbase-spot",
            // "kraken-spot(poller)",
            // "kraken-futures",
            // "gate-spot",
            // "gate-futures",
            // "okx-spot",
            // "okx-futures",
            // "kucoin-spot",
            // "kucoin-futures",
            // "dexscreener-spot",
        ],
        updated: Date.now(),
    });
});

app.get("/api/snapshot", (_req, res) => {
    res.json({
        data: getSnapshot(),
        spreads: computeSpreads(),
    });
});

const server = http.createServer(app);

// Socket.IO
const io = new SocketIOServer(server, { cors: { origin: "*" } });

io.on("connection", (socket) => {
    console.log("[io] client connected:", socket.id);
    socket.emit("hello", { msg: "connected to arbi backend" });
    socket.on("disconnect", () => console.log("[io] client disconnected:", socket.id));
});

// Broadcast loop
setInterval(() => {
    io.emit("market:update", {
        snapshot: getSnapshot(),
        spreads: computeSpreads(),
        ts: Date.now(),
    });
}, BROADCAST_INTERVAL_MS);

// --- Start active feeds ---
startBinanceSpot();
startBinanceFutures();

startBybitSpotPoller();
startBybitFutures();

startMexcSpotPoller();
startMexcFuturesPoller();

// --- Optional starters ---
// startCoinbaseSpot();
// startKrakenSpotPoller();
// startKrakenFutures();
// startGateSpot();
// startGateFutures();
// startDexScreenerPoller();
// startOkxSpot();
// startOkxFutures();
// startKucoinSpot();
// startKucoinFutures();

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
