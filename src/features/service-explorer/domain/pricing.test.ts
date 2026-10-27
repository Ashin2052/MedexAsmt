import { describe, expect, it } from 'vitest'
import { buildPriceInfo, computeFinalPrice, parseDecimal, priceCandidates } from './pricing'

const terms = (price: unknown, discount: unknown, discountType: unknown, serviceCharge: unknown, serviceChargeType: unknown) => ({
  price,
  discount,
  discountType,
  serviceCharge,
  serviceChargeType,
})

describe('parseDecimal', () => {
  it('parses decimal strings and numbers', () => {
    expect(parseDecimal('6200.00')).toBe(6200)
    expect(parseDecimal(' 15.5 ')).toBe(15.5)
    expect(parseDecimal(0)).toBe(0)
  })

  it('rejects empty, malformed and negative values', () => {
    for (const value of ['', '   ', 'abc', '1,200.00', '-5', null, undefined, Number.NaN, -1, {}]) {
      expect(parseDecimal(value)).toBeNull()
    }
  })
})

describe('computeFinalPrice (brief formula)', () => {
  it('applies a percent discount then a percent service charge (brief example)', () => {
    // 6200 − 10% = 5580; + 7% of 5580 = 390.6 → 5970.6 (matches the Task 2 catalog price)
    const result = computeFinalPrice(terms('6200.00', '10.00', 'percent', '7.00', 'percent'))
    expect(result).toEqual({ ok: true, list: 6200, discountAmount: 620, final: 5970.6 })
  })

  it('applies amount discount and amount charge', () => {
    const result = computeFinalPrice(terms('1000.00', '150.00', 'amount', '25.00', 'amount'))
    expect(result).toMatchObject({ ok: true, final: 875 })
  })

  it('charges percent on the discounted amount, not the list price', () => {
    const result = computeFinalPrice(terms('1000.00', '100.00', 'amount', '10.00', 'percent'))
    expect(result).toMatchObject({ ok: true, final: 990 })
  })

  it('does not round intermediate values', () => {
    // 99.99 − 33.33% = 66.663333; + 7% = 71.32976... (rounded only for display)
    const result = computeFinalPrice(terms('99.99', '33.33', 'percent', '7.00', 'percent'))
    expect(result.ok && result.final).toBeCloseTo(99.99 * (1 - 0.3333) * 1.07, 10)
  })

  it('flags a discount larger than the price instead of showing a negative price', () => {
    // Fixture "Vitamin D Test": price 450, amount discount 600.
    expect(computeFinalPrice(terms('450.00', '600.00', 'amount', '0.00', 'amount'))).toEqual({
      ok: false,
      reason: 'negative-final',
    })
  })

  it('rejects unknown adjustment types and missing amounts', () => {
    expect(computeFinalPrice(terms('100', '0', 'fixed', '0', 'amount'))).toEqual({ ok: false, reason: 'unparseable' })
    expect(computeFinalPrice(terms(null, '0', 'amount', '0', 'amount'))).toEqual({ ok: false, reason: 'unparseable' })
  })
})

describe('buildPriceInfo', () => {
  const base = { type: 'package', wellnessPricing: [] }

  it('shows the original price only when a discount applies', () => {
    const discounted = buildPriceInfo({ ...base, ...terms('6200.00', '10.00', 'percent', '7.00', 'percent') }, 'THB')
    expect(discounted).toEqual({
      kind: 'fixed',
      final: { amount: 5970.6, currency: 'THB' },
      original: { amount: 6200, currency: 'THB' },
    })
    const plain = buildPriceInfo({ ...base, ...terms('500.00', '0.00', 'amount', '5.00', 'percent') }, 'NPR')
    expect(plain).toEqual({ kind: 'fixed', final: { amount: 525, currency: 'NPR' }, original: null })
  })

  it('labels a zero price as free', () => {
    expect(buildPriceInfo({ ...base, ...terms('0.00', '0.00', 'amount', '0.00', 'amount') }, 'THB')).toEqual({
      kind: 'free',
      currency: 'THB',
    })
  })

  it('marks a negative final price as invalid', () => {
    const info = buildPriceInfo({ ...base, ...terms('450.00', '600.00', 'amount', '0.00', 'amount') }, 'THB')
    expect(info).toEqual({ kind: 'invalid', currency: 'THB', reason: 'negative-final' })
    expect(priceCandidates(info)).toEqual([])
  })

  it('prices wellness from its options and never as zero (brief example)', () => {
    const info = buildPriceInfo(
      {
        type: 'wellness',
        ...terms(null, null, null, null, null),
        wellnessPricing: [
          { durationInMinutes: 90, ...terms('2400.00', '15.00', 'percent', '0.00', 'amount') },
          { durationInMinutes: 60, ...terms('1800.00', '0.00', 'amount', '0.00', 'amount') },
        ],
      },
      'THB',
    )
    expect(info.kind).toBe('from')
    if (info.kind !== 'from') return
    expect(info.lowest).toEqual({ durationInMinutes: 60, final: { amount: 1800, currency: 'THB' } })
    expect(info.options.map((o) => o.final.amount)).toEqual([1800, 2040])
    expect(priceCandidates(info)).toEqual([1800, 2040])
  })

  it('skips invalid wellness options and reports when none are valid', () => {
    const info = buildPriceInfo(
      {
        type: 'wellness',
        ...terms(null, null, null, null, null),
        wellnessPricing: [{ durationInMinutes: 60, ...terms('bad', '0', 'amount', '0', 'amount') }],
      },
      'INR',
    )
    expect(info).toEqual({ kind: 'invalid', currency: 'INR', reason: 'no-valid-options' })
  })
})
