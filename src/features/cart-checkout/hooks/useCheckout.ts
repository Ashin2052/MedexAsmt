import { useQueries, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { fetchOrder, postCheckout } from '../api/cartApi'
import { isCheckoutReady } from '../domain/cart'
import { activeRecordFor, classifyCheckoutError, reconcilePlan, samePayload, shouldReuseKey } from '../domain/checkout'
import { loadCheckoutRecords, saveCheckoutRecords } from '../domain/storage'
import type { CartGroupView, CheckoutIntent, CheckoutRecord, PaymentMethod } from '../types'

type Api = { postCheckout: typeof postCheckout; fetchOrder: typeof fetchOrder }

const DEFAULT_API: Api = { postCheckout, fetchOrder }
const POLL_INTERVAL_MS = 1500

/**
 * Checkout records plus the actions that change them. Every update is saved
 * to storage synchronously, so an intent is on disk before its request is
 * sent (reload safety). Created once per mounted cart page.
 */
function createCheckout(api: Api, queryClient: QueryClient) {
  let records = loadCheckoutRecords()
  const listeners = new Set<() => void>()

  const update = (change: (current: CheckoutRecord[]) => CheckoutRecord[]) => {
    records = change(records)
    saveCheckoutRecords(records)
    listeners.forEach((listener) => listener())
  }
  const replace = (attemptId: string, record: CheckoutRecord) =>
    update((current) => current.map((r) => (r.intent.attemptId === attemptId ? record : r)))
  const refreshCart = () => void queryClient.invalidateQueries({ queryKey: ['cart'] })

  /** Send (or re-send) an intent. Safe to call again with the same intent. */
  async function submit(intent: CheckoutIntent) {
    update((current) => [...current.filter((r) => r.intent.attemptId !== intent.attemptId), { status: 'submitting', intent }])
    try {
      const order = await api.postCheckout({
        groupType: intent.groupType,
        items: intent.items,
        paymentMethod: intent.paymentMethod,
        idempotencyKey: intent.idempotencyKey,
      })
      replace(intent.attemptId, { status: 'placed', intent, orderId: order.orderId, orderStatus: order.status })
      refreshCart() // ordered lines left the cart
    } catch (error) {
      const outcome = classifyCheckoutError(error)
      replace(
        intent.attemptId,
        outcome.status === 'unknown'
          ? { status: 'unknown', intent, message: outcome.message }
          : { status: 'failed', intent, kind: outcome.kind, message: outcome.message, retryable: outcome.retryable },
      )
      if (outcome.status === 'failed' && outcome.kind === 'conflict') refreshCart()
    }
  }

  /** Check out one group. Reuses the previous key only when that is required for safety. */
  async function checkoutGroup(group: CartGroupView, paymentMethod: PaymentMethod) {
    const previous = activeRecordFor(records, group.type)
    if (previous?.status === 'submitting') return
    // The first attempt may already have created the order: reconcile it as-is.
    if (previous?.status === 'unknown') return submit(previous.intent)
    if (!isCheckoutReady(group)) return

    const reuse = previous && shouldReuseKey(previous) && samePayload(previous.intent, group.checkoutItems, paymentMethod)
    // Drop a superseded failed attempt so the group shows only the new one.
    if (previous && !reuse) update((current) => current.filter((r) => r.intent.attemptId !== previous.intent.attemptId))
    return submit({
      attemptId: reuse ? previous.intent.attemptId : crypto.randomUUID(),
      groupType: group.type,
      groupLabel: group.label,
      items: group.checkoutItems,
      paymentMethod,
      idempotencyKey: reuse ? previous.intent.idempotencyKey : crypto.randomUUID(),
      totals: group.subtotals,
      createdAt: Date.now(),
    })
  }

  let reconciled = false

  return {
    getRecords: () => records,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    checkoutGroup,
    /** Check out every ready group in turn; one failure does not stop the others. */
    async checkoutAll(groups: CartGroupView[], methods: Record<string, PaymentMethod>) {
      for (const group of groups) await checkoutGroup(group, methods[group.type] ?? 'card')
    },
    clearFinished: () => update((current) => current.filter((r) => r.status !== 'placed')),
    /** After a reload: finish interrupted attempts with their saved key (once). */
    async reconcile() {
      if (reconciled) return
      reconciled = true
      for (const record of reconcilePlan(records).replay) await submit(record.intent)
    },
  }
}

/** Per-group checkout with persisted intents and live order status (see domain/checkout). */
export function useCheckout({ api = DEFAULT_API, pollIntervalMs = POLL_INTERVAL_MS }: { api?: Api; pollIntervalMs?: number } = {}) {
  const queryClient = useQueryClient()
  const [checkout] = useState(() => createCheckout(api, queryClient))
  const stored = useSyncExternalStore(checkout.subscribe, checkout.getRecords)

  useEffect(() => {
    void checkout.reconcile()
  }, [checkout])

  // Card orders that have not settled yet: poll until the payment is paid or failed.
  const unsettled = reconcilePlan(stored).poll.flatMap((r) => (r.status === 'placed' ? [r.orderId] : []))
  const orders = useQueries({
    queries: unsettled.map((orderId) => ({
      queryKey: ['order', orderId],
      queryFn: () => api.fetchOrder(orderId),
      refetchInterval: (query: { state: { data?: { status: string } } }) =>
        query.state.data?.status === 'paid' || query.state.data?.status === 'failed' ? false : pollIntervalMs,
    })),
  })
  const latestStatus = new Map(orders.flatMap((o) => (o.data ? [[o.data.orderId, o.data.status] as const] : [])))
  const records = stored.map((r) =>
    r.status === 'placed' && latestStatus.has(r.orderId) ? { ...r, orderStatus: latestStatus.get(r.orderId) ?? r.orderStatus } : r,
  )

  return { records, checkoutGroup: checkout.checkoutGroup, checkoutAll: checkout.checkoutAll, clearFinished: checkout.clearFinished }
}
