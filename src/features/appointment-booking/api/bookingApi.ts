// Task 3 data access against mock-api (/api/booking/*, /api/bookings).
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'
import { bookingSchema, calendarSchema, daySchema, providerSchema, type Booking } from './schemas'

export async function fetchProviders(signal?: AbortSignal) {
  return z.object({ providers: z.array(providerSchema) }).parse(await apiRequest<unknown>('/api/booking/providers', { signal }))
    .providers
}

export async function fetchProvider(providerId: number, signal?: AbortSignal) {
  return z.object({ provider: providerSchema }).parse(await apiRequest<unknown>(`/api/booking/providers/${providerId}`, { signal }))
    .provider
}

type AvailabilityQuery = { providerId: number; specialistId: string; people: number; excludeBookingId?: string }

export async function fetchCalendar({ providerId, specialistId, people, excludeBookingId }: AvailabilityQuery, signal?: AbortSignal) {
  return calendarSchema.parse(
    await apiRequest<unknown>(`/api/booking/providers/${providerId}/calendar`, {
      query: { specialistId, people, excludeBookingId },
      signal,
    }),
  )
}

export async function fetchDay(
  { providerId, specialistId, people, excludeBookingId, date }: AvailabilityQuery & { date: string },
  signal?: AbortSignal,
) {
  return daySchema.parse(
    await apiRequest<unknown>(`/api/booking/providers/${providerId}/slots`, {
      query: { specialistId, people, date, excludeBookingId },
      signal,
    }),
  )
}

export async function fetchBooking(bookingId: string, signal?: AbortSignal): Promise<Booking> {
  // 'existing' is the fixture's existing booking (see mock-api/server.cjs).
  const body = await apiRequest<unknown>(`/api/bookings/${encodeURIComponent(bookingId)}`, { signal })
  return z.object({ booking: bookingSchema }).parse(body).booking
}

type BookingRequest = {
  providerId: number
  specialistId: string
  date: string
  startTime: string
  numberOfPeople: number
  idempotencyKey: string
}

export async function createBooking(request: BookingRequest): Promise<Booking> {
  return bookingSchema.parse(await apiRequest<unknown>('/api/bookings', { method: 'POST', body: request }))
}

export async function rescheduleBooking(
  bookingId: string,
  request: { date: string; startTime: string; idempotencyKey: string },
): Promise<Booking> {
  return bookingSchema.parse(
    await apiRequest<unknown>(`/api/bookings/${encodeURIComponent(bookingId)}`, { method: 'PUT', body: request }),
  )
}
