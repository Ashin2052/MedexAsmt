// Display-side time helpers. The mock API returns every slot's UTC instant;
// here we only format instants in a zone and describe zones to customers.

/** Legacy names some browsers / ICU builds report → current canonical names. */
const CANONICAL: Record<string, string> = {
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
}

export function canonicalZone(zone: string): string {
  return CANONICAL[zone] ?? zone
}

export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** The customer's zone from the browser, falling back to UTC if it cannot be read. */
export function detectCustomerZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isValidZone(zone) ? canonicalZone(zone) : 'UTC'
  } catch {
    return 'UTC'
  }
}

/** "UTC+5:45" style offset of `zone` at `at`. */
export function zoneOffsetLabel(zone: string, at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value
  if (!part || /^GMT([+-]0(:00)?)?$/.test(part)) return 'UTC'
  return part.replace('GMT', 'UTC')
}

/** "Kathmandu" from "Asia/Kathmandu". */
export function zoneCity(zone: string): string {
  const canonical = canonicalZone(zone)
  if (canonical === 'UTC') return 'UTC'
  return (canonical.split('/').at(-1) ?? canonical).replace(/_/g, ' ')
}

/** "Bangkok (UTC+7)" */
export function zoneLabel(zone: string, at?: Date): string {
  return `${zoneCity(zone)} (${zoneOffsetLabel(zone, at)})`
}

/** "09:25" — 24-hour clock of an instant in a zone. */
export function formatClock(utcIso: string, zone: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(
    new Date(utcIso),
  )
}

/** Calendar date ("YYYY-MM-DD") of an instant in a zone. */
function dateInZone(utcIso: string, zone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(utcIso),
  )
}

/** Day difference between the customer's date and the provider's date for the same instant (-1, 0, +1). */
export function customerDayShift(utcIso: string, providerDate: string, customerZone: string): number {
  const customerDate = dateInZone(utcIso, customerZone)
  return Math.round((Date.parse(`${customerDate}T00:00:00Z`) - Date.parse(`${providerDate}T00:00:00Z`)) / 86400000)
}

export function dayShiftLabel(shift: number): string {
  if (shift === 0) return ''
  if (shift === 1) return 'next day'
  if (shift === -1) return 'previous day'
  return `${shift > 0 ? '+' : ''}${shift} days`
}

/** "Fri 30 Oct" / "Friday 30 October 2026" for a calendar date (no zone shift). */
export function formatDate(date: string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: style === 'long' ? 'long' : 'short',
    day: 'numeric',
    month: style === 'long' ? 'long' : 'short',
    ...(style === 'long' ? { year: 'numeric' } : {}),
  }).format(new Date(`${date}T00:00:00Z`))
}

/** "Sunday" for a calendar date. */
export function weekdayName(date: string): string {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'long' }).format(new Date(`${date}T00:00:00Z`))
}

export type DayPeriod = 'morning' | 'afternoon' | 'evening'

/** Group by the provider's clock: before 12:00, 12:00–16:59, from 17:00. */
export function dayPeriod(startTime: string): DayPeriod {
  const hour = Number(startTime.slice(0, 2))
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** Zones offered in the "view times for…" selector, plus the detected one. */
export const COMMON_ZONES = [
  'Asia/Kathmandu',
  'Asia/Bangkok',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Dubai',
  'Europe/London',
  'America/New_York',
  'Australia/Sydney',
]
