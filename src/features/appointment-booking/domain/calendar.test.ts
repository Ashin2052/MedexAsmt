import { describe, expect, it } from 'vitest'
import type { CalendarDay } from '../api/schemas'
import { addMonths, monthGrid, moveDate, nextAvailableDay } from './calendar'

describe('monthGrid', () => {
  it('lays out weeks Monday-first with padding', () => {
    const weeks = monthGrid('2026-11') // 1 Nov 2026 is a Sunday
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01'])
    expect(weeks.at(-1)?.[0]).toBe('2026-11-30')
    expect(weeks.every((w) => w.length === 7)).toBe(true)
  })

  it('adds months across a year end', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01')
    expect(addMonths('2027-01', -1)).toBe('2026-12')
  })
})

describe('moveDate (keyboard)', () => {
  const first = '2026-10-26'
  const last = '2027-01-23'
  it('moves by day, week, week edges and month', () => {
    expect(moveDate('2026-10-29', 'ArrowRight', first, last)).toBe('2026-10-30')
    expect(moveDate('2026-10-29', 'ArrowLeft', first, last)).toBe('2026-10-28')
    expect(moveDate('2026-10-29', 'ArrowDown', first, last)).toBe('2026-11-05')
    expect(moveDate('2026-11-05', 'ArrowUp', first, last)).toBe('2026-10-29')
    expect(moveDate('2026-10-29', 'Home', first, last)).toBe('2026-10-26') // Monday
    expect(moveDate('2026-10-29', 'End', first, last)).toBe('2026-11-01') // Sunday
    expect(moveDate('2026-10-31', 'PageDown', first, last)).toBe('2026-11-30') // clamps to month length
  })

  it('stays inside the 90-day window', () => {
    expect(moveDate(first, 'ArrowLeft', first, last)).toBe(first)
    expect(moveDate(first, 'PageUp', first, last)).toBe(first)
    expect(moveDate(last, 'ArrowDown', first, last)).toBe(last)
  })
})

describe('nextAvailableDay', () => {
  const day = (date: string, status: CalendarDay['status']): CalendarDay => ({ date, status, message: null, freeCount: status === 'available' ? 3 : 0 })
  it('finds the first available day on or after a date', () => {
    const days = [day('2026-10-26', 'fully-booked'), day('2026-10-27', 'available'), day('2026-10-28', 'weekly-closed'), day('2026-10-29', 'available')]
    expect(nextAvailableDay(days)?.date).toBe('2026-10-27')
    expect(nextAvailableDay(days, '2026-10-28')?.date).toBe('2026-10-29')
    expect(nextAvailableDay(days.slice(0, 1))).toBeNull()
  })
})
