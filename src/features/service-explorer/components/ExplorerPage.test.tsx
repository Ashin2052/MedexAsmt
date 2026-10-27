import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { explorerFixture } from '../../../test/fixtures'
import { ExplorerPage } from './ExplorerPage'

type FetchMode = 'ok' | 'fail-once'

function mockApi(mode: FetchMode = 'ok') {
  const data = explorerFixture()
  let failuresLeft = mode === 'fail-once' ? 1 : 0
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (failuresLeft > 0 && url.includes('/services')) {
      failuresLeft -= 1
      return new Response(JSON.stringify({ message: 'Mock failure injected (500).' }), { status: 500 })
    }
    const key = (['categories', 'providers', 'services'] as const).find((k) => url.includes(`/api/explorer/${k}`))
    return key ? new Response(JSON.stringify(data[key])) : new Response('{}', { status: 404 })
  })
}

function renderExplorer(initialUrl = '/explorer') {
  const router = createMemoryRouter([{ path: '/explorer', element: <ExplorerPage /> }], { initialEntries: [initialUrl] })
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

afterEach(() => {
  vi.unstubAllGlobals()
})

function resultSummary() {
  return document.querySelector('[aria-live="polite"][aria-atomic="true"]')!
}

describe('ExplorerPage', () => {
  it('shows skeletons, then all visible services grouped by provider', async () => {
    vi.stubGlobal('fetch', mockApi())
    renderExplorer()
    expect(screen.getByText('Loading services…')).toBeInTheDocument()
    await waitFor(() => expect(resultSummary()).toHaveTextContent(/2,853 services from \d+ providers/))
    expect(screen.getAllByRole('article').length).toBeLessThanOrEqual(10)
  })

  it('applies a facet, writes it to the URL, announces the new count and restores on back', async () => {
    vi.stubGlobal('fetch', mockApi())
    const user = userEvent.setup()
    const router = renderExplorer()
    await waitFor(() => expect(resultSummary()).toHaveTextContent('2,853 services'))

    const sidebar = screen.getByRole('complementary', { name: 'Filters' })
    const typeGroup = within(sidebar).getByRole('group', { name: 'Service type' })
    await user.click(within(typeGroup).getByRole('checkbox', { name: /Lab test/ }))

    expect(router.state.location.search).toBe('?type=lab_test')
    await waitFor(() => expect(resultSummary()).not.toHaveTextContent('2,853 services'))
    const labCount = resultSummary().textContent

    // The Lab test option's own count is unchanged by selecting it (it excludes its own facet).
    expect(within(typeGroup).getByRole('checkbox', { name: /Lab test/ })).toBeChecked()

    await act(() => router.navigate(-1))
    await waitFor(() => expect(resultSummary()).toHaveTextContent('2,853 services'))
    expect(within(typeGroup).getByRole('checkbox', { name: /Lab test/ })).not.toBeChecked()

    await act(() => router.navigate(1))
    await waitFor(() => expect(resultSummary()).toHaveTextContent(labCount ?? ''))
  })

  it('restores the exact view from a shared link', async () => {
    vi.stubGlobal('fetch', mockApi())
    renderExplorer('/explorer?type=package&city=bangkok&cur=THB&max=5000&sort=price_asc')
    await waitFor(() => expect(resultSummary()).toHaveTextContent(/services from/))
    expect(screen.getByRole('combobox', { name: /Sort by/ })).toHaveValue('price_asc')
    expect(screen.getByRole('button', { name: /Up to THB 5,000.00/ })).toBeInTheDocument()
    for (const article of screen.getAllByRole('article')) {
      expect(article).toHaveTextContent('Bangkok, Thailand')
    }
  })

  it('Refresh calls the API again and applies the current filters to the new data', async () => {
    const data = explorerFixture()
    let servicesCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input)
        if (!url.includes('/api/explorer/services')) return mockApi()(input)
        servicesCalls += 1
        // The second response no longer contains every other lab test.
        let labTests = 0
        const services = servicesCalls === 1 ? data.services : data.services.filter((s) => (s as { type: string }).type !== 'lab_test' || labTests++ % 2 === 0)
        return new Response(JSON.stringify(services))
      }),
    )
    const user = userEvent.setup()
    const router = renderExplorer('/explorer?type=lab_test&sort=rating')
    await waitFor(() => expect(resultSummary()).toHaveTextContent('1,155 services'))

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    await waitFor(() => expect(resultSummary()).not.toHaveTextContent('1,155 services'))
    expect(servicesCalls).toBe(2)
    expect(resultSummary()).toHaveTextContent(/services from/)
    expect(router.state.location.search).toBe('?type=lab_test&sort=rating')
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('shows an error with a working retry when the API fails', async () => {
    vi.stubGlobal('fetch', mockApi('fail-once'))
    const user = userEvent.setup()
    renderExplorer()
    expect(await screen.findByRole('alert')).toHaveTextContent("We couldn't load services")
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(resultSummary()).toHaveTextContent('2,853 services'))
  })

  it('offers a way out of an empty result', async () => {
    vi.stubGlobal('fetch', mockApi())
    const user = userEvent.setup()
    const router = renderExplorer('/explorer?type=insurance&home=1')
    expect(await screen.findByRole('heading', { name: /No services match/ })).toBeInTheDocument()
    const suggestion = screen.getAllByRole('button', { name: /^Remove/ })[0]
    await user.click(suggestion)
    await waitFor(() => expect(screen.queryByRole('heading', { name: /No services match/ })).not.toBeInTheDocument())
    expect(router.state.location.search).not.toBe('?type=insurance&home=1')
  })

  it('mobile drawer previews the pending count and applies only on "Show results"', async () => {
    vi.stubGlobal('fetch', mockApi())
    const user = userEvent.setup()
    const router = renderExplorer()
    await waitFor(() => expect(resultSummary()).toHaveTextContent('2,853 services'))

    await user.click(screen.getByRole('button', { name: 'Filters' }))
    const drawer = screen.getByRole('dialog', { name: 'Filters', hidden: true })
    const typeGroup = within(drawer).getByRole('group', { name: 'Service type', hidden: true })
    await user.click(within(typeGroup).getByRole('checkbox', { name: /Wellness/, hidden: true }))

    const apply = within(drawer).getByRole('button', { name: /^Show [\d,]+ results$/, hidden: true })
    expect(router.state.location.search).toBe('')
    const pending = apply.textContent?.match(/[\d,]+/)?.[0]
    await user.click(apply)

    expect(router.state.location.search).toBe('?type=wellness')
    await waitFor(() => expect(resultSummary()).toHaveTextContent(`${pending} services`))
  })
})
