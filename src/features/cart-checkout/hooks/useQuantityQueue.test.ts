import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { RawCart } from '../api/schemas'
import { useQuantityQueue } from './useQuantityQueue'

const cartWith = (quantity: number): RawCart => ({
  groups: [{ type: 'lab_test', items: [{ id: 'line-1', productId: 'p', quantity, product: {} }] }],
})

/** Requests resolve only when the test says so, in any order it chooses. */
function deferredApi() {
  const pending: { quantity: number; resolve: () => void; reject: (e: unknown) => void }[] = []
  const updateQuantity = vi.fn(
    (_lineId: string, quantity: number) =>
      new Promise<RawCart>((resolve, reject) => {
        pending.push({ quantity, resolve: () => resolve(cartWith(quantity)), reject })
      }),
  )
  return { api: { updateQuantity }, pending }
}

describe('useQuantityQueue', () => {
  it('five rapid taps end on the right quantity with requests strictly in order', async () => {
    const { api, pending } = deferredApi()
    const setCart = vi.fn()
    const { result } = renderHook(() => useQuantityQueue(setCart, api))

    act(() => {
      for (let q = 2; q <= 6; q += 1) result.current.changeQuantity('line-1', 1, q)
    })
    // Optimistic: the UI shows 6 at once, but only one request is in flight.
    expect(result.current.overrides.get('line-1')).toBe(6)
    expect(api.updateQuantity).toHaveBeenCalledTimes(1)
    expect(api.updateQuantity).toHaveBeenLastCalledWith('line-1', 2)

    await act(async () => pending[0].resolve())
    expect(api.updateQuantity).toHaveBeenCalledTimes(2)
    expect(api.updateQuantity).toHaveBeenLastCalledWith('line-1', 6)
    expect(result.current.overrides.get('line-1')).toBe(6) // no flicker back to 2

    await act(async () => pending[1].resolve())
    expect(result.current.overrides.has('line-1')).toBe(false) // settled on the server value
    expect(setCart).toHaveBeenLastCalledWith(cartWith(6))
  })

  it('rolls back to the confirmed quantity and explains why when the server rejects', async () => {
    const { api, pending } = deferredApi()
    const { result } = renderHook(() => useQuantityQueue(vi.fn(), api))

    act(() => result.current.changeQuantity('line-1', 2, 3))
    expect(result.current.overrides.get('line-1')).toBe(3)

    await act(async () => pending[0].reject(new ApiError('Conflict', 'http', 409)))
    expect(result.current.overrides.has('line-1')).toBe(false) // back to the server's 2
    expect(result.current.errors['line-1']).toBe('This item changed on the server. We restored the quantity to 2.')

    act(() => result.current.changeQuantity('line-1', 2, 4))
    expect(result.current.errors['line-1']).toBeUndefined()
  })
})
