import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

import { LanguageProvider } from "./i18n/LanguageContext.jsx";
import { CurrencyProvider } from "./i18n/CurrencyContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <LanguageProvider>
            <CurrencyProvider>
                <App />
            </CurrencyProvider>
        </LanguageProvider>
    </React.StrictMode>
);
