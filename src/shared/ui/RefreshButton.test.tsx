import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { RefreshButton } from './RefreshButton'

describe('RefreshButton', () => {
  it("re-fetches only its page's queries and ignores clicks while refreshing", async () => {
    let release = () => {}
    const loadPage = vi.fn(() => new Promise<string>((resolve) => (release = () => resolve('page'))))
    const loadOther = vi.fn(async () => 'other')
    function Page() {
      useQuery({ queryKey: ['page', { filter: 'lab_test' }], queryFn: loadPage, staleTime: Infinity })
      useQuery({ queryKey: ['other'], queryFn: loadOther, staleTime: Infinity })
      return <RefreshButton queryKey={['page']} />
    }
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Page />
      </QueryClientProvider>,
    )
    const user = userEvent.setup()

    expect(await screen.findByRole('button', { name: 'Refreshing…' })).toHaveAttribute('aria-busy', 'true')
    release()
    await user.click(await screen.findByRole('button', { name: 'Refresh' }))
    expect(loadPage).toHaveBeenCalledTimes(2)

    await user.click(await screen.findByRole('button', { name: 'Refreshing…' }))
    expect(loadPage).toHaveBeenCalledTimes(2)
    release()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument())
    expect(loadOther).toHaveBeenCalledTimes(1)
  })
})
