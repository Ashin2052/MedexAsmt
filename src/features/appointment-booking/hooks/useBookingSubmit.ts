import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { createBooking, rescheduleBooking } from '../api/bookingApi'
import { classifySubmitError, type SubmitState } from '../domain/submit'

type SubmitRequest =
  | { kind: 'book'; providerId: number; specialistId: string; date: string; startTime: string; people: number }
  | { kind: 'reschedule'; bookingId: string; date: string; startTime: string }

/**
 * One booking attempt at a time. `send` starts a new attempt with a new
 * idempotency key; `replay` ("Check again" / "Try again") resends the last
 * attempt with the SAME key, so it can never create a second booking.
 */
export function useBookingSubmit() {
  const queryClient = useQueryClient()
  const [state, setState] = useState<SubmitState>({ status: 'idle' })
  // Request bookkeeping that must not trigger renders.
  const lastAttempt = useRef<{ request: SubmitRequest; key: string } | null>(null)
  const inFlight = useRef(false)

  async function submit(request: SubmitRequest, key: string) {
    if (inFlight.current) return
    lastAttempt.current = { request, key }
    inFlight.current = true
    setState({ status: 'submitting' })
    try {
      const booking =
        request.kind === 'book'
          ? await createBooking({
              providerId: request.providerId,
              specialistId: request.specialistId,
              date: request.date,
              startTime: request.startTime,
              numberOfPeople: request.people,
              idempotencyKey: key,
            })
          : await rescheduleBooking(request.bookingId, { date: request.date, startTime: request.startTime, idempotencyKey: key })
      setState({ status: 'confirmed', booking })
    } catch (error) {
      setState(classifySubmitError(error, request.startTime))
    } finally {
      inFlight.current = false
      // Availability changed either way (booked, or someone else took the slot).
      void queryClient.invalidateQueries({ queryKey: ['booking'] })
    }
  }

  return {
    state,
    send: (request: SubmitRequest) => submit(request, crypto.randomUUID()),
    replay: () => {
      if (lastAttempt.current) void submit(lastAttempt.current.request, lastAttempt.current.key)
    },
    reset: () => setState({ status: 'idle' }),
  }
}
