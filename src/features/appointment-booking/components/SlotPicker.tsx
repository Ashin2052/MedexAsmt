import { Moon, Sun, Sunrise } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { Slot } from '../api/schemas'
import { customerDayShift, dayPeriod, dayShiftLabel, formatClock, zoneCity, type DayPeriod } from '../domain/time'

type SlotPickerProps = {
  date: string
  slots: Slot[]
  selected: string
  providerZone: string
  customerZone: string
  people: number
  disabled?: boolean
  onSelect: (startTime: string) => void
}

const PERIODS: { key: DayPeriod; label: string; icon: typeof Sun }[] = [
  { key: 'morning', label: 'Morning', icon: Sunrise },
  { key: 'afternoon', label: 'Afternoon', icon: Sun },
  { key: 'evening', label: 'Evening', icon: Moon },
]

const STATE_TEXT: Record<Exclude<Slot['state'], 'free'>, string> = {
  booked: 'Booked',
  past: 'Already started',
  insufficient: 'Not enough free times in a row',
}

/**
 * Slots as one native radio group: arrow keys move between selectable times
 * (booked / past times are visible but disabled, so they are skipped), and
 * each option names both clocks.
 */
export function SlotPicker({ date, slots, selected, providerZone, customerZone, people, disabled, onSelect }: SlotPickerProps) {
  const name = useId()
  const sameZone = providerZone === customerZone
  const providerCity = zoneCity(providerZone)
  const customerCity = zoneCity(customerZone)

  return (
    <div className="grid gap-5">
      {PERIODS.map(({ key, label, icon: Icon }) => {
        const inPeriod = slots.filter((s) => dayPeriod(s.startTime) === key)
        if (inPeriod.length === 0) return null
        return (
          <fieldset key={key} disabled={disabled}>
            <legend className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Icon aria-hidden="true" className="size-4 text-primary" />
              {label}
              <span className="font-normal text-muted-foreground">({providerCity} time)</span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {inPeriod.map((slot) => {
                const selectable = slot.state === 'free' && !slot.isCurrentBooking
                const yourTime = formatClock(slot.startUtc, customerZone)
                const shift = dayShiftLabel(customerDayShift(slot.startUtc, date, customerZone))
                const status = slot.isCurrentBooking ? 'Your current time' : slot.state === 'free' ? '' : STATE_TEXT[slot.state]
                const accessible = [
                  `${slot.startTime} to ${slot.endTime} ${providerCity} time`,
                  sameZone ? '' : `${yourTime} your time${shift ? `, ${shift}` : ''}`,
                  people > 1 && selectable ? `for ${people} people back to back` : '',
                  status,
                ]
                  .filter(Boolean)
                  .join(', ')
                return (
                  <label
                    key={slot.startTime}
                    className={cn(
                      'relative flex flex-col rounded-md border px-3 py-2 text-left transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring',
                      selectable && 'cursor-pointer bg-card hover:border-primary/50',
                      selectable && selected === slot.startTime && 'border-primary bg-primary text-primary-foreground hover:border-primary',
                      !selectable && 'cursor-not-allowed bg-muted text-muted-foreground',
                      slot.isCurrentBooking && 'border-dashed border-primary/50',
                    )}
                  >
                    <input
                      type="radio"
                      name={name}
                      value={slot.startTime}
                      checked={selected === slot.startTime}
                      disabled={!selectable}
                      onChange={() => onSelect(slot.startTime)}
                      aria-label={accessible}
                      className="sr-only"
                    />
                    <span className={cn('text-base font-semibold tabular-nums', !selectable && 'line-through decoration-1')}>
                      {slot.startTime}
                    </span>
                    {!sameZone && (
                      <span className={cn('text-xs tabular-nums', selected === slot.startTime && selectable ? 'text-primary-foreground/85' : 'text-muted-foreground')}>
                        {yourTime} your time{shift ? ` (${shift})` : ''}
                      </span>
                    )}
                    {status && <span className="text-xs font-medium">{status}</span>}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
      <p className="sr-only" aria-live="polite">
        {slots.filter((s) => s.state === 'free' && !s.isCurrentBooking).length} times available on this day.
      </p>
      {!sameZone && <p className="text-xs text-muted-foreground">Big numbers: {providerCity} time (where your appointment is). Small: your time in {customerCity}.</p>}
    </div>
  )
}
