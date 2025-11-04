import { createContext, useContext, useState, useMemo } from "react";

// Context to manage selected currency (USD or BRL)
const CurrencyContext = createContext();

export function CurrencyProvider({ children }) {
    const [currency, setCurrency] = useState("USD");

    const formatPrice = (value, { maxFrac = 2 } = {}) => {
        if (value == null || isNaN(value)) return "—";

        let opts = {
            minimumFractionDigits: 0,
            maximumFractionDigits: maxFrac,
        };

        const val =
            currency === "BRL" ? value * 5.7 /* approx rate */ : value;

        return new Intl.NumberFormat("en-US", {
            ...opts,
            style: "currency",
            currency,
        }).format(val);
    };

    const ctx = useMemo(
        () => ({
            currency,
            setCurrency,
            formatPrice,
        }),
        [currency]
    );

    return (
        <CurrencyContext.Provider value={ctx}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    return useContext(CurrencyContext);
}
