// Boundary validation for the booking API (mock-api/lib/booking.cjs).
import { z } from 'zod'

const clock = z.string().regex(/^\d{2}:\d{2}$/)
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

const specialistSchema = z.object({
  id: z.string(),
  name: z.string(),
  speciality: z.string().catch(''),
  consultation: z.object({
    startTime: clock,
    endTime: clock,
    durationInMinutes: z.number(),
    bufferInMinutes: z.number().catch(0),
  }),
})

export const providerSchema = z.object({
  id: z.number(),
  name: z.string(),
  country: z.string(),
  timezone: z.object({
    raw: z.string(),
    zone: z.string(),
    source: z.enum(['iana', 'alias', 'windows', 'offset', 'country-fallback']),
    note: z.string().nullable(),
  }),
  today: isoDate,
  daySchedules: z.record(z.string(), z.object({ startTime: clock, endTime: clock })),
  specialists: z.array(specialistSchema),
})

const dayStatusSchema = z.enum([
  'available',
  'past',
  'outside-window',
  'closure',
  'weekly-closed',
  'no-overlap',
  'fully-booked',
  'invalid',
  'not-found',
])

export const calendarSchema = z.object({
  providerId: z.number(),
  timezone: z.string(),
  today: isoDate,
  days: z.array(z.object({ date: isoDate, status: dayStatusSchema, message: z.string().nullable(), freeCount: z.number() })),
})

const slotSchema = z.object({
  startTime: clock,
  endTime: clock,
  startUtc: z.string(),
  endUtc: z.string(),
  state: z.enum(['free', 'booked', 'past', 'insufficient']),
  isCurrentBooking: z.boolean(),
  groupTimes: z.array(clock),
})

const windowRange = z.object({ start: clock, end: clock })

export const daySchema = z.object({
  date: isoDate,
  status: dayStatusSchema,
  message: z.string().nullable(),
  timezone: z.string(),
  window: z.object({ consultation: windowRange, opening: windowRange.nullable(), bookable: windowRange.nullable() }),
  slots: z.array(slotSchema),
})

export const bookingSchema = z.object({
  bookingId: z.string(),
  providerId: z.number(),
  specialistId: z.string(),
  date: isoDate,
  startTime: clock,
  startTimes: z.array(clock),
  numberOfPeople: z.number(),
  timezone: z.string(),
  startUtc: z.string(),
})

export const conflictSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
  alternatives: z.array(clock).catch([]),
})

export type Provider = z.infer<typeof providerSchema>
export type Specialist = z.infer<typeof specialistSchema>
export type Calendar = z.infer<typeof calendarSchema>
export type CalendarDay = Calendar['days'][number]
export type DayStatus = z.infer<typeof dayStatusSchema>
export type DayAvailability = z.infer<typeof daySchema>
export type Slot = z.infer<typeof slotSchema>
export type Booking = z.infer<typeof bookingSchema>
