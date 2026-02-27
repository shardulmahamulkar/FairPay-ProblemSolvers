/**
 * Exchange Rate Service — uses the Frankfurter API (free, no key required)
 * Fetches live rates and caches them for 1 hour.
 */

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface RateCache {
    base: string;
    rates: Record<string, number>;
    fetchedAt: number;
}

let cache: RateCache | null = null;

/**
 * Fetch exchange rates with `base` as the base currency.
 * Returns a map like { USD: 0.012, EUR: 0.011, GBP: 0.0094, ... }
 * (i.e. 1 unit of base = X units of target)
 */
async function fetchRates(base: string = "INR"): Promise<Record<string, number>> {
    // Return cached rates if still fresh
    if (cache && cache.base === base && Date.now() - cache.fetchedAt < CACHE_DURATION_MS) {
        return cache.rates;
    }

    try {
        const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${base}`);
        if (!res.ok) throw new Error(`Frankfurter API error: ${res.status}`);
        const data = await res.json();

        // data.rates is e.g. { USD: 0.01187, EUR: 0.01095, GBP: 0.00938, ... }
        const rates: Record<string, number> = { [base]: 1, ...data.rates };
        cache = { base, rates, fetchedAt: Date.now() };
        return rates;
    } catch (err) {
        console.warn("Failed to fetch exchange rates, using fallback:", err);
        // Fallback: return 1:1 so the app doesn't break
        return { INR: 1, USD: 1, EUR: 1, GBP: 1 };
    }
}

/**
 * Convert an amount from one currency to the base currency.
 *
 * Example: convertToBase(20, "USD", "INR")
 *   → fetches rates with base=INR
 *   → rate for USD = 0.01187 (meaning 1 INR = 0.01187 USD)
 *   → so 1 USD = 1 / 0.01187 INR ≈ 84.25 INR
 *   → returns 20 * 84.25 = 1685
 */
export async function convertToBase(
    amount: number,
    fromCurrency: string,
    baseCurrency: string = "INR"
): Promise<number> {
    if (fromCurrency === baseCurrency) return amount;

    const rates = await fetchRates(baseCurrency);
    const rate = rates[fromCurrency];

    if (!rate || rate === 0) {
        console.warn(`No rate found for ${fromCurrency}, returning original amount`);
        return amount;
    }

    // rates[fromCurrency] = how many units of fromCurrency per 1 unit of baseCurrency
    // So 1 unit of fromCurrency = (1 / rate) units of baseCurrency
    return Math.round((amount / rate) * 100) / 100;
}

/**
 * Convert multiple amounts at once (more efficient — single rate fetch).
 * items: array of { amount, currency }
 * Returns the same array with `convertedAmount` added.
 */
export async function convertAllToBase(
    items: { amount: number; currency?: string }[],
    baseCurrency: string = "INR"
): Promise<{ amount: number; currency?: string; convertedAmount: number }[]> {
    const rates = await fetchRates(baseCurrency);

    return items.map((item) => {
        const from = item.currency || "INR";
        if (from === baseCurrency) {
            return { ...item, convertedAmount: item.amount };
        }
        const rate = rates[from];
        if (!rate || rate === 0) {
            return { ...item, convertedAmount: item.amount };
        }
        return {
            ...item,
            convertedAmount: Math.round((item.amount / rate) * 100) / 100,
        };
    });
}

/** Get live exchange rates (useful to display rates in UI) */
export { fetchRates as getExchangeRates };
