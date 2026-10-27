import { describe, expect, it } from 'vitest'
import {
  canonicalZone,
  customerDayShift,
  dayPeriod,
  dayShiftLabel,
  formatClock,
  formatDate,
  weekdayName,
  zoneCity,
  zoneLabel,
  zoneOffsetLabel,
} from './time'

describe('two clocks', () => {
  // 11:20 in Bangkok on 29 Oct = 04:20 UTC.
  const bangkok1120 = '2026-10-29T04:20:00.000Z'

  it('shows a Bangkok appointment in Kathmandu time (UTC+5:45 vs UTC+7)', () => {
    expect(formatClock(bangkok1120, 'Asia/Bangkok')).toBe('11:20')
    expect(formatClock(bangkok1120, 'Asia/Kathmandu')).toBe('10:05')
    expect(customerDayShift(bangkok1120, '2026-10-29', 'Asia/Kathmandu')).toBe(0)
  })

  it('flags late-evening slots that fall on another day for the customer', () => {
    // 23:00 in Kolkata (Aravali Hospital) = 17:30 UTC = 00:30 next day in Bangkok.
    const late = '2026-10-27T17:30:00.000Z'
    expect(formatClock(late, 'Asia/Bangkok')).toBe('00:30')
    expect(customerDayShift(late, '2026-10-27', 'Asia/Bangkok')).toBe(1)
    expect(dayShiftLabel(1)).toBe('next day')
    // …and the previous day for a customer far to the west.
    expect(customerDayShift('2026-10-27T01:00:00.000Z', '2026-10-27', 'America/New_York')).toBe(-1)
    expect(dayShiftLabel(-1)).toBe('previous day')
    expect(dayShiftLabel(0)).toBe('')
  })

  it('handles a customer zone with daylight saving', () => {
    expect(formatClock('2026-03-07T14:00:00.000Z', 'America/New_York')).toBe('09:00') // EST
    expect(formatClock('2026-03-09T13:00:00.000Z', 'America/New_York')).toBe('09:00') // EDT
  })
})

describe('zone labels', () => {
  it('uses current canonical names even when the platform reports legacy ones', () => {
    expect(canonicalZone('Asia/Katmandu')).toBe('Asia/Kathmandu')
    expect(canonicalZone('Asia/Calcutta')).toBe('Asia/Kolkata')
    expect(zoneCity('Asia/Katmandu')).toBe('Kathmandu')
    expect(zoneCity('America/New_York')).toBe('New York')
  })

  it('shows the offset', () => {
    expect(zoneOffsetLabel('Asia/Kathmandu')).toBe('UTC+5:45')
    expect(zoneOffsetLabel('Asia/Bangkok')).toBe('UTC+7')
    expect(zoneLabel('Asia/Kolkata')).toBe('Kolkata (UTC+5:30)')
    expect(zoneOffsetLabel('UTC')).toBe('UTC')
  })
})

describe('misc', () => {
  it('groups slots by the provider’s clock', () => {
    expect(dayPeriod('11:59')).toBe('morning')
    expect(dayPeriod('12:00')).toBe('afternoon')
    expect(dayPeriod('16:59')).toBe('afternoon')
    expect(dayPeriod('17:00')).toBe('evening')
  })

  it('formats calendar dates without shifting them by time zone', () => {
    expect(formatDate('2026-11-01')).toBe('Sun 1 Nov')
    expect(formatDate('2026-11-01', 'long')).toBe('Sunday, 1 November 2026')
    expect(weekdayName('2026-11-01')).toBe('Sunday')
  })
})
