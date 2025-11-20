// src/components/SpotPerpTables.jsx
import { useMemo } from "react";
import { useCurrency } from "../i18n/CurrencyContext.jsx";

// Local exchange meta (logo + nice label)
// Make sure the logo files exist at these paths.
const EXCHANGE_META = {
    binance: { label: "Binance", logo: "/logos/binance.png" },
    bybit: { label: "Bybit", logo: "/logos/bybit.png" },
    okx: { label: "OKX", logo: "/logos/okx.png" },
    gate: { label: "Gate.io", logo: "/logos/gate.png" },
    coinbase: { label: "Coinbase", logo: "/logos/coinbase.png" },
    kraken: { label: "Kraken", logo: "/logos/kraken.png" },
    kucoin: { label: "KuCoin", logo: "/logos/kucoin.png" },
    mexc: { label: "MEXC", logo: "/logos/mexc.png" },
};

function getExchangeInfo(key) {
    return EXCHANGE_META[key] || { label: key, logo: "/logos/default.png" };
}

// Safe mid helper: prefer true mid if both sides available, else use whichever exists.
// Returns null if neither is a finite number.
function safeMid(bid, ask) {
    const b = Number.isFinite(bid) ? Number(bid) : null;
    const a = Number.isFinite(ask) ? Number(ask) : null;
    if (b != null && a != null) return (b + a) / 2;
    if (b != null) return b;
    if (a != null) return a;
    return null;
}

/**
 * Build per-symbol rows where each row is one exchange with:
 *   spot mid, perp mid, diff, basis%
 * snapshot shape:
 * {
 *   "BTC-USDT": {
 *     spot:    { binance: {bid, ask, ts}, gate: {...}, ... },
 *     futures: { binance: {bid, ask, ts}, gate: {...}, ... }
 *   },
 *   ...
 * }
 */
function buildPerSymbol(snapshot) {
    const out = {};

    Object.entries(snapshot || {}).forEach(([symbol, markets]) => {
        const rows = [];
        const spot = markets?.spot || {};
        const fut = markets?.futures || {};

        const exchanges = new Set([...Object.keys(spot), ...Object.keys(fut)]);

        exchanges.forEach((ex) => {
            const s = spot[ex];
            const f = fut[ex];

            const spotMid = s ? safeMid(s.bid, s.ask) : null;
            const perpMid = f ? safeMid(f.bid, f.ask) : null;

            const hasSpot = spotMid != null;
            const hasPerp = perpMid != null;

            let diff = null;
            let basisPct = null;
            if (hasSpot && hasPerp && spotMid > 0) {
                diff = perpMid - spotMid;
                basisPct = (diff / spotMid) * 100;
            }

            rows.push({
                exchange: ex,
                spot: hasSpot ? spotMid : null,
                perp: hasPerp ? perpMid : null,
                diff,
                basisPct,
                ts: Math.max(s?.ts ?? 0, f?.ts ?? 0) || null,
            });
        });

        // Sort: rows with a valid diff first (largest |diff| at top), then those with no diff
        rows.sort((a, b) => {
            const aValid = a.diff != null;
            const bValid = b.diff != null;
            if (aValid && bValid) return Math.abs(b.diff) - Math.abs(a.diff);
            if (aValid) return -1;
            if (bValid) return 1;
            // If neither has diff, put the most recent first
            return (b.ts ?? 0) - (a.ts ?? 0);
        });

        out[symbol] = rows;
    });

    return out;
}

/* =======================
 * ORIGINAL FULL TABLE
 * ======================= */

