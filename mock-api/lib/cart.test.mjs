// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const lib = require('./cart.cjs')
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'data/task2-cart.json'), 'utf8'))

const LIVER = '7bcdaf5b-7874-4061-83ee-ef9c954ffcaf'
const LIPID = '6a92d368-a25a-4e00-89ce-77d69da06b45'
const FACIAL = '5f0c1a52-6b1e-4c1f-9a51-000000000003'
const FACIAL_60 = 'a1b2c3d4-0000-4000-8000-000000000060'
const FACIAL_90 = 'a1b2c3d4-0000-4000-8000-000000000090'
const MISSING = '6b572fa4-4559-4dfd-a276-9c1400ce208e'

let state
beforeEach(() => {
  state = lib.createCartState(fixture)
})

const lines = () => state.cart.groups.flatMap((g) => g.items)
const lineFor = (productId) => lines().find((l) => l.productId === productId)
const group = (type) => state.cart.groups.find((g) => g.type === type)

describe('cart totals', () => {
  it('keeps one subtotal per currency and counts unknown prices as unpriced, not zero', () => {
    expect(group('lab_test').subtotals).toEqual({ THB: 1677, NPR: 12520 })
    expect(group('package').subtotals).toEqual({ THB: 15230, INR: 23009.5 })
    expect(group('wellness')).toMatchObject({ subtotals: {}, unpricedItems: 1 })
    expect(group('unknown')).toMatchObject({ subtotals: {}, unpricedItems: 1 })
    expect(state.cart.totalItems).toBe(8)
  })

  it('prices a wellness line once a duration is chosen', () => {
    const facial = lineFor(FACIAL)
    expect(lib.updateLine(state, facial.id, { wellnessPricingId: FACIAL_90 }).status).toBe(200)
    expect(group('wellness')).toMatchObject({ subtotals: { THB: 2040 }, unpricedItems: 0 })
    expect(lib.updateLine(state, facial.id, { wellnessPricingId: 'nope' }).status).toBe(422)
  })
})

describe('mergeGuestCart', () => {
  it('handles every overlap in the fixture and reports each one', () => {
    const { changes } = lib.mergeGuestCart(state, fixture.guestCart, 'merge-1')
    const byProduct = Object.fromEntries(changes.map((c) => [c.productId, c]))

    // Same product: quantities combine (2 + 3).
    expect(byProduct[LIVER]).toMatchObject({ outcome: 'quantity-combined', from: 2, added: 3, to: 5, capped: false })
    expect(lineFor(LIVER).quantity).toBe(5)
    // New catalog product: added to its type group.
    expect(byProduct[LIPID]).toMatchObject({ outcome: 'added', to: 1, title: 'Lipid Profile' })
    expect(group('lab_test').items.some((l) => l.productId === LIPID)).toBe(true)
    // Wellness: the account line had no duration, so the guest's 90-minute choice is applied.
    expect(byProduct[FACIAL]).toMatchObject({ outcome: 'quantity-combined', wellness: { status: 'applied', durationInMinutes: 90 } })
    expect(lineFor(FACIAL).wellnessPricingId).toBe(FACIAL_90)
    // Unknown product: skipped and reported, not silently dropped.
    expect(byProduct[MISSING]).toMatchObject({ outcome: 'skipped', reason: 'not-available' })
    expect(lineFor(MISSING)).toBeUndefined()
  })

  it('keeps an existing account duration and says so', () => {
    lib.updateLine(state, lineFor(FACIAL).id, { wellnessPricingId: FACIAL_60 })
    const { changes } = lib.mergeGuestCart(state, [{ productId: FACIAL, quantity: 1, wellnessPricingId: FACIAL_90 }])
    expect(changes[0].wellness).toEqual({ status: 'kept-account-choice', durationInMinutes: 60 })
    expect(lineFor(FACIAL).wellnessPricingId).toBe(FACIAL_60)
  })

  it('flags a wellness item that still needs a duration', () => {
    const { changes } = lib.mergeGuestCart(state, [{ productId: FACIAL, quantity: 1 }])
    expect(changes[0].wellness).toEqual({ status: 'needs-choice' })
  })

  it('caps combined quantities at 20 and reports it', () => {
    const { changes } = lib.mergeGuestCart(state, [{ productId: LIVER, quantity: 25 }])
    expect(changes[0]).toMatchObject({ to: 20, capped: true })
  })

  it('is idempotent per mergeId', () => {
    const first = lib.mergeGuestCart(state, fixture.guestCart, 'merge-once')
    const second = lib.mergeGuestCart(state, fixture.guestCart, 'merge-once')
    expect(second.changes).toEqual(first.changes)
    expect(lineFor(LIVER).quantity).toBe(5)
  })
})

