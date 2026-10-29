import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { CalendarDay } from '../api/schemas'
import { addMonths, DAY_STATUS_LABELS, monthGrid, monthKey, monthTitle, moveDate, type CalendarKey } from '../domain/calendar'
import { formatDate } from '../domain/time'

type CalendarGridProps = {
  days: CalendarDay[]
  selected: string
  onSelect: (date: string) => void
  /** Called when the customer activates an unavailable day (to explain why). */
  onUnavailable: (day: CalendarDay) => void
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const KEYS = new Set<string>(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'])

/**
 * 90-day calendar (WAI-ARIA date grid): one tab stop, arrows move by day /
 * week, Home/End to week start/end, PageUp/PageDown by month, Enter/Space
 * selects. Unavailable days stay focusable so their reason is announced.
 */
export function CalendarGrid({ days, selected, onSelect, onUnavailable }: CalendarGridProps) {
  const first = days[0]?.date ?? ''
  const last = days.at(-1)?.date ?? ''
  const byDate = new Map(days.map((d) => [d.date, d]))
  const [focused, setFocused] = useState(selected || first)
  const [month, setMonth] = useState(monthKey(selected || first))
  const gridRef = useRef<HTMLTableElement>(null)
  const moved = useRef(false)

  // Follow the selection when it changes from outside (e.g. "next available date").
  const [syncedSelected, setSyncedSelected] = useState(selected)
  if (selected !== syncedSelected) {
    setSyncedSelected(selected)
    if (selected) {
      setFocused(selected)
      setMonth(monthKey(selected))
    }
  }

  useEffect(() => {
    if (!moved.current) return
    moved.current = false
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focused}"]`)?.focus()
  }, [focused, month])

  const focusDate = (date: string) => {
    moved.current = true
    setFocused(date)
    setMonth(monthKey(date))
  }

  const activate = (day: CalendarDay) => {
    if (day.status === 'available') onSelect(day.date)
    else onUnavailable(day)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (!KEYS.has(event.key) || !first) return
    event.preventDefault()
    focusDate(moveDate(focused, event.key as CalendarKey, first, last))
  }

  const canPrev = first !== '' && month > monthKey(first)
  const canNext = last !== '' && month < monthKey(last)
  const changeMonth = (delta: number) => {
    const next = addMonths(month, delta)
    setMonth(next)
    const firstInMonth = days.find((d) => monthKey(d.date) === next)
    if (firstInMonth) setFocused(firstInMonth.date)
  }

  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} disabled={!canPrev} aria-label="Previous month">
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h3 id="calendar-month" className="font-semibold" aria-live="polite">
          {monthTitle(month)}
        </h3>
        <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} disabled={!canNext} aria-label="Next month">
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <table ref={gridRef} role="grid" aria-labelledby="calendar-month" className="w-full table-fixed border-collapse" onKeyDown={onKeyDown}>
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col" className="pb-2 text-xs font-medium text-muted-foreground">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthGrid(month).map((week, w) => (
            <tr key={w}>
              {week.map((date, i) => {
                const day = date ? byDate.get(date) : undefined
                if (!date || !day) return <td key={date ?? `empty-${i}`} />
                const isSelected = date === selected
                const available = day.status === 'available'
                const label = `${formatDate(date, 'long')}${date === first ? ', today at the provider' : ''}, ${available ? `available, ${day.freeCount} ${day.freeCount === 1 ? 'time' : 'times'}` : `${DAY_STATUS_LABELS[day.status].toLowerCase()}: ${day.message ?? ''}`}`
                return (
                  <td key={date} role="gridcell" aria-selected={isSelected} className="p-0.5">
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === focused ? 0 : -1}
                      aria-label={label}
                      aria-disabled={!available}
                      title={available ? undefined : day.message ?? undefined}
                      onClick={() => {
                        setFocused(date)
                        activate(day)
                      }}
                      className={cn(
                        'flex h-11 w-full flex-col items-center justify-center rounded-md text-sm tabular-nums transition-colors sm:h-12',
                        available && !isSelected && 'font-semibold text-foreground hover:bg-secondary',
                        available && 'after:mt-0.5 after:size-1 after:rounded-full after:bg-success',
                        !available && 'cursor-not-allowed text-muted-foreground line-through decoration-muted-foreground/60',
                        isSelected && 'bg-primary font-semibold text-primary-foreground after:bg-primary-foreground',
                        date === first && !isSelected && 'ring-1 ring-primary',
                      )}
                    >
                      {Number(date.slice(8))}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-success" /> Has free times
        </span>
        <span className="line-through">12</span> Unavailable (select it to see why)
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-sm ring-1 ring-primary" /> Today at the provider
        </span>
      </p>
    </div>
  )
}