export default function SpotPerpTables({ snapshot, symbolsOrder }) {
    const perSymbol = useMemo(() => buildPerSymbol(snapshot), [snapshot]);
    const { formatPrice } = useCurrency();

    const order =
        symbolsOrder ??
        Object.keys(perSymbol).sort((a, b) => {
            const prio = (sym) =>
                sym.startsWith("BTC") ? 0 :
                    sym.startsWith("ETH") ? 1 :
                        sym === "BRL-USDT" ? 2 : 3; // keep BRL near top if present
            const pa = prio(a);
            const pb = prio(b);
            return pa !== pb ? pa - pb : a.localeCompare(b);
        });

    if (!order.length) {
        return (
            <div className="symbol-tables-grid">
                <div className="card">
                    <div className="card-header">
                        <h2>No data yet</h2>
                        <p className="sub">Waiting for first spot & perp quotes…</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="symbol-tables-grid">
            {order.map((symbol) => {
                const rows = perSymbol[symbol] || [];
                return (
                    <div className="card" key={symbol}>
                        <div className="card-header">
                            <h2 className="pair-title">{symbol}</h2>
                            <p className="sub">
                                Same-exchange comparison: Spot vs Perpetual (real-time)
                            </p>
                        </div>

                        <div className="table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
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
                                        const cls =
                                            r.diff == null
                                                ? "diff-neutral"
                                                : r.diff > 0
                                                    ? "diff-up"
                                                    : "diff-down";

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

                                                <td className="price-ask">
                                                    {r.spot != null
                                                        ? formatPrice(r.spot, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className="price-ask">
                                                    {r.perp != null
                                                        ? formatPrice(r.perp, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className={`price-cell ${cls}`}>
                                                    {r.diff != null
                                                        ? formatPrice(r.diff, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className={`basis-cell ${cls}`}>
                                                    {r.basisPct != null
                                                        ? `${r.basisPct.toFixed(3)}%`
                                                        : "—"}
                                                </td>

                                                <td className="ts-cell">
                                                    {r.ts
                                                        ? new Date(r.ts).toLocaleTimeString()
                                                        : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* =======================
 * NEW: PROFITS-ONLY TABLE
 * ======================= */

export function SpotPerpProfitsTable({ snapshot, symbolsOrder }) {
    const perSymbol = useMemo(() => buildPerSymbol(snapshot), [snapshot]);
    const { formatPrice } = useCurrency();

    const baseOrder =
        symbolsOrder ??
        Object.keys(perSymbol).sort((a, b) => {
            const prio = (sym) =>
                sym.startsWith("BTC") ? 0 :
                    sym.startsWith("ETH") ? 1 :
                        sym === "BRL-USDT" ? 2 : 3;
            const pa = prio(a);
            const pb = prio(b);
            return pa !== pb ? pa - pb : a.localeCompare(b);
        });

    // Only keep symbols where at least one exchange has perp > spot
    const profitableSymbols = baseOrder.filter((symbol) => {
        const rows = perSymbol[symbol] || [];
        return rows.some((r) => r.diff != null && r.diff > 0);
    });

    if (!profitableSymbols.length) {
        return (
            <div className="symbol-tables-grid">
                <div className="card">
                    <div className="card-header">
                        <h2>No positive basis right now</h2>
                        <p className="sub">
                            Waiting for perpetual price to trade above spot on at least one exchange…
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="symbol-tables-grid">
            {profitableSymbols.map((symbol) => {
                const allRows = perSymbol[symbol] || [];
                const rows = allRows.filter((r) => r.diff != null && r.diff > 0);

                const prettyTitle =
                    symbol === "BRL-USDT" ? "🇧🇷 BRL / USDT" : symbol;

                return (
                    <div className="card" key={symbol}>
                        <div className="card-header">
                            <h2 className="pair-title">{prettyTitle}</h2>
                            <p className="sub">
                                Only exchanges where Perpetual price &gt; Spot price (positive carry)
                            </p>
                        </div>

                        <div className="table-wrapper">
                            <table className="data-table">
                                <thead>
                                    <tr>
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

                                                <td className="price-ask">
                                                    {r.spot != null
                                                        ? formatPrice(r.spot, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className="price-ask">
                                                    {r.perp != null
                                                        ? formatPrice(r.perp, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className="price-cell diff-up">
                                                    {r.diff != null
                                                        ? formatPrice(r.diff, { maxFrac: 4 })
                                                        : "—"}
                                                </td>

                                                <td className="basis-cell diff-up">
                                                    {r.basisPct != null
                                                        ? `${r.basisPct.toFixed(3)}%`
                                                        : "—"}
                                                </td>

                                                <td className="ts-cell">
                                                    {r.ts
                                                        ? new Date(r.ts).toLocaleTimeString()
                                                        : "—"}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
