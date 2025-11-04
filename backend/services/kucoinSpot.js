// backend/services/kucoinSpot.js
// KuCoin spot via bullet-public -> WS /market/ticker:<pairs>

import WebSocket from "ws";
import { toCanonical } from "../utils/symbolMap.js";
import { upsertQuote } from "./priceStore.js";

// Try multiple public REST hosts (some corp/VPN networks block one or two)
const BULLET_HOSTS = [
    "https://api.kucoin.com",
    "https://openapi-v2.kucoin.com",   // alt CDN
    "https://api1.kucoin.com"          // legacy mirror sometimes alive
];
const BULLET_PATH = "/api/v1/bullet-public";

// keep initial small (you can expand)
const PAIRS = ["BTC-USDT", "ETH-USDT"];

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
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
    } finally {
        clearTimeout(t);
    }
}

async function getWsUrlWithRetry() {
    let lastErr = null;
    for (const host of BULLET_HOSTS) {
        const url = host + BULLET_PATH;
        try {
            const j = await fetchJson(url, { timeoutMs: 7000, method: "POST" });
            if (!j?.data?.token || !j?.data?.instanceServers?.length) {
                throw new Error("bad bullet-public payload");
            }
            const { token, instanceServers } = j.data;
            const endpoint = instanceServers[0].endpoint; // wss://...
            return `${endpoint}?token=${token}`;
        } catch (e) {
            lastErr = e;
            console.error("[kucoin:spot] bullet try failed", host, e.message);
        }
    }
    throw lastErr ?? new Error("bullet-public failed (no host reachable)");
}

export async function startKucoinSpot() {
    async function connect() {
        try {
            const wsUrl = await getWsUrlWithRetry();
            const ws = new WebSocket(wsUrl);
            let pingTimer = null;

            ws.on("open", () => {
                console.log("[kucoin:spot] connected");
                ws.send(JSON.stringify({
                    id: Date.now().toString(),
                    type: "subscribe",
                    topic: `/market/ticker:${PAIRS.join(",")}`,
                    privateChannel: false,
                    response: true,
                }));
                // KuCoin heartbeat ~20s
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
                    if (!msg.topic?.startsWith("/market/ticker:")) return;
                    const data = msg.data;
                    if (!data) return;

                    const sym = msg.topic.split(":")[1]; // "BTC-USDT"
                    const bid = parseFloat(data.bestBid);
                    const ask = parseFloat(data.bestAsk);
                    if (Number.isNaN(bid) || Number.isNaN(ask)) return;

                    const canonical = toCanonical("kucoin", sym, "spot");
                    upsertQuote({
                        exchange: "kucoin",
                        marketType: "spot",
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
                console.log("[kucoin:spot] socket closed (reconnecting)");
                cleanup();
                setTimeout(connect, 1500);
            });
            ws.on("error", (err) => {
                console.error("[kucoin:spot] ws error", err?.message || err);
                try { ws.close(); } catch { }
            });
        } catch (e) {
            console.error("[kucoin:spot] bullet error", e?.message || e);
            setTimeout(connect, 3000);
        }
    }
    connect();
}
