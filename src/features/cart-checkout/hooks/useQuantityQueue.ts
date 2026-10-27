import { useState } from 'react'
import { ApiError, describeApiError } from '@/shared/api/client'
import { updateQuantity as apiUpdateQuantity } from '../api/cartApi'
import type { RawCart } from '../api/schemas'
import { requestQuantity, settleFailure, settleSuccess, type LineQueue, type QueueStep } from '../domain/quantityQueue'

type Api = { updateQuantity: (lineId: string, quantity: number) => Promise<RawCart> }

const DEFAULT_API: Api = { updateQuantity: apiUpdateQuantity }

function failureMessage(error: unknown, restoredTo: number): string {
  const reason =
    error instanceof ApiError && error.status === 409
      ? 'This item changed on the server.'
      : error instanceof ApiError && error.status === 422
        ? error.message
        : describeApiError(error)
  return `${reason} We restored the quantity to ${restoredTo}.`
}

type ControllerDeps = {
  api: Api
  setCart: (cart: RawCart) => void
  onSnapshot: (queues: ReadonlyMap<string, LineQueue>) => void
  onError: (lineId: string, message: string | null) => void
}

/**
 * Runs the side effects of the pure queue (domain/quantityQueue): sends the
 * requests it asks for and feeds responses back. Lives for the component's
 * lifetime so in-flight responses always reach the current queue.
 */
function createQueueController({ api, setCart, onSnapshot, onError }: ControllerDeps) {
  const queues = new Map<string, LineQueue>()

  function apply(lineId: string, step: QueueStep) {
    if (step.queue) queues.set(lineId, step.queue)
    else queues.delete(lineId)
    onSnapshot(new Map(queues))
    if (step.send === null) return

    const sent = step.send
    api
      .updateQuantity(lineId, sent)
      .then((cart) => {
        setCart(cart)
        const current = queues.get(lineId)
        if (!current) return
        const serverLine = cart.groups.flatMap((g) => g.items).find((item) => item.id === lineId)
        apply(lineId, settleSuccess(current, serverLine?.quantity ?? sent))
      })
      .catch((error: unknown) => {
        const current = queues.get(lineId)
        if (!current) return
        const { rollbackTo } = settleFailure(current)
        queues.delete(lineId)
        onSnapshot(new Map(queues))
        onError(lineId, failureMessage(error, rollbackTo))
      })
  }

  return {
    change(lineId: string, serverQuantity: number, desired: number) {
      onError(lineId, null)
      apply(lineId, requestQuantity(queues.get(lineId) ?? null, serverQuantity, desired))
    },
  }
}

/**
 * Optimistic quantity changes with a per-line serial queue. Returns the
 * quantities to display while requests are pending, which lines are saving,
 * and per-line error messages after a rollback.
 */
export function useQuantityQueue(setCart: (cart: RawCart) => void, api: Api = DEFAULT_API) {
  const [snapshot, setSnapshot] = useState<ReadonlyMap<string, LineQueue>>(new Map())
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [controller] = useState(() =>
    createQueueController({
      // Both must be stable (setCart comes from a useCallback); captured once.
      api,
      setCart,
      onSnapshot: setSnapshot,
      onError: (lineId, message) =>
        setErrors((prev) => {
          if (message === null) {
            if (!(lineId in prev)) return prev
            const next = { ...prev }
            delete next[lineId]
            return next
          }
          return { ...prev, [lineId]: message }
        }),
    }),
  )

  const overrides = new Map([...snapshot].map(([lineId, queue]) => [lineId, queue.desired]))
  const pendingLineIds = new Set([...snapshot].filter(([, queue]) => queue.inFlight !== null).map(([lineId]) => lineId))

  return { overrides, pendingLineIds, errors, changeQuantity: controller.change }
}
