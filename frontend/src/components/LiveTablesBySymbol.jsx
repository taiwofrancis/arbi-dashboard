// src/components/LiveTablesBySymbol.jsx
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext.jsx";

// all logos now come from public/logos
const EXCHANGE_META = {
    binance: { label: "Binance", logo: "/logos/full-binance.png" },
    bybit: { label: "Bybit", logo: "/logos/bybit_logo-min.png" },
    gate: { label: "Gate.io", logo: "/logos/full-gate-io-logo.png" },
    mexc: { label: "MEXC", logo: "/logos/mexc-logo.png" },

    // The rest below are correct only if you actually add the logos later
    coinbase: { label: "Coinbase", logo: "/logos/coinbase.png" },
    kraken: { label: "Kraken", logo: "/logos/kraken.png" },
    okx: { label: "OKX", logo: "/logos/okx.png" },
    kucoin: { label: "KuCoin", logo: "/logos/kucoin.png" },
};


function getExchangeInfo(key) {
    return EXCHANGE_META[key] || { label: key, logo: "/logos/default.png" };
}


// ...inside your component where you render the exchange cell:
{/* example */ }
/*
const info = getExchangeInfo(exchangeKey);
<img className="ex-logo" src={info.logo} alt={info.label} />
<span className="ex-name">{info.label}</span>
*/


// Build table rows from backend snapshot (SPOT only)
function buildRowsPerSymbol(snapshot) {
    const out = {};

    Object.entries(snapshot || {}).forEach(([symbol, markets]) => {
        if (!markets.spot) return;
        Object.entries(markets.spot).forEach(([exchange, q]) => {
            if (!out[symbol]) out[symbol] = [];
            out[symbol].push({
                symbol,
                exchange,
                bid: q.bid,
                ask: q.ask,
                ts: q.ts,
            });
        });
    });

    // sort rows per symbol by best bid (highest first)
    Object.keys(out).forEach((symbol) => {
        out[symbol].sort((a, b) => (b.bid || 0) - (a.bid || 0));
    });

    return out;
}

export default function LiveTablesBySymbol({ snapshot }) {
    const { t } = useLanguage();
    const perSymbol = buildRowsPerSymbol(snapshot);

    // persistent up/down color
    const lastBidRef = useRef({});
    const [diffMap, setDiffMap] = useState({});

    useEffect(() => {
        const newDiffs = { ...diffMap };
        const newLast = { ...lastBidRef.current };

        Object.entries(perSymbol).forEach(([symbol, rows]) => {
            rows.forEach((row) => {
                const key = `${symbol}:${row.exchange}`;
                const prev = lastBidRef.current[key];
                const curr = row.bid;

                if (prev === undefined) {
                    newDiffs[key] = "same";
                } else if (curr > prev) {
                    newDiffs[key] = "up";
                } else if (curr < prev) {
                    newDiffs[key] = "down";
                }
                // if same, keep previous color

                newLast[key] = curr;
            });
        });

        lastBidRef.current = newLast;
        setDiffMap(newDiffs);
    }, [snapshot]); // run whenever new market data comes in

    // sort cards: BTC first, ETH second
    const symbolOrder = Object.keys(perSymbol).sort((a, b) => {
        const prio = (sym) => (sym.startsWith("BTC") ? 0 : sym.startsWith("ETH") ? 1 : 2);
        const pa = prio(a);
        const pb = prio(b);
        return pa !== pb ? pa - pb : a.localeCompare(b);
    });

    if (symbolOrder.length === 0) {
        return (
            <div className="symbol-tables-grid">
                <div className="card">
                    <div className="card-header">
                        <h2>{t("noDataTitle")}</h2>
                        <p className="sub">{t("noDataSubtitle")}</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="symbol-tables-grid">
            {symbolOrder.map((symbol) => (
                <div className="card" key={symbol}>
                    <div className="card-header">
                        <h2 className="pair-title">{symbol}</h2>
                        <p className="sub">{t("pairSubtitle")}</p>
                    </div>

                    <div className="table-wrapper">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>{t("tableExchange")}</th>
                                    <th>{t("tableBid")}</th>
                                    <th>{t("tableAsk")}</th>
                                    <th>{t("tableLastUpdate")}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {perSymbol[symbol].map((row, idx) => {
                                    const key = `${row.symbol}:${row.exchange}`;
                                    const movement = diffMap[key] || "same";
                                    const info = getExchangeInfo(row.exchange);

                                    return (
                                        <tr key={idx}>
                                            <td className="exchange-cell">
                                                {info.logo ? (
                                                    <img
                                                        className="ex-logo"
                                                        src={info.logo}
                                                        alt={info.label}
                                                    />
                                                ) : (
                                                    <div className="ex-logo ex-fallback">
                                                        {info.label?.[0]?.toUpperCase() || "?"}
                                                    </div>
                                                )}
                                                <span className="ex-name">{info.label}</span>
                                            </td>

                                            <td className="price-cell">
                                                <PriceWithDirection price={row.bid} movement={movement} />
                                            </td>

                                            <td className="price-ask">
                                                {row.ask !== undefined ? Number(row.ask).toFixed(4) : "-"}
                                            </td>

                                            <td className="ts-cell">
                                                {row.ts
                                                    ? new Date(row.ts).toLocaleTimeString()
                                                    : "-"}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            ))}
        </div>
    );
}

function PriceWithDirection({ price, movement }) {
    if (price === undefined || price === null) return <span>-</span>;
    const formatted = Number(price).toFixed(4);

    if (movement === "up") {
        return (
            <span className="dir-up">
                <span className="arrow">▲</span> {formatted}
            </span>
        );
    }
    if (movement === "down") {
        return (
            <span className="dir-down">
                <span className="arrow">▼</span> {formatted}
            </span>
        );
    }
    return <span className="dir-same">{formatted}</span>;
}
