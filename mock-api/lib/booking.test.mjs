// @vitest-environment node
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const lib = require('./booking.cjs')
const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'data/task3-booking.json'), 'utf8'))

// Monday 26 Oct 2026, 10:00 in Bangkok (08:45 Kathmandu, 08:30 Kolkata).
const NOW = Date.UTC(2026, 9, 26, 3, 0)
const WONGSAKUL = '2a2f07eb-7886-4f83-82ab-ca56f415da44' // 10:00–16:00, 30 + 10
const RANA = '0d113411-a562-4427-bcf5-96aff364e228' // 18:00–21:00, 20 + 0
const CHAIYAPORN = 'dff8af8b-0f1f-4a35-8b5c-8722fec53698' // 07:00–12:00, 45 + 15
const EXISTING = 'BK-20261008-0042'

const fresh = (now = NOW) => lib.createBookingState(fixture, now)
const day = (state, providerId, specialistId, date, people = 1, opts = {}) =>
  lib.buildDay(state, providerId, specialistId, date, people, { now: NOW, ...opts })
const times = (d, state) => d.slots.filter((s) => !state || s.state === state).map((s) => s.startTime)

describe('normalizeTimezone', () => {
  it('handles every raw value in the fixture', () => {
    const table = fixture.providers.map((p) => {
      const r = lib.normalizeTimezone(p.timezone, p.country, NOW)
      return [JSON.stringify(p.timezone), r.zone, r.source]
    })
    expect(table).toEqual([
      ['"Asia/Bangkok"', 'Asia/Bangkok', 'iana'],
      ['" UTC+05:45"', 'Asia/Kathmandu', 'offset'],
      ['"Nepal Standard Time"', 'Asia/Kathmandu', 'windows'],
      ['"(GMT+5:45)"', 'Asia/Kathmandu', 'offset'],
      ['"Asia/Katmandu "', 'Asia/Kathmandu', 'alias'],
      ['""', 'Asia/Kolkata', 'country-fallback'],
    ])
  })

  it('falls back by country for unusable values and says why', () => {
    for (const [raw, country, zone] of [
      ['Mars/Olympus', 'TH', 'Asia/Bangkok'],
      ['not a zone', 'NP', 'Asia/Kathmandu'],
      ['   ', 'IN', 'Asia/Kolkata'],
      [null, 'IN', 'Asia/Kolkata'],
    ]) {
      const r = lib.normalizeTimezone(raw, country, NOW)
      expect(r).toMatchObject({ zone, source: 'country-fallback' })
      expect(r.note).toMatch(zone)
    }
  })

  it('parses other offset spellings and maps a mismatched offset to its own zone', () => {
    expect(lib.normalizeTimezone('UTC+0545', 'NP', NOW).zone).toBe('Asia/Kathmandu')
    expect(lib.normalizeTimezone('GMT+7', 'TH', NOW).zone).toBe('Asia/Bangkok')
    const mismatch = lib.normalizeTimezone('UTC+05:30', 'NP', NOW)
    expect(mismatch).toMatchObject({ zone: 'Asia/Kolkata', source: 'offset' })
    expect(mismatch.note).toMatch(/does not match/)
    expect(lib.parseOffset('UTC-03:30')).toBe(-210)
    expect(lib.parseOffset('UTC+25')).toBeNull()
  })
})

describe('zonedTimeToUtc', () => {
  it('converts provider wall-clock times to UTC for offset and IANA zones', () => {
    const iso = (date, time, zone) => new Date(lib.zonedTimeToUtc(date, time, zone)).toISOString()
    expect(iso('2026-10-29', '11:20', 'Asia/Bangkok')).toBe('2026-10-29T04:20:00.000Z')
    expect(iso('2026-10-29', '09:00', 'Asia/Kathmandu')).toBe('2026-10-29T03:15:00.000Z')
    expect(iso('2026-10-29', '23:00', 'Asia/Kolkata')).toBe('2026-10-29T17:30:00.000Z')
    // DST zones (customers can live anywhere): before and after the spring-forward change.
    expect(iso('2026-03-07', '09:00', 'America/New_York')).toBe('2026-03-07T14:00:00.000Z')
    expect(iso('2026-03-09', '09:00', 'America/New_York')).toBe('2026-03-09T13:00:00.000Z')
  })
})

