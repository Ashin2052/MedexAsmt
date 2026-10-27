import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchBooking, fetchCalendar, fetchDay, fetchProvider, fetchProviders } from '../api/bookingApi'

export function useProviders() {
  return useQuery({ queryKey: ['booking', 'providers'], queryFn: ({ signal }) => fetchProviders(signal), retry: false })
}

export function useProvider(providerId: number | null) {
  return useQuery({
    queryKey: ['booking', 'provider', providerId],
    queryFn: ({ signal }) => fetchProvider(providerId as number, signal),
    enabled: providerId !== null,
    retry: false,
  })
}

export function useBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking', 'booking', bookingId],
    queryFn: ({ signal }) => fetchBooking(bookingId as string, signal),
    enabled: bookingId !== null,
    retry: false,
  })
}

type Availability = { providerId: number; specialistId: string; people: number; excludeBookingId?: string }

export function useCalendar(query: Availability | null) {
  return useQuery({
    queryKey: ['booking', 'calendar', query],
    queryFn: ({ signal }) => fetchCalendar(query as Availability, signal),
    enabled: query !== null && query.specialistId !== '',
    placeholderData: keepPreviousData,
    retry: false,
  })
}

export function useDay(query: (Availability & { date: string }) | null) {
  return useQuery({
    queryKey: ['booking', 'day', query],
    queryFn: ({ signal }) => fetchDay(query as Availability & { date: string }, signal),
    enabled: query !== null && query.specialistId !== '' && query.date !== '',
    retry: false,
  })
}
