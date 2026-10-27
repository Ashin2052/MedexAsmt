import { useEffect, useState } from 'react'
import { describeApiError } from '@/shared/api/client'
import { fetchGuestSample, mergeGuestCart } from '../api/cartApi'
import type { RawCart } from '../api/schemas'
import { loadGuestCart, saveGuestCart, type GuestCartState } from '../domain/storage'

/**
 * The guest cart saved on this device before login. For the demo it is
 * seeded once from the mock API (the fixture's guestCart). Merging uses a
 * stable mergeId so retrying after a lost response cannot merge twice.
 */
export function useGuestCart(setCart: (cart: RawCart) => void) {
  const [state, setState] = useState<GuestCartState | null>(loadGuestCart)
  const [merging, setMerging] = useState(false)
  const [error, setError] = useState('')

  const update = (next: GuestCartState) => {
    saveGuestCart(next)
    setState(next)
  }

  useEffect(() => {
    if (state) return
    let cancelled = false
    fetchGuestSample()
      .then((items) => {
        if (cancelled) return
        const seeded = { items, mergeId: crypto.randomUUID(), mergedChanges: null }
        saveGuestCart(seeded)
        setState(seeded)
      })
      .catch(() => {
        // No guest cart available: nothing to merge.
      })
    return () => {
      cancelled = true
    }
  }, [state])

  const merge = async () => {
    if (!state || state.items.length === 0) return
    setMerging(true)
    setError('')
    try {
      const result = await mergeGuestCart(state.items, state.mergeId)
      setCart(result.cart)
      update({ items: [], mergeId: state.mergeId, mergedChanges: result.changes })
    } catch (err) {
      setError(`${describeApiError(err)} Your saved items are still on this device.`)
    } finally {
      setMerging(false)
    }
  }

  const dismissSummary = () => {
    if (state) update({ ...state, mergedChanges: null })
  }

  return {
    pendingItems: state?.items ?? [],
    changes: state?.mergedChanges ?? null,
    merging,
    error,
    merge,
    dismissSummary,
  }
}
