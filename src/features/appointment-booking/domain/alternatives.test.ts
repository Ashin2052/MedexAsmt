import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { Slot } from '../api/schemas'
import { nearestAlternatives } from './alternatives'
import { classifySubmitError } from './submit'

const slot = (startTime: string, state: Slot['state'] = 'free', isCurrentBooking = false): Slot => ({
  startTime,
  endTime: startTime,
  startUtc: '2026-10-29T00:00:00.000Z',
  endUtc: '2026-10-29T00:00:00.000Z',
  state,
  isCurrentBooking,
  groupTimes: [startTime],
})

describe('nearestAlternatives after a 409', () => {
  const day = [
    slot('10:00'),
    slot('10:40'),
    slot('11:20', 'booked'),
    slot('12:00'), // the taken time (still "free" in a stale response)
    slot('12:40'),
    slot('13:20', 'past'),
    slot('14:00', 'free', true),
    slot('14:40'),
  ]

  it('orders free times by distance from the taken one, earlier first on a tie', () => {
    expect(nearestAlternatives(day, '12:00').map((s) => s.startTime)).toEqual(['12:40', '10:40', '10:00'])
  })

  it('never offers the taken, booked, past or current-booking times', () => {
    const offered = nearestAlternatives(day, '12:00', 10).map((s) => s.startTime)
    expect(offered).toEqual(['12:40', '10:40', '10:00', '14:40'])
  })

  it('breaks exact ties in favour of the earlier time', () => {
    expect(nearestAlternatives([slot('11:00'), slot('13:00')], '12:00').map((s) => s.startTime)).toEqual(['11:00', '13:00'])
  })
})

describe('classifySubmitError', () => {
  it('keeps the selection on a 409 and carries server alternatives', () => {
    const error = new ApiError('taken', 'http', 409, { message: 'taken', code: 'slot-taken', alternatives: ['12:40'] })
    expect(classifySubmitError(error, '12:00')).toMatchObject({ status: 'conflict', takenTime: '12:00', serverAlternatives: ['12:40'] })
  })

  it('treats network and gateway failures as unknown, 5xx as retryable', () => {
    expect(classifySubmitError(new ApiError('x', 'network'), '12:00').status).toBe('unknown')
    expect(classifySubmitError(new ApiError('', 'http', 502), '12:00').status).toBe('unknown')
    expect(classifySubmitError(new ApiError('x', 'http', 500), '12:00')).toMatchObject({ status: 'failed', retryable: true })
    expect(classifySubmitError(new ApiError('Bookings are for 1 to 4 people.', 'http', 422), '12:00')).toMatchObject({
      status: 'failed',
      retryable: false,
      message: 'Bookings are for 1 to 4 people.',
    })
  })
})
