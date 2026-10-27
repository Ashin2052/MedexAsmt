// Booking / reschedule submission states.
//
//  idle ─confirm─► submitting ─201/200─► confirmed
//                      │ 409 ───────────► conflict  (selections kept, alternatives offered, new key next time)
//                      │ 5xx ───────────► failed    (retry with the SAME key)
//                      └ network/502/504 ► unknown  (only "check again" with the SAME key; no second booking)
import { ApiError, isOutcomeUnknown } from '@/shared/api/client'
import type { Booking } from '../api/schemas'
import { conflictSchema } from '../api/schemas'

export type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'confirmed'; booking: Booking }
  | { status: 'conflict'; takenTime: string; message: string; serverAlternatives: string[] }
  | { status: 'failed'; message: string; retryable: boolean }
  | { status: 'unknown'; message: string }

export function classifySubmitError(error: unknown, takenTime: string): SubmitState {
  if (!(error instanceof ApiError) || isOutcomeUnknown(error)) {
    return {
      status: 'unknown',
      message:
        "We lost the connection before we heard back, so we don't know yet whether this was booked. Check again — it won't create a second booking.",
    }
  }
  if (error.status === 409) {
    const parsed = conflictSchema.safeParse({ message: error.message, ...(error.details as object | undefined) })
    return {
      status: 'conflict',
      takenTime,
      message: 'Someone else booked this time just before you. Everything you entered is kept — pick another time below.',
      serverAlternatives: parsed.success ? parsed.data.alternatives : [],
    }
  }
  if (error.status !== null && error.status >= 500) {
    return {
      status: 'failed',
      retryable: true,
      message: "Our server had a problem. Your choices are kept — it's safe to try again.",
    }
  }
  return { status: 'failed', retryable: false, message: error.message }
}
