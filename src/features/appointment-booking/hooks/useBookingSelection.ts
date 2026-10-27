import { useSearchParams } from 'react-router'
import { canonicalZone, detectCustomerZone, isValidZone } from '../domain/time'

type BookingSelection = {
  specialistId: string
  date: string
  people: number
  time: string
  /** Customer zone override for demos (`?tz=Asia/Kathmandu`); empty = detected. */
  tzOverride: string
}

const URL_KEYS: Record<keyof BookingSelection, string> = {
  specialistId: 'specialist',
  date: 'date',
  people: 'people',
  time: 'time',
  tzOverride: 'tz',
}

function readSelection(params: URLSearchParams): BookingSelection {
  const date = params.get('date') ?? ''
  const time = params.get('time') ?? ''
  const people = Number(params.get('people'))
  const tz = params.get('tz') ?? ''
  return {
    specialistId: params.get('specialist') ?? '',
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    people: Number.isInteger(people) && people >= 1 && people <= 4 ? people : 1,
    time: /^\d{2}:\d{2}$/.test(time) ? time : '',
    tzOverride: tz && isValidZone(tz) ? canonicalZone(tz) : '',
  }
}

/**
 * Selections live in the URL so a retry, a 409 or a reload never loses them.
 * Changes replace the history entry (picking a slot is not a navigation step).
 */
export function useBookingSelection() {
  const [params, setParams] = useSearchParams()
  const selection = readSelection(params)
  const detectedZone = detectCustomerZone()

  const update = (patch: Partial<BookingSelection>) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        for (const [field, value] of Object.entries(patch)) {
          const key = URL_KEYS[field as keyof BookingSelection]
          // Defaults (empty, 1 person) are left out of the URL.
          if (value === '' || (key === 'people' && value === 1)) next.delete(key)
          else next.set(key, String(value))
        }
        return next
      },
      { replace: true },
    )

  return { selection, update, customerZone: selection.tzOverride || detectedZone, detectedZone }
}
