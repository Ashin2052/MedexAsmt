import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { createBooking, rescheduleBooking } from '../api/bookingApi'
import { classifySubmitError, type SubmitState } from '../domain/submit'

type SubmitRequest =
  | { kind: 'book'; providerId: number; specialistId: string; date: string; startTime: string; people: number }
  | { kind: 'reschedule'; bookingId: string; date: string; startTime: string }

type Attempt = { scope: string; request: SubmitRequest; key: string }

export const BOOKING_ATTEMPT_KEY = 'medex.bookingAttempt.v1'

function loadAttempt(): Attempt | null {
  try {
    const raw = localStorage.getItem(BOOKING_ATTEMPT_KEY)
    return raw ? (JSON.parse(raw) as Attempt) : null
  } catch {
    return null
  }
}

function saveAttempt(attempt: Attempt | null) {
  try {
    if (attempt) localStorage.setItem(BOOKING_ATTEMPT_KEY, JSON.stringify(attempt))
    else localStorage.removeItem(BOOKING_ATTEMPT_KEY)
  } catch {
    // Storage unavailable: "Check again" still works until the page reloads.
  }
}

/**
 * One booking attempt at a time. `send` starts a new attempt with a new
 * idempotency key; `replay` ("Check again" / "Try again") resends the last
 * attempt with the SAME key, so it can never create a second booking.
 *
 * The attempt is saved before the request is sent and kept while its outcome
 * is unknown. If the page reloads mid-request, the same page (`scope`) replays
 * it with the same key on mount and shows the true result.
 */
export function useBookingSubmit(scope: string) {
  const queryClient = useQueryClient()
  // An attempt from this page that a reload interrupted: the page starts out "submitting" it.
  const [resumable] = useState(() => {
    const saved = loadAttempt()
    return saved?.scope === scope ? saved : null
  })
  const [state, setState] = useState<SubmitState>({ status: resumable ? 'submitting' : 'idle' })
  // Request bookkeeping that must not trigger renders.
  const lastAttempt = useRef<Attempt | null>(null)
  const inFlight = useRef(false)

  /** Send an attempt and resolve with its outcome (null if another attempt is in flight). */
  async function run(attempt: Attempt): Promise<SubmitState | null> {
    if (inFlight.current) return null
    lastAttempt.current = attempt
    saveAttempt(attempt)
    inFlight.current = true
    const { request, key } = attempt
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
      saveAttempt(null)
      return { status: 'confirmed', booking }
    } catch (error) {
      const next = classifySubmitError(error, request.startTime)
      // Only an unknown outcome may have created a booking; anything else is settled.
      if (next.status !== 'unknown') saveAttempt(null)
      return next
    } finally {
      inFlight.current = false
      // Availability changed either way (booked, or someone else took the slot).
      void queryClient.invalidateQueries({ queryKey: ['booking'] })
    }
  }

  const apply = (next: SubmitState | null) => {
    if (next) setState(next)
  }

  function submit(attempt: Attempt) {
    if (inFlight.current) return
    setState({ status: 'submitting' })
    void run(attempt).then(apply)
  }

  // After a reload: finish the interrupted attempt with its saved key.
  const resume = useEffectEvent(() => (resumable ? run(resumable) : Promise.resolve(null)))
  useEffect(() => {
    void resume().then(apply)
  }, [])

  return {
    state,
    send: (request: SubmitRequest) => submit({ scope, request, key: crypto.randomUUID() }),
    replay: () => {
      if (lastAttempt.current) submit(lastAttempt.current)
    },
    reset: () => setState({ status: 'idle' }),
  }
}
