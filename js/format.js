export const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD"];

const CURRENCY_SYMBOLS = { USD: "$", CAD: "$", GBP: "£", EUR: "€", AUD: "$" };

export function formatPrice(price, currency) {
  if (price == null) return null;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const amount = Number(price).toFixed(2);
  return currency === "USD" ? `${symbol}${amount}` : `${symbol}${amount} ${currency}`;
}
