import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMockServer } from '@/test/mockServer'
import { CartPage } from './CartPage'

let server: Awaited<ReturnType<typeof startMockServer>>

function renderCart() {
  const router = createMemoryRouter([{ path: '/cart', element: <CartPage /> }], { initialEntries: ['/cart'] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

const groupSection = (name: string) => screen.getByRole('region', { name })

beforeEach(async () => {
  localStorage.clear()
  sessionStorage.clear()
  server = await startMockServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await server.close()
})

describe('CartPage', () => {
  it('shows groups, per-currency subtotals and why a group cannot be checked out', async () => {
    renderCart()
    const labs = await screen.findByRole('region', { name: 'Lab tests' })
    // Subtotals: one per currency (the THB amount also appears as the line total).
    expect(within(labs).getAllByText('THB 1,677.00').length).toBeGreaterThan(0)
    expect(within(labs).getByText('NPR 12,520.00')).toBeInTheDocument()
    expect(within(labs).getByText(/never added together/)).toBeInTheDocument()

    const wellness = groupSection('Wellness')
    expect(within(wellness).getByText('Price unknown')).toBeInTheDocument()
    expect(within(wellness).getByText('Choose a duration for Signature Facial.')).toBeInTheDocument()
    expect(within(wellness).queryByRole('button', { name: /pay/i })).not.toBeInTheDocument()

    const unavailable = groupSection('Unavailable items')
    expect(within(unavailable).getByText('Service no longer available')).toBeInTheDocument()
  })

  it('merges the guest cart and reports every change', async () => {
    const user = userEvent.setup()
    renderCart()
    await user.click(await screen.findByRole('button', { name: 'Merge into my cart' }))

    const summary = await screen.findByRole('region', { name: /items you saved before signing in/ })
    expect(summary).toHaveTextContent('Liver Function Profile: Quantities combined: 2 already in your cart + 3 from this device = 5.')
    expect(summary).toHaveTextContent('Lipid Profile: Added (quantity 1).')
    expect(summary).toHaveTextContent('Your 90-minute choice was applied.')
    expect(summary).toHaveTextContent('Not added: this service is no longer available')

    // The guest's duration choice priced the facial, so wellness can now be checked out.
    await waitFor(() => expect(within(groupSection('Wellness')).queryByText('Price unknown')).not.toBeInTheDocument())
    expect(within(groupSection('Wellness')).getByRole('button', { name: /pay for wellness by card/i })).toBeEnabled()
  })

  it('choosing a duration prices the wellness line', async () => {
    const user = userEvent.setup()
    renderCart()
    const wellness = await screen.findByRole('region', { name: 'Wellness' })
    await user.click(within(wellness).getByRole('radio', { name: /60 min/ }))
    await waitFor(() => expect(within(wellness).getAllByText('THB 1,800.00').length).toBeGreaterThan(0))
    expect(within(wellness).queryByText('Price unknown')).not.toBeInTheDocument()
  })

  it('removes an unavailable item and moves focus sensibly', async () => {
    const user = userEvent.setup()
    renderCart()
    const unavailable = await screen.findByRole('region', { name: 'Unavailable items' })
    await user.click(within(unavailable).getByRole('button', { name: 'Remove' }))
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Unavailable items' })).not.toBeInTheDocument())
    expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1, name: /Your cart/ }))
  })

  it('checks out one group and shows its order without affecting the others', async () => {
    const user = userEvent.setup()
    renderCart()
    const packages = await screen.findByRole('region', { name: 'Health packages' })
    await user.click(within(packages).getByRole('button', { name: /pay for health packages by card/i }))

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Health packages' })).not.toBeInTheDocument())
    const summary = screen.getByRole('complementary', { name: 'Summary' })
    expect(within(summary).getByText('Health packages')).toBeInTheDocument()
    expect(within(summary).getByText(/Payment processing/)).toBeInTheDocument()
    expect(groupSection('Lab tests')).toBeInTheDocument()
  })

  it('increments quantity optimistically', async () => {
    const user = userEvent.setup()
    renderCart()
    const labs = await screen.findByRole('region', { name: 'Lab tests' })
    const plus = within(labs).getByRole('button', { name: 'Increase quantity of CBC Profile' })
    await user.click(plus)
    await user.click(plus)
    await waitFor(() => expect(within(labs).getAllByText('THB 5,031.00').length).toBeGreaterThan(0))
    await waitFor(() => expect(server.cart().cart.groups[0].items[0]).toMatchObject({ quantity: 3 }))
  })
})
