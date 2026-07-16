export const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD"];

const CURRENCY_SYMBOLS = { USD: "$", CAD: "$", GBP: "£", EUR: "€", AUD: "$" };

export function formatPrice(price, currency) {
  if (price == null) return null;
  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const num = Number(price);
  // Whole-dollar prices drop the trailing ".00"; anything with real cents keeps them.
  const amount = num % 1 === 0 ? num.toString() : num.toFixed(2);
  return `${symbol}${amount} ${currency}`;
}
