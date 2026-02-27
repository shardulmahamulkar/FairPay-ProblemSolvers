export function formatCurrency(amount: number, currency = "INR"): string {
  const symbols: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };
  return `${symbols[currency] || ""}${Math.abs(amount).toLocaleString()}`;
}

export function formatSignedCurrency(amount: number, currency = "INR"): string {
  const prefix = amount > 0 ? "+" : amount < 0 ? "-" : "";
  return `${prefix}${formatCurrency(Math.abs(amount), currency)}`;
}
