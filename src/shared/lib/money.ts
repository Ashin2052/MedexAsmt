// Money always carries its currency. MedEx has no exchange rates, so amounts
// in different currencies are never added, compared or converted.

export const CURRENCIES = ['THB', 'NPR', 'INR'] as const
export type Currency = (typeof CURRENCIES)[number]

export type Money = { amount: number; currency: Currency }

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value)
}

const formatters = new Map<Currency, Intl.NumberFormat>()

/**
 * Display-only rounding to 2 decimal places. The ISO code is printed instead
 * of a symbol because THB, NPR and INR can appear side by side.
 */
export function formatMoney({ amount, currency }: Money): string {
  let formatter = formatters.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    formatters.set(currency, formatter)
  }
  return `${currency} ${formatter.format(amount)}`
}

export const CURRENCY_NAMES: Record<Currency, string> = {
  THB: 'Thai baht',
  NPR: 'Nepalese rupee',
  INR: 'Indian rupee',
}
