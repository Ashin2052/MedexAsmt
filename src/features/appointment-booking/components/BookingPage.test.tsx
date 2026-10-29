import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startMockServer } from '@/test/mockServer'
import { BookingPage } from './BookingPage'

let server: Awaited<ReturnType<typeof startMockServer>>

function renderAt(url: string) {
  const router = createMemoryRouter(
    [
      { path: '/booking/reschedule/:bookingId', element: <BookingPage /> },
      { path: '/booking/:providerId', element: <BookingPage /> },
    ],
    { initialEntries: [url] },
  )
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

const slotRadio = (name: RegExp) => screen.findByRole('radio', { name })
const summary = () => screen.getByRole('complementary', { name: /Your appointment|Your change/ })

beforeEach(async () => {
  localStorage.clear()
  server = await startMockServer()
  vi.stubGlobal('fetch', server.fetch)
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await server.close()
})

describe('BookingPage', () => {
  it('a customer in Kathmandu books at the Bangkok hospital and sees both clocks', async () => {
    const user = userEvent.setup()
    renderAt('/booking/48?tz=Asia/Kathmandu&date=2026-10-29')

    const zones = await screen.findByRole('region', { name: 'Time zones' })
    expect(zones).toHaveTextContent('Riverside International Hospital: Bangkok (UTC+7)')
    expect(screen.getByRole('combobox', { name: 'Your time zone' })).toHaveValue('Asia/Kathmandu')

    // 11:20 is the existing booking: visible but not selectable.
    expect(await slotRadio(/^11:20 to 11:50 Bangkok time, 10:05 your time, Booked/)).toBeDisabled()
    await user.click(await slotRadio(/^10:40 to 11:10 Bangkok time, 09:25 your time$/))

    expect(summary()).toHaveTextContent('Thu 29 Oct, 10:40–11:10 Bangkok time')
    expect(summary()).toHaveTextContent('09:25 your time in Kathmandu')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText('You’re booked')).toBeInTheDocument()
    expect(server.callsTo('POST', '/api/bookings')).toHaveLength(1)
  })

  it('on a 409 keeps every selection, explains, and offers the nearest times', async () => {
    const user = userEvent.setup()
    const router = renderAt('/booking/48?tz=Asia/Kathmandu&date=2026-10-29&time=12:00')
    await slotRadio(/^12:00 to 12:30/)
    // Another customer books 12:00 while this page still shows it as free.
    const [specialist] = server.booking().providers.find((p) => p.id === 48)?.specialists ?? []
    await server.forward('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId: 48, specialistId: specialist.id, date: '2026-10-29', startTime: '12:00', numberOfPeople: 1, idempotencyKey: 'other-customer' }),
    })

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('12:00 was just taken')
    expect(alert).toHaveTextContent('Everything you entered is kept')
    // Selections are still in the URL.
    const params = new URLSearchParams(router.state.location.search)
    expect([params.get('date'), params.get('time'), params.get('tz')]).toEqual(['2026-10-29', '12:00', 'Asia/Kathmandu'])

    const options = within(alert).getAllByRole('button').map((b) => b.textContent)
    expect(options.slice(0, 3)).toEqual(['12:40(11:25 yours)', '10:40(09:25 yours)', '13:20(12:05 yours)'])
    await user.click(within(alert).getByRole('button', { name: /^12:40/ }))
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText('You’re booked')).toBeInTheDocument()
    expect(server.callsTo('POST', '/api/bookings')).toHaveLength(3) // the other customer's, then ours twice
  })

  it('when the outcome is unknown, only allows checking again with the same key', async () => {
    const user = userEvent.setup()
    renderAt('/booking/48?tz=Asia/Bangkok&date=2026-10-29&time=10:00')
    await slotRadio(/^10:00 to 10:30/)
    server.failNext('POST', '/api/bookings', 'lose-response')

    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText('Checking whether it went through')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirm booking' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check again' }))
    expect(await screen.findByText('You’re booked')).toBeInTheDocument()
    const keys = server.callsTo('POST', '/api/bookings').map((c) => (c.body as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toHaveLength(2)
    expect(keys[1]).toBe(keys[0])
    expect(server.booking().bookings.size).toBe(2) // the existing booking + exactly one new one
  })

  it('after a reload mid-booking, replays the saved attempt with the same key and shows the true result', async () => {
    const user = userEvent.setup()
    renderAt('/booking/48?tz=Asia/Bangkok&date=2026-10-29&time=10:00')
    await slotRadio(/^10:00 to 10:30/)
    server.failNext('POST', '/api/bookings', 'lose-response')
    await user.click(screen.getByRole('button', { name: 'Confirm booking' }))
    expect(await screen.findByText('Checking whether it went through')).toBeInTheDocument()

    cleanup() // the customer reloads the page
    renderAt('/booking/48?tz=Asia/Bangkok&date=2026-10-29&time=10:00')
    expect(await screen.findByText('You’re booked')).toBeInTheDocument()
    const keys = server.callsTo('POST', '/api/bookings').map((c) => (c.body as { idempotencyKey: string }).idempotencyKey)
    expect(keys).toEqual([keys[0], keys[0]])
    expect(server.booking().bookings.size).toBe(2) // the existing booking + exactly one new one
    expect(localStorage.getItem('medex.bookingAttempt.v1')).toBeNull()
  })

  it('explains reduced hours when a specialist consults outside opening hours', async () => {
    const rana = '0d113411-a562-4427-bcf5-96aff364e228'
    renderAt(`/booking/48?tz=Asia/Bangkok&specialist=${rana}&date=2026-10-27`)
    expect(
      await screen.findByText(/Dr\. N\. Rana consults 18:00–21:00, but Riverside International Hospital is open 08:00–20:00 on Tuesdays, so only appointments between 18:00 and 20:00/),
    ).toBeInTheDocument()
    expect(await slotRadio(/^19:40 to 20:00/)).toBeEnabled()
    expect(screen.queryByRole('radio', { name: /^20:00/ })).not.toBeInTheDocument()
  })

  it('only offers start times with enough consecutive free slots for a group', async () => {
    renderAt('/booking/48?tz=Asia/Bangkok&date=2026-10-27&people=2')
    expect(await slotRadio(/^10:00 to 10:30 .*for 2 people/)).toBeEnabled()
    expect(await slotRadio(/^10:40 to 11:10 .*Not enough free times in a row/)).toBeDisabled()
  })

  it('reschedule: the current time is not blocked by itself, and old vs new is unmistakable', async () => {
    const user = userEvent.setup()
    renderAt('/booking/reschedule/BK-20261008-0042?tz=Asia/Kathmandu')
    expect(await slotRadio(/^11:20 to 11:50 .*Your current time/)).toBeDisabled()
    await user.click(await slotRadio(/^12:00 to 12:30/))

    const change = summary()
    expect(within(change).getByText('Current appointment')).toBeInTheDocument()
    expect(within(change).getByText('New appointment')).toBeInTheDocument()
    expect(change).toHaveTextContent('Thu 29 Oct, 11:20 Bangkok time')
    expect(change).toHaveTextContent('Thu 29 Oct, 12:00–12:30 Bangkok time')
    await user.click(screen.getByRole('button', { name: 'Move my appointment' }))
    expect(await screen.findByText('Your appointment was moved')).toBeInTheDocument()
  })

  it('calendar: arrow keys move focus and unavailable days explain why', async () => {
    const user = userEvent.setup()
    renderAt('/booking/48?tz=Asia/Bangkok&date=2026-10-29')
    const grid = await screen.findByRole('grid')
    // "Today" is announced, not only shown by a ring.
    expect(within(grid).getByRole('button', { name: /^Monday, 26 October 2026, today at the provider, available/ })).toBeInTheDocument()
    const selected = within(grid).getByRole('button', { name: /^Thursday, 29 October 2026, available/ })
    act(() => selected.focus())
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAccessibleName(/^Friday, 30 October 2026/)
    await user.keyboard('{ArrowDown}{ArrowDown}')
    expect(document.activeElement).toHaveAccessibleName(/^Friday, 13 November 2026/)

    const sunday = within(grid).getByRole('button', { name: /^Sunday, 1 November 2026, closed/ })
    expect(sunday).toHaveAttribute('aria-disabled', 'true')
    await user.click(sunday)
    await waitFor(() => expect(screen.getByText(/Sunday, 1 November 2026: Riverside International Hospital is closed on sundays/)).toBeInTheDocument())
  })
})