describe('checkout', () => {
  const labItems = () => group('lab_test').items.map((l) => ({ lineId: l.id, quantity: l.quantity }))

  it('returns the same order for the same idempotency key and payload', () => {
    const body = { groupType: 'lab_test', items: labItems(), paymentMethod: 'card', idempotencyKey: 'k-1' }
    const first = lib.checkout(state, body)
    const replay = lib.checkout(state, body)
    expect(first.status).toBe(201)
    expect(replay).toEqual(first)
    expect(state.orders.size).toBe(1)
    expect(group('lab_test')).toBeUndefined() // ordered lines leave the cart
  })

  it('rejects the same key with a different payload', () => {
    const body = { groupType: 'lab_test', items: labItems(), paymentMethod: 'card', idempotencyKey: 'k-2' }
    lib.checkout(state, body)
    expect(lib.checkout(state, { ...body, paymentMethod: 'pay_at_clinic' })).toMatchObject({ status: 409 })
  })

  it('blocks a wellness group without a duration and an unavailable group', () => {
    const wellness = { groupType: 'wellness', paymentMethod: 'card', idempotencyKey: 'k-3' }
    expect(lib.checkout(state, wellness)).toMatchObject({ status: 422 })
    const unknown = { groupType: 'unknown', paymentMethod: 'card', idempotencyKey: 'k-4' }
    expect(lib.checkout(state, unknown)).toMatchObject({ status: 422 })
    expect(state.orders.size).toBe(0)
  })

  it('lets one group succeed while another fails, without affecting the first', () => {
    const ok = lib.checkout(state, { groupType: 'package', paymentMethod: 'card', idempotencyKey: 'k-5' })
    const failed = lib.checkout(state, { groupType: 'wellness', paymentMethod: 'card', idempotencyKey: 'k-6' })
    expect(ok.status).toBe(201)
    expect(failed.status).toBe(422)
    expect(state.orders.has(ok.body.orderId)).toBe(true)
  })

  it('settles card orders after a delay and keeps pay-at-clinic pending', () => {
    const card = lib.checkout(state, { groupType: 'package', paymentMethod: 'card', idempotencyKey: 'k-7' }, { now: 1000 })
    const order = state.orders.get(card.body.orderId)
    expect(lib.orderStatus(order, 1000)).toBe('pending')
    expect(lib.orderStatus(order, 1000 + lib.CARD_SETTLE_MS)).toBe('paid')

    const clinic = lib.checkout(state, { groupType: 'lab_test', paymentMethod: 'pay_at_clinic', idempotencyKey: 'k-8' }, { now: 1000 })
    expect(lib.orderStatus(state.orders.get(clinic.body.orderId), 99999)).toBe('pending')
  })
})

describe('line updates', () => {
  it('cannot change or check out an unavailable line, but can remove it', () => {
    const empty = group('unknown').items[0]
    expect(lib.updateLine(state, empty.id, { quantity: 2 }).status).toBe(409)
    expect(lib.removeLine(state, empty.id).status).toBe(204)
    expect(group('unknown')).toBeUndefined()
  })

  it('validates quantities', () => {
    const cbc = group('lab_test').items[0]
    expect(lib.updateLine(state, cbc.id, { quantity: 0 }).status).toBe(422)
    expect(lib.updateLine(state, cbc.id, { quantity: 21 }).status).toBe(422)
    expect(lib.updateLine(state, cbc.id, { quantity: 3 }).status).toBe(200)
  })
})
