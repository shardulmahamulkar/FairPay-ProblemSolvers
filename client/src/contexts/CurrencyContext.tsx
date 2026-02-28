import React, { createContext, useContext, useState, useEffect } from "react";

export interface CurrencyContextType {
    defaultCurrency: string;
    exchangeRates: Record<string, number>;
    setDefaultCurrency: (curr: string) => void;
    convertAmount: (amount: number, fromCurrency?: string) => number;
    formatAmount: (amount: number, fromCurrency?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | null>(null);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [defaultCurrency, setCurrencyState] = useState(localStorage.getItem("fairpay_currency") || "INR");
    const [exchangeRates, setExchangeRates] = useState<Record<string, number>>({});

    useEffect(() => {
        fetch("https://api.exchangerate-api.com/v4/latest/USD")
            .then(res => res.json())
            .then(data => setExchangeRates(data.rates))
            .catch(err => console.error("Failed to fetch rates", err));
    }, []);

    const setDefaultCurrency = (curr: string) => {
        localStorage.setItem("fairpay_currency", curr);
        setCurrencyState(curr);
    };

    const convertAmount = (amount: number, fromCurrency?: string) => {
        const val = amount || 0;
        const from = fromCurrency || "INR";
        if (from === defaultCurrency) return val;
        // Base is USD
        if (!exchangeRates[from] || !exchangeRates[defaultCurrency]) return val;
        return (val / exchangeRates[from]) * exchangeRates[defaultCurrency];
    };

    const formatAmount = (amount: number, fromCurrency?: string) => {
        const val = amount || 0;
        const converted = convertAmount(val, fromCurrency);
        const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
        const sym = symbols[defaultCurrency] || defaultCurrency + " ";
        return `${sym}${converted.toFixed(2)}`;
    };

    return (
        <CurrencyContext.Provider value={{ defaultCurrency, setDefaultCurrency, exchangeRates, convertAmount, formatAmount }}>
            {children}
        </CurrencyContext.Provider>
    );
};

export const useCurrency = () => {
    const ctx = useContext(CurrencyContext);
    if (!ctx) throw new Error("useCurrency must be used within CurrencyProvider");
    return ctx;
};