describe('createBookingState: day offsets from the provider’s own "today"', () => {
  it('uses each provider’s local date, not one global date', () => {
    // 26 Oct 17:30 UTC = 00:30 on 27 Oct in Bangkok, still 26 Oct in Kathmandu and Kolkata.
    const state = fresh(Date.UTC(2026, 9, 26, 17, 30))
    const today = Object.fromEntries(state.providers.map((p) => [p.id, p.today]))
    expect(today[48]).toBe('2026-10-27')
    expect(today[46]).toBe('2026-10-26')
    expect(today[131]).toBe('2026-10-26')
    // dayOffset 12 (Riverside) and 4 (Himal) count from those dates.
    expect(state.closures.map((c) => [c.providerId, c.date])).toEqual([
      [48, '2026-11-08'],
      [46, '2026-10-30'],
    ])
  })
})

describe('buildDay', () => {
  const state = fresh()

  it('treats a missing weekly schedule as closed', () => {
    expect(day(state, 48, WONGSAKUL, '2026-11-01')).toMatchObject({ status: 'weekly-closed' }) // Sunday
  })

  it('shows closures with their reason', () => {
    const closure = state.closures.find((c) => c.providerId === 48)
    expect(day(state, 48, WONGSAKUL, closure.date)).toMatchObject({ status: 'closure', message: 'Closed: Public holiday.' })
  })

  it('intersects specialist hours with opening hours and explains the trimmed window', () => {
    const tuesday = day(state, 48, RANA, '2026-10-27') // open 08:00–20:00, Rana 18:00–21:00
    expect(times(tuesday)).toEqual(['18:00', '18:20', '18:40', '19:00', '19:20', '19:40'])
    expect(tuesday.window).toEqual({
      consultation: { start: '18:00', end: '21:00' },
      opening: { start: '08:00', end: '20:00' },
      bookable: { start: '18:00', end: '20:00' },
    })
    expect(day(state, 48, RANA, '2026-10-30')).toMatchObject({ status: 'no-overlap' }) // Friday closes 17:00

    // Chaiyaporn 07:00–12:00: the 07:00 slot starts before opening (08:00, Saturday 09:00).
    expect(times(day(state, 48, CHAIYAPORN, '2026-10-27'))).toEqual(['08:00', '09:00', '10:00', '11:00'])
    expect(times(day(state, 48, CHAIYAPORN, '2026-10-31'))).toEqual(['09:00', '10:00', '11:00'])
  })

  it('steps by duration + buffer and keeps the last slot inside the consultation hours', () => {
    const slots = day(state, 48, WONGSAKUL, '2026-10-29').slots
    expect(slots.map((s) => s.startTime)).toEqual(['10:00', '10:40', '11:20', '12:00', '12:40', '13:20', '14:00', '14:40', '15:20'])
    expect(slots.at(-1).endTime).toBe('15:50') // 16:00 would end at 16:30, after 16:00

    const mehra = fresh().providers.find((p) => p.id === 131).specialists[0] // 21:00–23:30, 25 + 5
    const late = lib.buildDay(state, 131, mehra.id, '2026-10-27', 1, { now: NOW }).slots
    expect(late.map((s) => s.startTime)).toEqual(['21:00', '21:30', '22:00', '22:30', '23:00'])
    expect(late.at(-1)).toMatchObject({ endTime: '23:25', startUtc: '2026-10-27T17:30:00.000Z' })
  })

  it('keeps booked slots visible but not bookable', () => {
    const d = day(state, 48, WONGSAKUL, '2026-10-27')
    expect(d.slots.find((s) => s.startTime === '11:20')).toMatchObject({ state: 'booked' })
    expect(times(d, 'booked')).toEqual(['11:20', '12:00', '12:40', '13:20', '14:40', '15:20'])
  })

  it('disables slots that already started by the provider’s clock, not the customer’s', () => {
    const today = day(state, 48, WONGSAKUL, '2026-10-26') // 10:00 in Bangkok
    expect(today.slots[0]).toMatchObject({ startTime: '10:00', state: 'past' }) // started exactly now
    expect(today.slots.find((s) => s.startTime === '11:20').state).toBe('free')
    // Same instant in Kathmandu is 08:45: 08:40 has started, 09:00 has not.
    const shrestha = state.providers.find((p) => p.id === 46).specialists[0]
    const kathmandu = lib.buildDay(state, 46, shrestha.id, '2026-10-26', 1, { now: NOW }).slots
    expect(kathmandu.find((s) => s.startTime === '08:40').state).toBe('past')
    expect(kathmandu.find((s) => s.startTime === '09:00').state).not.toBe('past')
  })

  it('offers a start time for N people only when N consecutive slots are free', () => {
    // 27 Oct: 10:00, 10:40 free; 11:20–13:20 booked; 14:00 free; 14:40 booked; 15:20 booked.
    const free = (people) => times(day(state, 48, WONGSAKUL, '2026-10-27', people), 'free')
    expect(free(1)).toEqual(['10:00', '10:40', '14:00'])
    expect(free(2)).toEqual(['10:00']) // 10:40 + 11:20 is broken by a booking
    expect(free(3)).toEqual([])
    expect(day(state, 48, WONGSAKUL, '2026-10-27', 3)).toMatchObject({ status: 'fully-booked' })
    // 30 Nov is past the fixture's seeded bookings (offsets 0–29): four in a row, buffers between.
    const four = day(state, 48, WONGSAKUL, '2026-11-30', 4)
    expect(four.slots[0]).toMatchObject({ state: 'free', groupTimes: ['10:00', '10:40', '11:20', '12:00'] })
    expect(times(four, 'free').at(-1)).toBe('13:20') // 13:20, 14:00, 14:40, 15:20 — the last run that fits
    expect(four.slots.find((s) => s.startTime === '14:00').state).toBe('insufficient')
  })

  it('a slot outside opening hours breaks a consecutive run', () => {
    // Saturday 28 Nov (09:00–13:00): only 09:00, 10:00, 11:00 fit, so a group of 3 can only start at 09:00.
    expect(times(day(state, 48, CHAIYAPORN, '2026-11-28', 3), 'free')).toEqual(['09:00'])
    expect(times(day(state, 48, CHAIYAPORN, '2026-11-28', 4), 'free')).toEqual([])
  })
})

