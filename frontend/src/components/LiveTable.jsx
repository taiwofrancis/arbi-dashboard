import React from "react";

export default function LiveTable({ snapshot }) {
    // We'll group rows by (symbol, marketType),
    // then sort each group by bid descending.

    const grouped = {};

    Object.entries(snapshot || {}).forEach(([symbol, markets]) => {
        ["spot", "futures"].forEach((marketType) => {
            const exMap = markets[marketType] || {};
            Object.entries(exMap).forEach(([exchange, q]) => {
                const row = {
                    symbol,
                    marketType,
                    exchange,
                    bid: q.bid,
                    ask: q.ask,
                    ts: q.ts
                };
                const key = `${symbol}__${marketType}`;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            });
        });
    });

    // Flatten out but internally sorted
    const finalRows = [];
    Object.keys(grouped).forEach((key) => {
        const rows = grouped[key].sort(
            (a, b) => (b.bid || 0) - (a.bid || 0)
        );
        rows.forEach((r) => finalRows.push(r));
    });

    return (
        <div className="card">
            <div className="card-header">
                <h2>Live Quotes (Best bidders first)</h2>
                <p className="sub">
                    Highest bid = who pays most if you sell right now.
                </p>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Market</th>
                            <th>Exchange</th>
                            <th>Bid (they pay you)</th>
                            <th>Ask (you pay)</th>
                            <th>Last Update</th>
                        </tr>
                    </thead>
                    <tbody>
                        {finalRows.map((r, idx) => (
                            <tr key={idx}>
                                <td>{r.symbol}</td>
                                <td>{r.marketType}</td>
                                <td>{r.exchange}</td>
                                <td>{Number(r.bid).toFixed(4)}</td>
                                <td>{Number(r.ask).toFixed(4)}</td>
                                <td>{new Date(r.ts).toLocaleTimeString()}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
