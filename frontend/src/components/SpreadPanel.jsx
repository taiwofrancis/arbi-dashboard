// src/components/SpreadPanel.jsx
export default function SpreadsPanel({ spreads }) {
    // spreads is usually an array of { type, symbol, buyExchange, buyPx, sellExchange, sellPx, diffUsd }
    // We'll just show top 5 safely.

    const top = Array.isArray(spreads) ? spreads.slice(0, 5) : [];

    return (
        <div className="card">
            <div className="card-header">
                <h2 className="pair-title">Top Spreads / Premiums</h2>
                <p className="sub">
                    Cross-exchange spot edges & futures basis opportunities.
                </p>
            </div>

            <div className="table-wrapper">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Symbol</th>
                            <th>Buy @</th>
                            <th>Sell @</th>
                            <th>Diff (USD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {top.length === 0 ? (
                            <tr>
                                <td colSpan="5" style={{ color: "var(--text-dim)", fontSize: ".75rem", padding: "1rem" }}>
                                    No spread data yet.
                                </td>
                            </tr>
                        ) : (
                            top.map((row, i) => (
                                <tr key={i}>
                                    <td>{row.type || "-"}</td>
                                    <td>{row.symbol || "-"}</td>
                                    <td>
                                        {row.buyExchange
                                            ? `${row.buyExchange} @ ${Number(row.buyPx).toFixed(4)}`
                                            : "-"}
                                    </td>
                                    <td>
                                        {row.sellExchange
                                            ? `${row.sellExchange} @ ${Number(row.sellPx).toFixed(4)}`
                                            : "-"}
                                    </td>
                                    <td>
                                        {row.diffUsd !== undefined
                                            ? Number(row.diffUsd).toFixed(6)
                                            : "-"}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