describe('bookings', () => {
  it('blocks the existing booking for others, but not for its own reschedule', () => {
    const state = fresh()
    const forOthers = day(state, 48, WONGSAKUL, '2026-10-29').slots.find((s) => s.startTime === '11:20')
    expect(forOthers).toMatchObject({ state: 'booked', isCurrentBooking: false })
    const forItself = day(state, 48, WONGSAKUL, '2026-10-29', 1, { excludeBookingId: EXISTING }).slots.find((s) => s.startTime === '11:20')
    expect(forItself).toMatchObject({ state: 'free', isCurrentBooking: true })
  })

  it('reschedules: moving frees the old slot; the same time is refused', () => {
    const state = fresh()
    expect(lib.rescheduleBooking(state, EXISTING, { date: '2026-10-29', startTime: '11:20' }, { now: NOW }).status).toBe(422)
    const moved = lib.rescheduleBooking(state, EXISTING, { date: '2026-11-02', startTime: '10:40' }, { now: NOW })
    expect(moved).toMatchObject({ status: 200, body: { date: '2026-11-02', startTime: '10:40', status: 'rescheduled' } })
    expect(day(state, 48, WONGSAKUL, '2026-10-29').slots.find((s) => s.startTime === '11:20').state).toBe('free')
    expect(day(state, 48, WONGSAKUL, '2026-11-02').slots.find((s) => s.startTime === '10:40').state).toBe('booked')
  })

  it('creates a booking once per idempotency key and rejects a taken slot with alternatives', () => {
    const state = fresh()
    const body = { providerId: 48, specialistId: WONGSAKUL, date: '2026-11-30', startTime: '10:00', numberOfPeople: 2, idempotencyKey: 'k1' }
    const first = lib.createBooking(state, body, { now: NOW })
    expect(first).toMatchObject({ status: 201, body: { startTimes: ['10:00', '10:40'] } })
    expect(lib.createBooking(state, body, { now: NOW })).toEqual(first) // replay: same booking
    const taken = lib.createBooking(state, { ...body, idempotencyKey: 'k2', numberOfPeople: 1 }, { now: NOW })
    expect(taken).toMatchObject({ status: 409, body: { code: 'slot-taken' } })
    expect(taken.body.alternatives).toContain('11:20')
    expect(taken.body.alternatives).not.toContain('10:40')
  })
})

