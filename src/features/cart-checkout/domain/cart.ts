// Cart view model. `product.price` is already the final per-unit price (brief),
// so nothing is recalculated here: line total = unit price × quantity.
// Amounts are only ever added within one currency.
import { CURRENCIES, isCurrency, type Currency, type Money } from '@/shared/lib/money'
import { rawProductSchema, type RawCart, type RawLine } from '../api/schemas'
import type { CartGroupView, CartLineView, CartView, WellnessOption } from '../types'

const GROUP_LABELS: Record<string, string> = {
  package: 'Health packages',
  lab_test: 'Lab tests',
  wellness: 'Wellness',
  service: 'Services',
  insurance: 'Insurance',
  unknown: 'Unavailable items',
}

export function groupLabel(type: string): string {
  return GROUP_LABELS[type] ?? 'Other items'
}

/** Add amounts per currency; the result is ordered THB, NPR, INR. */
export function sumByCurrency(amounts: Money[]): Money[] {
  const totals = new Map<Currency, number>()
  for (const { amount, currency } of amounts) totals.set(currency, (totals.get(currency) ?? 0) + amount)
  return CURRENCIES.filter((c) => totals.has(c)).map((currency) => ({ currency, amount: totals.get(currency) ?? 0 }))
}

/**
 * Build one line. `quantityOverride` is the optimistic quantity the customer
 * just chose (see quantityQueue); totals follow what they see.
 */
function buildLine(raw: RawLine, quantityOverride?: number): CartLineView {
  const quantity = quantityOverride ?? raw.quantity
  const base = { id: raw.id, productId: raw.productId, quantity }
  const parsed = rawProductSchema.safeParse(raw.product)
  if (!parsed.success || !isCurrency(parsed.data.currency)) {
    const title =
      raw.product && typeof raw.product === 'object' && 'title' in raw.product && typeof raw.product.title === 'string'
        ? raw.product.title
        : null
    return { ...base, kind: 'unavailable', title }
  }

  const product = parsed.data
  const currency: Currency = product.currency as Currency
  const common = { title: product.title, type: product.type, providerName: product.providerName ?? null }

  if (product.type === 'wellness') {
    const options: WellnessOption[] = (product.wellnessPricing ?? [])
      .map((o) => ({ id: o.id, durationInMinutes: o.durationInMinutes, price: { amount: o.amount_after_service_charge, currency } }))
      .sort((a, b) => a.durationInMinutes - b.durationInMinutes)
    const selected = options.find((o) => o.id === raw.wellnessPricingId)
    if (!selected) return { ...base, ...common, kind: 'needs-duration', options }
    return {
      ...base,
      ...common,
      kind: 'priced',
      unitPrice: selected.price,
      lineTotal: { amount: selected.price.amount * quantity, currency },
      wellness: { options, selectedId: selected.id },
    }
  }

  if (product.price === null) return { ...base, kind: 'unavailable', title: product.title }
  return {
    ...base,
    ...common,
    kind: 'priced',
    unitPrice: { amount: product.price, currency },
    lineTotal: { amount: product.price * quantity, currency },
    wellness: null,
  }
}

function blockersFor(lines: CartLineView[]): string[] {
  const blockers: string[] = []
  for (const line of lines) {
    if (line.kind === 'needs-duration') blockers.push(`Choose a duration for ${line.title}.`)
  }
  const unavailable = lines.filter((l) => l.kind === 'unavailable').length
  if (unavailable) {
    blockers.push(
      unavailable === 1 ? 'Remove the unavailable service.' : `Remove the ${unavailable} unavailable services.`,
    )
  }
  return blockers
}

export function buildCartView(raw: RawCart, quantityOverrides: ReadonlyMap<string, number> = new Map()): CartView {
  const groups: CartGroupView[] = raw.groups
    .filter((group) => group.items.length > 0)
    .map((group) => {
      const lines = group.items.map((item) => buildLine(item, quantityOverrides.get(item.id)))
      const priced = lines.flatMap((l) => (l.kind === 'priced' ? [l.lineTotal] : []))
      return {
        type: group.type,
        label: groupLabel(group.type),
        lines,
        itemCount: lines.reduce((n, l) => n + l.quantity, 0),
        subtotals: sumByCurrency(priced),
        unpricedCount: lines.filter((l) => l.kind === 'needs-duration').reduce((n, l) => n + l.quantity, 0),
        unavailableCount: lines.filter((l) => l.kind === 'unavailable').length,
        blockers: blockersFor(lines),
        // Server-confirmed quantities: checkout never sends an unsaved optimistic value.
        checkoutItems: group.items.map((item) => ({ lineId: item.id, quantity: item.quantity })),
      }
    })

  const allLines = groups.flatMap((g) => g.lines)
  return {
    groups,
    totalItems: groups.reduce((n, g) => n + g.itemCount, 0),
    totalsByCurrency: sumByCurrency(allLines.flatMap((l) => (l.kind === 'priced' ? [l.lineTotal] : []))),
    unpricedCount: groups.reduce((n, g) => n + g.unpricedCount, 0),
    unavailableCount: groups.reduce((n, g) => n + g.unavailableCount, 0),
  }
}

export function isCheckoutReady(group: CartGroupView): boolean {
  return group.blockers.length === 0 && group.lines.length > 0
}
