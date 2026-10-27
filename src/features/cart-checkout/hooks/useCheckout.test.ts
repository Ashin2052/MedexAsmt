import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMockServer } from '@/test/mockServer'
import { rawCartSchema } from '../api/schemas'
import { buildCartView } from '../domain/cart'
import { CHECKOUT_KEY } from '../domain/storage'
import type { CartGroupView, CheckoutRecord } from '../types'
import { useCheckout } from './useCheckout'

let server: Awaited<ReturnType<typeof startMockServer>>

function groups(): Record<string, CartGroupView> {
  const view = buildCartView(rawCartSchema.parse(server.cart().cart))
  return Object.fromEntries(view.groups.map((g) => [g.type, g]))
}

const statusOf = (records: CheckoutRecord[], type: string) => records.filter((r) => r.intent.groupType === type).at(-1)
const savedRecords = (): CheckoutRecord[] => JSON.parse(localStorage.getItem(CHECKOUT_KEY) ?? '[]')
const keysSent = () => server.callsTo('POST', '/api/checkout').map((c) => (c.body as { idempotencyKey: string }).idempotencyKey)

beforeEach(async () => {
  localStorage.clear()
  server = await startMockServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await server.close()
})

// A fresh query client per render, like a fresh page load.
const render = () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
  return renderHook(() => useCheckout({ pollIntervalMs: 5 }), { wrapper })
}

describe('useCheckout', () => {
  it('one group succeeds while another fails; retrying touches only the failed group', async () => {
    const { result } = render()
    const { lab_test, package: pkg } = groups()
    // Let the first checkout through, decline the second.
    server.failNext('POST', '/api/checkout', 402, 1)

    await act(() => result.current.checkoutAll([lab_test, pkg], { lab_test: 'card', package: 'pay_at_clinic' }))

    const lab = statusOf(result.current.records, 'lab_test')
    expect(lab).toMatchObject({ status: 'placed' })
    expect(statusOf(result.current.records, 'package')).toMatchObject({ status: 'failed', kind: 'declined', retryable: true })
    expect(server.cart().orders.size).toBe(1)

    await act(() => result.current.checkoutGroup(groups().package, 'pay_at_clinic'))
    expect(statusOf(result.current.records, 'package')).toMatchObject({ status: 'placed' })
    expect(server.cart().orders.size).toBe(2)
    // The first order was not touched or re-sent.
    expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ status: 'placed', orderId: (lab as { orderId: string }).orderId })
    expect(server.callsTo('POST', '/api/checkout').filter((c) => (c.body as { groupType: string }).groupType === 'lab_test')).toHaveLength(1)
  })

  it('saves the intent and key before sending the request', async () => {
    const { result } = render()
    server.fetch.mockImplementationOnce(async (input, init) => {
      // At the moment the POST leaves, the intent is already on disk.
      const saved = savedRecords()
      expect(saved).toHaveLength(1)
      expect(saved[0]).toMatchObject({ status: 'submitting', intent: { groupType: 'lab_test' } })
      expect(JSON.parse(String(init?.body)).idempotencyKey).toBe(saved[0].intent.idempotencyKey)
      return server.forward(input, init)
    })
    await act(() => result.current.checkoutGroup(groups().lab_test, 'card'))
  })

  it('a lost response becomes "unknown"; checking again reuses the key and finds the same order', async () => {
    const { result } = render()
    server.failNext('POST', '/api/checkout', 'lose-response')

    await act(() => result.current.checkoutGroup(groups().lab_test, 'card'))
    expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ status: 'unknown' })
    expect(server.cart().orders.size).toBe(1) // the server did create it

    // The group's lines are gone server-side; the retry must reuse the saved intent.
    await act(() => result.current.checkoutGroup(groups().lab_test ?? ({ type: 'lab_test' } as CartGroupView), 'card'))
    expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ status: 'placed' })
    expect(server.cart().orders.size).toBe(1) // no duplicate
    const [first, second] = keysSent()
    expect(second).toBe(first)
  })

  it('after a reload, an interrupted checkout is reconciled with the same key — no duplicate order', async () => {
    const first = render()
    server.failNext('POST', '/api/checkout', 'lose-response')
    await act(() => first.result.current.checkoutGroup(groups().package, 'card'))
    expect(statusOf(first.result.current.records, 'package')).toMatchObject({ status: 'unknown' })
    first.unmount()

    // "Reload": a fresh hook instance reads the saved intent and replays it.
    const reloaded = render()
    await waitFor(() => expect(statusOf(reloaded.result.current.records, 'package')).toMatchObject({ status: 'placed' }))
    expect(server.cart().orders.size).toBe(1)
    expect(new Set(keysSent()).size).toBe(1)
  })

  it('polls a card order until the payment settles', async () => {
    const { result } = render()
    await act(() => result.current.checkoutGroup(groups().lab_test, 'card'))
    expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ status: 'placed', orderStatus: 'pending' })
    server.advance(5000)
    await waitFor(() => expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ orderStatus: 'paid' }))
  })

  it('a 500 is retried with the same key; a decline gets a fresh key', async () => {
    const { result } = render()
    server.failNext('POST', '/api/checkout', 500)
    await act(() => result.current.checkoutGroup(groups().lab_test, 'card'))
    expect(statusOf(result.current.records, 'lab_test')).toMatchObject({ status: 'failed', kind: 'server' })
    await act(() => result.current.checkoutGroup(groups().lab_test, 'card'))
    expect(keysSent()[1]).toBe(keysSent()[0])

    server.failNext('POST', '/api/checkout', 402)
    await act(() => result.current.checkoutGroup(groups().package, 'card'))
    await act(() => result.current.checkoutGroup(groups().package, 'card'))
    const [, , declined, retried] = keysSent()
    expect(retried).not.toBe(declined)
  })
})