describe('buildCalendar', () => {
  it('covers 90 days from the provider’s today with a reason for every unavailable day', () => {
    const cal = lib.buildCalendar(fresh(), 48, RANA, 1, { now: NOW })
    expect(cal.days).toHaveLength(90)
    expect(cal.days[0].date).toBe('2026-10-26')
    const byDate = Object.fromEntries(cal.days.map((d) => [d.date, d]))
    expect(byDate['2026-10-30'].status).toBe('no-overlap') // Friday
    expect(byDate['2026-11-01'].status).toBe('weekly-closed') // Sunday
    expect(byDate['2026-10-27']).toMatchObject({ status: 'available' })
    for (const d of cal.days) if (d.status !== 'available') expect(d.message).toBeTruthy()
  })
  it('rolls the window over at the provider’s midnight while the mock keeps running', () => {
    const state = fresh() // started Mon 26 Oct, 10:00 Bangkok
    const nextDay = Date.UTC(2026, 9, 26, 17, 30) // Tue 27 Oct, 00:30 Bangkok (still Mon 23:15 in Kathmandu)
    const cal = lib.buildCalendar(state, 48, WONGSAKUL, 1, { now: nextDay })
    expect(cal.today).toBe('2026-10-27')
    expect(cal.days[0].date).toBe('2026-10-27')
    expect(cal.days.at(-1).date).toBe('2027-01-24') // still 90 bookable days, not 89
    expect(lib.buildDay(state, 48, WONGSAKUL, '2027-01-24', 1, { now: nextDay }).status).not.toBe('outside-window')
    expect(lib.buildDay(state, 48, WONGSAKUL, '2026-10-26', 1, { now: nextDay }).status).toBe('past')
    // Each provider has its own "today": Kathmandu has not reached midnight yet.
    expect(lib.buildCalendar(state, 46, lib.findProvider(state, 46).specialists[0].id, 1, { now: nextDay }).today).toBe('2026-10-26')
    expect(lib.describeProvider(lib.findProvider(state, 48), nextDay).today).toBe('2026-10-27')
  })
})

describe('takeSlot (fault injection: someone else books first)', () => {
  it('turns the next booking for that time into a real 409 with alternatives', () => {
    const state = fresh()
    const body = { providerId: 48, specialistId: WONGSAKUL, date: '2026-11-30', startTime: '10:40', idempotencyKey: 'k' }
    lib.takeSlot(state, body)
    const result = lib.createBooking(state, body, { now: NOW })
    expect(result).toMatchObject({ status: 409, body: { code: 'slot-taken' } })
    expect(result.body.alternatives.slice(0, 2)).toEqual(['10:00', '11:20'])
  })

  it('uses the booking’s own provider and specialist for a reschedule and never steals its own time', () => {
    const state = fresh()
    lib.takeSlot(state, { date: '2026-11-02', startTime: '10:40' }, EXISTING)
    expect(lib.rescheduleBooking(state, EXISTING, { date: '2026-11-02', startTime: '10:40' }, { now: NOW }).status).toBe(409)
    lib.takeSlot(state, { date: '2026-10-29', startTime: '11:20' }, EXISTING)
    expect(lib.rescheduleBooking(state, EXISTING, { date: '2026-11-03', startTime: '10:00' }, { now: NOW }).status).toBe(200)
  })
})
