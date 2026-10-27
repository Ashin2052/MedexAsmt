// 90-day calendar helpers: month grids and keyboard movement. Dates are
// provider-local calendar dates ("YYYY-MM-DD"), handled as plain UTC days.
import type { CalendarDay, DayStatus } from '../api/schemas'

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function monthKey(date: string): string {
  return date.slice(0, 7)
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return d.toISOString().slice(0, 7)
}

export function monthTitle(month: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(new Date(`${month}-01T00:00:00Z`))
}

/** Weeks (Monday first) for a month; null cells pad the first and last week. */
export function monthGrid(month: string): (string | null)[][] {
  const first = `${month}-01`
  const firstWeekday = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7 // Monday = 0
  const [y, m] = month.split('-').map(Number)
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => addDays(first, i)),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7))
}

export type CalendarKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End' | 'PageUp' | 'PageDown'

/** Keyboard movement (WAI-ARIA date grid pattern), clamped to [first, last]. */
export function moveDate(date: string, key: CalendarKey, first: string, last: string): string {
  const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
  let next = date
  switch (key) {
    case 'ArrowLeft':
      next = addDays(date, -1)
      break
    case 'ArrowRight':
      next = addDays(date, 1)
      break
    case 'ArrowUp':
      next = addDays(date, -7)
      break
    case 'ArrowDown':
      next = addDays(date, 7)
      break
    case 'Home':
      next = addDays(date, -weekday)
      break
    case 'End':
      next = addDays(date, 6 - weekday)
      break
    case 'PageUp':
      next = shiftMonthClamped(date, -1)
      break
    case 'PageDown':
      next = shiftMonthClamped(date, 1)
      break
  }
  if (next < first) return first
  if (next > last) return last
  return next
}

function shiftMonthClamped(date: string, delta: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + delta + 1, 0)).getUTCDate()
  return new Date(Date.UTC(y, m - 1 + delta, Math.min(d, lastDay))).toISOString().slice(0, 10)
}

export const DAY_STATUS_LABELS: Record<DayStatus, string> = {
  available: 'Available',
  past: 'Past',
  'outside-window': 'Not open for booking yet',
  closure: 'Closed',
  'weekly-closed': 'Closed',
  'no-overlap': 'Specialist not available',
  'fully-booked': 'Fully booked',
  invalid: 'Unavailable',
  'not-found': 'Unavailable',
}

/** First available day on or after `from` (the "next available date" shortcut). */
export function nextAvailableDay(days: CalendarDay[], from?: string): CalendarDay | null {
  return days.find((d) => d.status === 'available' && (!from || d.date >= from)) ?? null
}
