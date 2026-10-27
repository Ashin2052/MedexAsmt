import { describe, expect, it } from 'vitest'
import { fixtureCart as servedFixtureCart } from '@/test/mockServer'
import { rawCartSchema } from '../api/schemas'
import { buildCartView, isCheckoutReady, sumByCurrency } from './cart'

const FACIAL_90 = 'a1b2c3d4-0000-4000-8000-000000000090'

function fixtureCart() {
  return rawCartSchema.parse(servedFixtureCart())
}

describe('buildCartView on the fixture cart', () => {
  const view = buildCartView(fixtureCart())
  const group = (type: string) => view.groups.find((g) => g.type === type)!

  it('groups by service type with one subtotal per currency', () => {
    expect(view.groups.map((g) => g.type)).toEqual(['lab_test', 'wellness', 'package', 'unknown'])
    expect(group('lab_test').subtotals).toEqual([
      { currency: 'THB', amount: 1677 },
      { currency: 'NPR', amount: 12520 },
    ])
    expect(group('package').subtotals).toEqual([
      { currency: 'THB', amount: 15230 },
      { currency: 'INR', amount: 23009.5 },
    ])
  })

  it('never adds different currencies together, even in the overall summary', () => {
    expect(view.totalsByCurrency).toEqual([
      { currency: 'THB', amount: 1677 + 15230 },
      { currency: 'NPR', amount: 12520 },
      { currency: 'INR', amount: 23009.5 },
    ])
  })

  it('uses product.price as the final unit price (no formula re-applied)', () => {
    const liver = group('lab_test').lines.find((l) => l.kind === 'priced' && l.title === 'Liver Function Profile')
    expect(liver).toMatchObject({ unitPrice: { amount: 4760, currency: 'NPR' }, lineTotal: { amount: 9520 } })
  })

  it('treats a wellness line without a duration as unpriced, never zero, and blocks its group', () => {
    const wellness = group('wellness')
    expect(wellness.lines[0].kind).toBe('needs-duration')
    expect(wellness.subtotals).toEqual([])
    expect(wellness.unpricedCount).toBe(1)
    expect(isCheckoutReady(wellness)).toBe(false)
    expect(wellness.blockers).toEqual(['Choose a duration for Signature Facial.'])
    expect(view.totalsByCurrency.find((m) => m.currency === 'THB')?.amount).toBe(16907) // facial not counted
  })

  it('prices the wellness line once a duration is chosen', () => {
    const raw = fixtureCart()
    const facial = raw.groups.find((g) => g.type === 'wellness')!.items[0]
    facial.wellnessPricingId = FACIAL_90
    const wellness = buildCartView(raw).groups.find((g) => g.type === 'wellness')!
    expect(wellness.subtotals).toEqual([{ currency: 'THB', amount: 2040 }])
    expect(isCheckoutReady(wellness)).toBe(true)
  })

  it('marks an empty product as unavailable: excluded from totals and checkout', () => {
    const unknown = group('unknown')
    expect(unknown.lines[0].kind).toBe('unavailable')
    expect(unknown.subtotals).toEqual([])
    expect(isCheckoutReady(unknown)).toBe(false)
    expect(view.unavailableCount).toBe(1)
  })

  it('shows optimistic quantities but sends server-confirmed ones to checkout', () => {
    const raw = fixtureCart()
    const cbc = raw.groups[0].items[0]
    const lab = buildCartView(raw, new Map([[cbc.id, 4]])).groups[0]
    expect(lab.lines[0].quantity).toBe(4)
    expect(lab.subtotals[0]).toEqual({ currency: 'THB', amount: 1677 * 4 })
    expect(lab.checkoutItems[0]).toEqual({ lineId: cbc.id, quantity: 1 })
  })
})

describe('sumByCurrency', () => {
  it('sums within each currency only', () => {
    expect(
      sumByCurrency([
        { currency: 'INR', amount: 1 },
        { currency: 'THB', amount: 2 },
        { currency: 'INR', amount: 3 },
      ]),
    ).toEqual([
      { currency: 'THB', amount: 2 },
      { currency: 'INR', amount: 4 },
    ])
  })
})
