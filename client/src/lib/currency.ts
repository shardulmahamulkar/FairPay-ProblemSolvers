/** Currency code → symbol mapping */
export const currencySymbols: Record<string, string> = {
    INR: "₹",
    USD: "$",
    EUR: "€",
    GBP: "£",
};

/** Get the currency symbol for a given code, defaulting to ₹ */
export function getCurrencySymbol(currency?: string): string {
    return currencySymbols[currency || "INR"] || "₹";
}
