import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { CheckoutIntent, CheckoutRecord } from '../types'
import { activeRecordFor, classifyCheckoutError, reconcilePlan, shouldReuseKey, summarizeCheckout } from './checkout'

const intent = (groupType = 'lab_test', paymentMethod: CheckoutIntent['paymentMethod'] = 'card'): CheckoutIntent => ({
  attemptId: `a-${groupType}`,
  groupType,
  groupLabel: groupType,
  items: [{ lineId: 'l1', quantity: 1 }],
  paymentMethod,
  idempotencyKey: `k-${groupType}`,
  totals: [],
  createdAt: 0,
})

describe('classifyCheckoutError', () => {
  it('gives distinct outcomes for 402, 409, 500 and network failures', () => {
    expect(classifyCheckoutError(new ApiError('declined', 'http', 402))).toMatchObject({ status: 'failed', kind: 'declined', retryable: true })
    expect(classifyCheckoutError(new ApiError('conflict', 'http', 409))).toMatchObject({ status: 'failed', kind: 'conflict', retryable: true })
    expect(classifyCheckoutError(new ApiError('boom', 'http', 500))).toMatchObject({ status: 'failed', kind: 'server', retryable: true })
    expect(classifyCheckoutError(new ApiError('blocked', 'http', 422))).toMatchObject({ status: 'failed', kind: 'blocked', retryable: false })
    expect(classifyCheckoutError(new ApiError('offline', 'network'))).toMatchObject({ status: 'unknown' })
    // A proxy/gateway that lost the upstream reply: outcome unknown, not "failed".
    expect(classifyCheckoutError(new ApiError('', 'http', 502))).toMatchObject({ status: 'unknown' })
    expect(classifyCheckoutError(new ApiError('', 'http', 504))).toMatchObject({ status: 'unknown' })
    expect(classifyCheckoutError(new TypeError('Failed to fetch'))).toMatchObject({ status: 'unknown' })
  })

  it('uses customer wording, not technical codes', () => {
    const messages = [402, 409, 500].map((s) => classifyCheckoutError(new ApiError('x', 'http', s)))
    expect(new Set(messages.map((m) => m.message)).size).toBe(3)
    for (const m of messages) expect(m.message).not.toMatch(/\b(402|409|500)\b/)
  })
})

describe('idempotency key reuse', () => {
  it('reuses the key when the outcome is unknown or the server failed', () => {
    expect(shouldReuseKey({ status: 'unknown', intent: intent(), message: '' })).toBe(true)
    expect(shouldReuseKey({ status: 'failed', intent: intent(), kind: 'server', message: '', retryable: true })).toBe(true)
  })

  it('uses a fresh key when no order can exist (declined, conflict, blocked)', () => {
    for (const kind of ['declined', 'conflict', 'blocked'] as const) {
      expect(shouldReuseKey({ status: 'failed', intent: intent(), kind, message: '', retryable: true })).toBe(false)
    }
    expect(shouldReuseKey(undefined)).toBe(false)
  })
})

describe('reconcilePlan after reload', () => {
  it('replays interrupted attempts and polls unsettled card orders', () => {
    const records: CheckoutRecord[] = [
      { status: 'submitting', intent: intent('lab_test') },
      { status: 'unknown', intent: intent('wellness'), message: '' },
      { status: 'placed', intent: intent('package'), orderId: 'o1', orderStatus: 'pending' },
      { status: 'placed', intent: intent('service', 'pay_at_clinic'), orderId: 'o2', orderStatus: 'pending' },
      { status: 'placed', intent: intent('insurance'), orderId: 'o3', orderStatus: 'paid' },
      { status: 'failed', intent: intent('x'), kind: 'declined', message: '', retryable: true },
    ]
    const plan = reconcilePlan(records)
    expect(plan.replay.map((r) => r.intent.groupType)).toEqual(['lab_test', 'wellness'])
    expect(plan.poll.map((r) => r.intent.groupType)).toEqual(['package'])
  })

  it('finds the record that drives a group, ignoring placed orders', () => {
    const records: CheckoutRecord[] = [
      { status: 'placed', intent: intent('lab_test'), orderId: 'o1', orderStatus: 'paid' },
      { status: 'failed', intent: intent('lab_test'), kind: 'server', message: '', retryable: true },
    ]
    expect(activeRecordFor(records, 'lab_test')?.status).toBe('failed')
    expect(activeRecordFor(records.slice(0, 1), 'lab_test')).toBeUndefined()
  })
})

describe('summarizeCheckout', () => {
  const placed = (g: string): CheckoutRecord => ({ status: 'placed', intent: intent(g), orderId: `o-${g}`, orderStatus: 'paid' })
  const failed = (g: string): CheckoutRecord => ({ status: 'failed', intent: intent(g), kind: 'server', message: '', retryable: true })

  it('is silent when every order is placed', () => {
    expect(summarizeCheckout([placed('Lab tests'), placed('Packages')])).toBeNull()
    expect(summarizeCheckout([])).toBeNull()
  })

  it('says what succeeded, what did not, and that only the failed one needs retrying', () => {
    expect(summarizeCheckout([placed('Lab tests'), failed('Wellness'), placed('Packages')])).toBe(
      '2 of 3 orders placed. Wellness was not ordered. Your other orders are not affected. You can try it again below.',
    )
  })

  it('reports in-flight and unknown orders without claiming a result', () => {
    expect(
      summarizeCheckout([
        placed('Lab tests'),
        { status: 'unknown', intent: intent('Packages'), message: '' },
        { status: 'submitting', intent: intent('Wellness') },
      ]),
    ).toBe("1 of 3 orders placed. Placing Wellness… We're still checking whether Packages went through — you won't be charged twice.")
  })
})
