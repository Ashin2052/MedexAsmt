// Final price rules from the brief. Amounts arrive as decimal strings and are
// parsed to numbers; nothing is rounded here (rounding is display-only).
import type { Currency } from '../../../shared/lib/money'
import type { PriceInfo, WellnessOptionPrice } from '../types'

type PriceTerms = {
  price: unknown
  discount: unknown
  discountType: unknown
  serviceCharge: unknown
  serviceChargeType: unknown
}

type Adjustment = 'percent' | 'amount'

/** Parse a decimal string ("6200.00") or number. Rejects empty, non-numeric and negative values. */
export function parseDecimal(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : null
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null
  return Number(trimmed)
}

function parseAdjustment(value: unknown): Adjustment | null {
  return value === 'percent' || value === 'amount' ? value : null
}

type FinalPriceResult =
  | { ok: true; list: number; discountAmount: number; final: number }
  | { ok: false; reason: 'unparseable' | 'negative-final' }

/**
 * discountAmount = discountType === 'percent' ? price × discount / 100 : discount
 * afterDiscount  = price − discountAmount
 * chargeAmount   = serviceChargeType === 'percent' ? afterDiscount × serviceCharge / 100 : serviceCharge
 * finalPrice     = afterDiscount + chargeAmount
 */
export function computeFinalPrice(terms: PriceTerms): FinalPriceResult {
  const price = parseDecimal(terms.price)
  const discount = parseDecimal(terms.discount)
  const serviceCharge = parseDecimal(terms.serviceCharge)
  const discountType = parseAdjustment(terms.discountType)
  const serviceChargeType = parseAdjustment(terms.serviceChargeType)
  if (price === null || discount === null || serviceCharge === null || !discountType || !serviceChargeType) {
    return { ok: false, reason: 'unparseable' }
  }

  const discountAmount = discountType === 'percent' ? (price * discount) / 100 : discount
  const afterDiscount = price - discountAmount
  const chargeAmount = serviceChargeType === 'percent' ? (afterDiscount * serviceCharge) / 100 : serviceCharge
  const final = afterDiscount + chargeAmount

  if (final < 0) return { ok: false, reason: 'negative-final' }
  return { ok: true, list: price, discountAmount, final }
}

type ServicePriceInput = PriceTerms & {
  type: string
  wellnessPricing: (PriceTerms & { durationInMinutes: unknown })[]
}

/** Build the customer-facing price for a service, in its provider's currency. */
export function buildPriceInfo(service: ServicePriceInput, currency: Currency): PriceInfo {
  if (service.type === 'wellness') {
    const options: WellnessOptionPrice[] = []
    for (const option of service.wellnessPricing) {
      const result = computeFinalPrice(option)
      const duration = typeof option.durationInMinutes === 'number' ? option.durationInMinutes : null
      if (result.ok && duration !== null) {
        options.push({ durationInMinutes: duration, final: { amount: result.final, currency } })
      }
    }
    if (options.length === 0) return { kind: 'invalid', currency, reason: 'no-valid-options' }
    options.sort((a, b) => a.final.amount - b.final.amount || a.durationInMinutes - b.durationInMinutes)
    return { kind: 'from', lowest: options[0], options }
  }

  const result = computeFinalPrice(service)
  if (!result.ok) return { kind: 'invalid', currency, reason: result.reason }
  if (result.final === 0) return { kind: 'free', currency }
  return {
    kind: 'fixed',
    final: { amount: result.final, currency },
    original: result.discountAmount > 0 ? { amount: result.list, currency } : null,
  }
}

/** Amounts the price-range filter compares against (empty when the price is unknown). */
export function priceCandidates(price: PriceInfo): number[] {
  switch (price.kind) {
    case 'fixed':
      return [price.final.amount]
    case 'free':
      return [0]
    case 'from':
      return price.options.map((option) => option.final.amount)
    case 'invalid':
      return []
  }
}
