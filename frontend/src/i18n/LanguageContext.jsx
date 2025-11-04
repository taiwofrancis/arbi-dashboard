// src/i18n/LanguageContext.jsx
import { createContext, useContext, useState, useMemo } from "react";
import { translations } from "./translations.js";

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
    // default language
    const [lang, setLang] = useState("en");

    const value = useMemo(() => {
        function t(key) {
            const dict = translations[lang] || translations.en;
            return dict[key] ?? key;
        }

        return {
            lang,
            setLang,
            t,
        };
    }, [lang]);

    return (
        <LanguageContext.Provider value={value}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    // safety fallback so we don't crash if provider isn't mounted
    if (!ctx) {
        return {
            lang: "en",
            setLang: () => { },
            t: (k) => (translations.en[k] ?? k),
        };
    }
    return ctx;
}
