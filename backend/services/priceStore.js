// backend/services/priceStore.js

// In-memory latest quotes
// snapshot[symbol][marketType][exchange] = { bid, ask, ts }
//
// Example:
// snapshot["BTC-USDT"].spot.binance = { bid: 62000.1, ask: 62000.2, ts: 1730540000000 }

const snapshot = {};

export function upsertQuote({ exchange, marketType, symbol, bid, ask, ts }) {
    if (!symbol || !marketType || !exchange) return;
    if (!snapshot[symbol]) {
        snapshot[symbol] = {};
    }
    if (!snapshot[symbol][marketType]) {
        snapshot[symbol][marketType] = {};
    }

    snapshot[symbol][marketType][exchange] = {
        bid,
        ask,
        ts,
    };
}

// Return the full in-memory view
export function getSnapshot() {
    return snapshot;
}

// Compute spreads / opportunities
// This is optional but we keep it so the right panel still works.
export function computeSpreads() {
    // We'll build a basic list like:
    // { symbol, type: "spot-spot", buyFrom, sellTo, buyAsk, sellBid, edgePct }
    const results = [];

    Object.entries(snapshot).forEach(([symbol, markets]) => {
        // Compare spot exchanges against each other
        if (markets.spot) {
            const exchanges = Object.entries(markets.spot); // [ [ "binance", {bid,ask,...} ], ... ]

            for (let i = 0; i < exchanges.length; i++) {
                for (let j = 0; j < exchanges.length; j++) {
                    if (i === j) continue;

                    const [exBuy, quoteBuy] = exchanges[i]; // where we BUY (we pay ask)
                    const [exSell, quoteSell] = exchanges[j]; // where we SELL (we receive bid)

                    const buyAsk = quoteBuy?.ask;
                    const sellBid = quoteSell?.bid;
                    if (!buyAsk || !sellBid) continue;
                    if (buyAsk <= 0) continue;

                    const edgePct = ((sellBid - buyAsk) / buyAsk) * 100;

                    results.push({
                        symbol,
                        type: "spot-spot",
                        buyFrom: exBuy,
                        sellTo: exSell,
                        buyAsk,
                        sellBid,
                        edgePct,
                        ts: Date.now(),
                    });
                }
            }
        }

        // You can also add futures vs spot basis here if you want. We'll leave as-is.
    });

    // Sort largest % first
    results.sort((a, b) => b.edgePct - a.edgePct);

    return results.slice(0, 20); // top N
}
