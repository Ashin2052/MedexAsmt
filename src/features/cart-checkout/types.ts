import type { Money } from '@/shared/lib/money'

export type PaymentMethod = 'card' | 'pay_at_clinic'

export type WellnessOption = { id: string; durationInMinutes: number; price: Money }

type LineBase = {
  id: string
  productId: string
  quantity: number
}

export type CartLineView =
  /** Ordinary line; `product.price` is already the final per-unit price. */
  | (LineBase & {
      kind: 'priced'
      title: string
      type: string
      providerName: string | null
      unitPrice: Money
      lineTotal: Money
      /** Present for wellness lines with a chosen duration. */
      wellness: { options: WellnessOption[]; selectedId: string } | null
    })
  /** Wellness line without a chosen duration: price unknown, never zero. */
  | (LineBase & {
      kind: 'needs-duration'
      title: string
      type: string
      providerName: string | null
      options: WellnessOption[]
    })
  /** Empty or unreadable product: the provider removed the service. */
  | (LineBase & { kind: 'unavailable'; title: string | null })

export type CartGroupView = {
  type: string
  label: string
  lines: CartLineView[]
  itemCount: number
  /** One entry per currency; amounts in different currencies are never added. */
  subtotals: Money[]
  unpricedCount: number
  unavailableCount: number
  /** Why this group cannot be checked out yet (empty when it can). */
  blockers: string[]
  /** Server-confirmed lines sent with checkout. */
  checkoutItems: { lineId: string; quantity: number }[]
}

export type CartView = {
  groups: CartGroupView[]
  totalItems: number
  /** Priced totals per currency across all groups (shown separately, never combined). */
  totalsByCurrency: Money[]
  unpricedCount: number
  unavailableCount: number
}

// ---- Checkout ----

export type CheckoutItems = { lineId: string; quantity: number }[]

export type CheckoutIntent = {
  attemptId: string
  groupType: string
  groupLabel: string
  items: CheckoutItems
  paymentMethod: PaymentMethod
  idempotencyKey: string
  /** Display-only snapshot of what is being paid. */
  totals: Money[]
  createdAt: number
}

export type CheckoutFailureKind = 'declined' | 'conflict' | 'blocked' | 'server' | 'invalid'

export type OrderStatus = 'pending' | 'paid' | 'failed'

export type CheckoutRecord =
  /** Intent saved, request in flight. */
  | { status: 'submitting'; intent: CheckoutIntent }
  /** We could not learn the outcome (lost connection): must be reconciled with the same key. */
  | { status: 'unknown'; intent: CheckoutIntent; message: string }
  /** The server created the order. */
  | { status: 'placed'; intent: CheckoutIntent; orderId: string; orderStatus: OrderStatus }
  /** Definitely not created. */
  | { status: 'failed'; intent: CheckoutIntent; kind: CheckoutFailureKind; message: string; retryable: boolean }

// ---- Guest merge ----

export type MergeChange = {
  productId: string
  lineId?: string
  title: string | null
  outcome: 'added' | 'quantity-combined' | 'skipped'
  reason?: string
  quantity?: number
  from?: number
  added?: number
  to?: number
  capped?: boolean
  wellness?: { status: 'applied' | 'kept-account-choice' | 'needs-choice'; durationInMinutes?: number | null }
}

export type GuestCartItem = { productId: string; quantity: number; wellnessPricingId?: string }
