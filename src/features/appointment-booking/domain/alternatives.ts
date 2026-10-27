// "Someone else got there first": the closest start times to the one the
// customer wanted, so they can pick again without starting over.
import type { Slot } from '../api/schemas'

function toMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

/**
 * Bookable start times on the same day, ordered by distance from the taken
 * time; on a tie, the earlier time first. The taken time is excluded even if a
 * stale response still lists it as free.
 */
export function nearestAlternatives(slots: Slot[], takenTime: string, limit = 3): Slot[] {
  const target = toMinutes(takenTime)
  return slots
    .filter((s) => s.state === 'free' && !s.isCurrentBooking && s.startTime !== takenTime)
    .sort((a, b) => {
      const da = Math.abs(toMinutes(a.startTime) - target)
      const db = Math.abs(toMinutes(b.startTime) - target)
      return da - db || toMinutes(a.startTime) - toMinutes(b.startTime)
    })
    .slice(0, limit)
}
