// Checkout rules: one order per group, explicit states, safe retries.
//
//                 ┌──────────── 402 / 409 / 422 ───────────► failed (new key on retry)
//  ready ─submit─► submitting ─ 500 / 503 ───────────────► failed (same key on retry)
//                 │            └ network / 502 / 504 ─────► unknown ─reconcile (same key)─┐
//                 └── 201 ─► placed ─poll─► paid | pending (pay at clinic) | failed       │
//                                ▲───────────────────────────────────────────────────────┘
//
// The intent (items, payment method, idempotency key) is persisted BEFORE the
// request is sent. Replaying the same key with the same payload returns the
// original order, so a refresh or a lost response can never create a second
// order. A new key is used only when we know no order was created.
import { ApiError, isOutcomeUnknown } from '@/shared/api/client'
import type { CheckoutFailureKind, CheckoutIntent, CheckoutRecord, PaymentMethod } from '../types'

type CheckoutOutcome =
  | { status: 'unknown'; message: string }
  | { status: 'failed'; kind: CheckoutFailureKind; message: string; retryable: boolean }

/** Map a failed checkout request to a customer-facing outcome. */
export function classifyCheckoutError(error: unknown): CheckoutOutcome {
  if (!(error instanceof ApiError) || isOutcomeUnknown(error)) {
    return {
      status: 'unknown',
      message:
        "We lost the connection before we heard back, so we don't know yet whether this order went through. We'll check before trying again — you won't be charged twice.",
    }
  }
  switch (error.status) {
    case 402:
      return {
        status: 'failed',
        kind: 'declined',
        retryable: true,
        message: 'Your payment was declined. Nothing was charged for this group. Try again or choose “Pay at clinic”.',
      }
    case 409:
      return {
        status: 'failed',
        kind: 'conflict',
        retryable: true,
        message: 'Your cart changed while you were checking out. We refreshed it — please review this group and try again.',
      }
    case 400:
    case 422:
      return { status: 'failed', kind: 'blocked', retryable: false, message: error.message }
    default:
      if (error.status !== null && error.status >= 500) {
        return {
          status: 'failed',
          kind: 'server',
          retryable: true,
          message: "Our server had a problem placing this order. It's safe to try again — you won't be charged twice.",
        }
      }
      return { status: 'failed', kind: 'invalid', retryable: false, message: error.message }
  }
}

/**
 * Whether a new attempt may reuse the previous idempotency key.
 * - unknown: must reuse (the first request may have created the order);
 * - server error (5xx): reuse — safe whether or not the server committed;
 * - declined / conflict / blocked: no order exists, and replaying the key
 *   could replay the failure, so a fresh key is used.
 */
export function shouldReuseKey(previous: CheckoutRecord | undefined): boolean {
  if (!previous) return false
  if (previous.status === 'unknown' || previous.status === 'submitting') return true
  return previous.status === 'failed' && previous.kind === 'server'
}

export function samePayload(intent: CheckoutIntent, items: CheckoutIntent['items'], paymentMethod: PaymentMethod) {
  return intent.paymentMethod === paymentMethod && JSON.stringify(intent.items) === JSON.stringify(items)
}

/** The record that currently drives a group's checkout status (not yet placed). */
export function activeRecordFor(records: CheckoutRecord[], groupType: string): CheckoutRecord | undefined {
  return [...records].reverse().find((r) => r.intent.groupType === groupType && r.status !== 'placed')
}

/** What to do with persisted records after a reload. */
export function reconcilePlan(records: CheckoutRecord[]): { replay: CheckoutRecord[]; poll: CheckoutRecord[] } {
  return {
    // Interrupted mid-request or unknown: replay with the SAME key and payload.
    replay: records.filter((r) => r.status === 'submitting' || r.status === 'unknown'),
    // Placed orders whose card payment had not settled: ask the server.
    poll: records.filter(
      (r) => r.status === 'placed' && r.orderStatus === 'pending' && r.intent.paymentMethod === 'card',
    ),
  }
}

export function describeOrder(record: Extract<CheckoutRecord, { status: 'placed' }>): string {
  if (record.orderStatus === 'paid') return 'Paid'
  if (record.orderStatus === 'failed') return 'Payment failed'
  return record.intent.paymentMethod === 'pay_at_clinic' ? 'Booked — pay at the clinic' : 'Payment processing'
}

function joinLabels(records: CheckoutRecord[]): string {
  const labels = records.map((r) => r.intent.groupLabel)
  return labels.length > 1 ? `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}` : (labels[0] ?? '')
}

/**
 * One plain-language sentence about all of the customer's orders, so several
 * separate orders read as one story: what is done, and what still needs them.
 * Null when there is nothing to report.
 */
export function summarizeCheckout(records: CheckoutRecord[]): string | null {
  const by = (status: CheckoutRecord['status']) => records.filter((r) => r.status === status)
  const placed = by('placed')
  const failed = by('failed')
  const unknown = by('unknown')
  const submitting = by('submitting')
  if (!failed.length && !unknown.length && !submitting.length) return null

  const parts: string[] = []
  if (records.length > 1) parts.push(`${placed.length} of ${records.length} orders placed.`)
  if (submitting.length) parts.push(`Placing ${joinLabels(submitting)}…`)
  if (unknown.length) parts.push(`We're still checking whether ${joinLabels(unknown)} went through — you won't be charged twice.`)
  if (failed.length) {
    parts.push(
      `${joinLabels(failed)} ${failed.length === 1 ? 'was' : 'were'} not ordered. ${placed.length ? 'Your other orders are not affected. ' : ''}You can try ${failed.length === 1 ? 'it' : 'them'} again below.`,
    )
  }
  return parts.join(' ')
}
