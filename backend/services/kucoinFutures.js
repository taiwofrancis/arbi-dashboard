// backend/services/kucoinFutures.js
// KuCoin Futures via bullet-public -> WS /contractMarket/tickerV2:<symbols>

import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

const FUT_BULLET_HOSTS = [
    "https://api-futures.kucoin.com",
    "https://futures-api.kucoin.com", // alt
];
const FUT_BULLET_PATH = "/api/v1/bullet-public";

// common perps: XBTUSDTM (BTC), ETHUSDTM
const FUT_SYMBOLS = ["XBTUSDTM", "ETHUSDTM"];

async function fetchJson(url, { timeoutMs = 6000, method = "POST", headers = {}, body } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "arbi-dashboard/1.0",
                ...headers,
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

async function getWsUrlWithRetry() {
    let lastErr = null;
    for (const host of FUT_BULLET_HOSTS) {
        const url = host + FUT_BULLET_PATH;
        try {
            const j = await fetchJson(url, { timeoutMs: 7000, method: "POST" });
            if (!j?.data?.token || !j?.data?.instanceServers?.length) {
                throw new Error("bad futures bullet-public payload");
            }
            const { token, instanceServers } = j.data;
            const endpoint = instanceServers[0].endpoint; // wss://...
            return `${endpoint}?token=${token}`;
        } catch (e) {
            lastErr = e;
            console.error("[kucoin:futures] bullet try failed", host, e.message);
        }
    }
    throw lastErr ?? new Error("futures bullet-public failed");
}

export async function startKucoinFutures() {
    async function connect() {
        try {
            const wsUrl = await getWsUrlWithRetry();
            const ws = new WebSocket(wsUrl);
            let pingTimer = null;

            ws.on("open", () => {
                console.log("[kucoin:futures] connected");
                ws.send(JSON.stringify({
                    id: Date.now().toString(),
                    type: "subscribe",
                    topic: `/contractMarket/tickerV2:${FUT_SYMBOLS.join(",")}`,
                    privateChannel: false,
                    response: true,
                }));
                pingTimer = setInterval(() => {
                    if (ws.readyState === 1) {
                        ws.send(JSON.stringify({ id: Date.now().toString(), type: "ping" }));
                    }
                }, 20000);
            });

            ws.on("message", (raw) => {
                try {
                    const msg = JSON.parse(raw.toString());
                    if (msg.type === "pong") return;
                    if (msg.type !== "message") return;
                    if (!msg.topic?.startsWith("/contractMarket/tickerV2:")) return;

                    const row = msg.data;
                    if (!row) return;

                    const rawProd = msg.topic.split(":")[1]; // "XBTUSDTM"
                    const bid = parseFloat(row.bestBidPrice ?? row.bestBid);
                    const ask = parseFloat(row.bestAskPrice ?? row.bestAsk);
                    if (Number.isNaN(bid) || Number.isNaN(ask)) return;

                    const canonical = toCanonical("kucoin", rawProd, "futures"); // -> "BTC-USDT"
                    upsertQuote({
                        exchange: "kucoin",
                        marketType: "futures",
                        symbol: canonical,
                        bid,
                        ask,
                        ts: Date.now(),
                    });
                } catch { }
            });

            const cleanup = () => {
                if (pingTimer) clearInterval(pingTimer);
            };
            ws.on("close", () => {
                console.log("[kucoin:futures] socket closed (reconnecting)");
                cleanup();
                setTimeout(connect, 1500);
            });
            ws.on("error", (err) => {
                console.error("[kucoin:futures] ws error", err?.message || err);
                cleanup();
                try { ws.close(); } catch { }
            });
        } catch (e) {
            console.error("[kucoin:futures] bullet error", e?.message || e);
            setTimeout(connect, 3000);
        }
    }
    connect();
}
