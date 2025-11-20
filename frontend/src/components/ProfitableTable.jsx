// src/components/ProfitableTable.jsx
import { useMemo } from "react";
import { useCurrency } from "../i18n/CurrencyContext.jsx";

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



export default function ProfitableTable({ snapshot }) {
    const { formatPrice } = useCurrency();

    const rows = useMemo(() => {
        const acc = [];

        Object.entries(snapshot || {}).forEach(([symbol, markets]) => {
            const spot = markets?.spot || {};
            const fut = markets?.futures || {};

            Object.keys(fut).forEach((ex) => {
                const s = spot[ex];
                const f = fut[ex];
                if (!s || !f) return;

                const spotMid = (Number(s.bid ?? NaN) + Number(s.ask ?? NaN)) / 2;
                const perpMid = (Number(f.bid ?? NaN) + Number(f.ask ?? NaN)) / 2;

                if (!isFinite(spotMid) || !isFinite(perpMid) || spotMid <= 0) return;

                const diff = perpMid - spotMid;
                if (diff <= 0) return; // only profitable

                const basis = (diff / spotMid) * 100;
                const ts = Math.max(s?.ts ?? 0, f?.ts ?? 0);

                acc.push({
                    symbol,
                    exchange: ex,
                    spot: spotMid,
                    perp: perpMid,
                    diff,
                    basis,
                    ts,
                });
            });
        });

        acc.sort((a, b) => b.diff - a.diff);
        return acc;
    }, [snapshot]);

    if (!rows.length) {
        return (
            <div className="card">
                <div className="card-header">
                    <h2>Profitable Perp &gt; Spot</h2>
                    <p className="sub">No profitable opportunities right now.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header">
                <h2>Profitable Perp &gt; Spot (All Exchanges)</h2>
                <p className="sub">Perpetual price higher than Spot (positive carry)</p>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Exchange</th>
                            <th>Spot (mid)</th>
                            <th>Perp (mid)</th>
                            <th>Diff</th>
                            <th>Basis %</th>
                            <th>Last update</th>
                        </tr>
                    </thead>

                    <tbody>
                        {rows.map((r, idx) => {
                            const info = getExchangeInfo(r.exchange);
                            return (
                                <tr key={idx} className="profit-row">
                                    <td className="pair-title">{r.symbol}</td>

                                    <td className="exchange-cell">
                                        {info.logo && (
                                            <img className="ex-logo" src={info.logo} alt={info.label} />
                                        )}
                                        <span className="ex-name">{info.label}</span>
                                    </td>

                                    <td>{formatPrice(r.spot, { maxFrac: 4 })}</td>
                                    <td>{formatPrice(r.perp, { maxFrac: 4 })}</td>

                                    {/* Profit color */}
                                    <td className="profit-cell">
                                        {formatPrice(r.diff, { maxFrac: 4 })}
                                    </td>

                                    {/* Profit % in green */}
                                    <td className="profit-cell">
                                        {r.basis.toFixed(3)}%
                                    </td>

                                    <td>{new Date(r.ts).toLocaleTimeString()}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
