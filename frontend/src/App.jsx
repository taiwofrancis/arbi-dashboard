// src/App.jsx
import { useEffect, useState } from "react";
import io from "socket.io-client";

import SpotPerpTables from "./components/SpotPerpTables.jsx"; // <- NEW
import SpreadsPanel from "./components/SpreadPanel.jsx";
import { useLanguage } from "./i18n/LanguageContext.jsx";
import { useCurrency } from "./i18n/CurrencyContext.jsx";

function App() {
    const { t, lang, setLang } = useLanguage();
    const { currency, setCurrency } = useCurrency();

    const [snapshot, setSnapshot] = useState({});
    const [spreads, setSpreads] = useState([]);
    const [lastTs, setLastTs] = useState(null);

    useEffect(() => {
        const backendURL =
            import.meta.env.VITE_BACKEND_URL ||
            window.location.origin.replace(":5173", ":4000");

        const socket = io(backendURL, { transports: ["websocket"] });

        socket.on("market:update", (payload) => {
            if (!payload) return;
            if (payload.snapshot) setSnapshot(payload.snapshot);
            if (payload.spreads) setSpreads(payload.spreads);
            if (payload.ts) setLastTs(payload.ts);
        });

        return () => socket.disconnect();
    }, []);

    return (
        <div className="page">
            <header className="header">
                <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                    <div>
                        <h1>{t("appTitle")}</h1>
                        <p className="muted">Spot vs Perpetual by exchange (real-time)</p>
                        <div className="ts">
                            {t("lastUpdate")}: {lastTs ? new Date(lastTs).toLocaleTimeString() : "—"}
                        </div>
                    </div>

                    <div style={{ display: "flex", gap: "1rem" }}>
                        <div>
                            <label htmlFor="lang" style={{ color: "var(--text-dim)", fontSize: ".7rem", display: "block", marginBottom: ".25rem" }}>
                                {t("langLabel")}
                            </label>
                            <select
                                id="lang"
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", padding: ".4rem .5rem" }}
                            >
                                <option value="en">English</option>
                                <option value="pt">Português</option>
                                <option value="fr">Français</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="ccy" style={{ color: "var(--text-dim)", fontSize: ".7rem", display: "block", marginBottom: ".25rem" }}>
                                Currency
                            </label>
                            <select
                                id="ccy"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                style={{ background: "var(--panel)", color: "var(--text)", border: "1px solid var(--border)", borderRadius: "6px", padding: ".4rem .5rem" }}
                            >
                                <option value="USD">USD $</option>
                                <option value="BRL">BRL R$</option>
                            </select>
                        </div>
                    </div>
                </div>
            </header>

            <main className="grid">
                <section className="col col-wide">
                    <SpotPerpTables snapshot={snapshot} />
                </section>

                {/* <aside className="col">
                    <SpreadsPanel spreads={spreads} />
                </aside> */}
            </main>

            <footer className="footer" style={{ marginTop: "2rem" }}>
                {t("footerNote")}
            </footer>
        </div>
    );
}

export default App;
