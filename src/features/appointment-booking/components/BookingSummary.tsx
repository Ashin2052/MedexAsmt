import { ArrowDown, CalendarCheck, CircleHelp, Loader2, RotateCw, TriangleAlert, Users, XCircle } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Booking, Provider, Slot, Specialist } from '../api/schemas'
import type { SubmitState } from '../domain/submit'
import { customerDayShift, dayShiftLabel, formatClock, formatDate, zoneCity } from '../domain/time'

type AppointmentTime = { date: string; startTime: string; endTime?: string; startUtc: string; groupTimes?: string[] }

/** One appointment time on both clocks. */
function DualTime({ time, providerZone, customerZone, emphasis = false }: { time: AppointmentTime; providerZone: string; customerZone: string; emphasis?: boolean }) {
  const shift = dayShiftLabel(customerDayShift(time.startUtc, time.date, customerZone))
  return (
    <div>
      <p className={cn('tabular-nums', emphasis ? 'text-lg font-bold' : 'font-semibold')}>
        {formatDate(time.date)}, {time.startTime}
        {time.endTime ? `–${time.endTime}` : ''} <span className="text-sm font-normal text-muted-foreground">{zoneCity(providerZone)} time</span>
      </p>
      {providerZone !== customerZone && (
        <p className="text-sm text-muted-foreground tabular-nums">
          {formatClock(time.startUtc, customerZone)} your time in {zoneCity(customerZone)}
          {shift ? ` (${shift})` : ''}
        </p>
      )}
    </div>
  )
}

function StatusBox({ tone, icon, title, children }: { tone: 'error' | 'warning' | 'success'; icon: ReactNode; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    ref.current?.focus()
  }, [title])
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={tone === 'success' ? 'status' : 'alert'}
      className={cn(
        'rounded-md border p-3 text-sm focus:outline-none focus-visible:outline-2',
        tone === 'error' && 'border-destructive/30 bg-destructive-soft',
        tone === 'warning' && 'border-warning-foreground/30 bg-warning-soft',
        tone === 'success' && 'border-brand-teal/40 bg-success-soft',
      )}
    >
      <p className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  )
}

type BookingSummaryProps = {
  provider: Provider
  specialist: Specialist | undefined
  people: number
  slot: Slot | undefined
  date: string
  customerZone: string
  /** Present when rescheduling. */
  current: Booking | null
  submit: SubmitState
  offline: boolean
  alternatives: Slot[]
  nextAvailableDate: string | null
  onConfirm: () => void
  onReplay: () => void
  onPickAlternative: (time: string) => void
  onGoToDate: (date: string) => void
}

export function BookingSummary(props: BookingSummaryProps) {
  const { provider, specialist, people, slot, date, customerZone, current, submit, offline } = props
  const zone = provider.timezone.zone
  const busy = submit.status === 'submitting'
  const unknown = submit.status === 'unknown'
  const proposed: AppointmentTime | null = slot
    ? { date, startTime: slot.startTime, endTime: slot.endTime, startUtc: slot.startUtc, groupTimes: slot.groupTimes }
    : null

  if (submit.status === 'confirmed') {
    const b = submit.booking
    return (
      <aside aria-labelledby="summary-title" className="rounded-lg border bg-card p-5 shadow-card">
        <h2 id="summary-title" className="sr-only">
          Booking result
        </h2>
        <StatusBox tone="success" icon={<CalendarCheck aria-hidden="true" className="size-4 text-success" />} title={current ? 'Your appointment was moved' : 'You’re booked'}>
          <p>
            Booking <span className="font-mono text-xs">{b.bookingId}</span> with {specialist?.name} at {provider.name}.
          </p>
        </StatusBox>
        <div className="mt-4">
          <DualTime time={{ date: b.date, startTime: b.startTime, startUtc: b.startUtc }} providerZone={zone} customerZone={customerZone} emphasis />
          {b.numberOfPeople > 1 && (
            <p className="mt-1 text-sm text-muted-foreground">
              {b.numberOfPeople} people, one after another: {b.startTimes.join(', ')}
            </p>
          )}
        </div>
      </aside>
    )
  }

  return (
    <aside aria-labelledby="summary-title" className="rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-20">
      <h2 id="summary-title" className="text-lg font-semibold">
        {current ? 'Your change' : 'Your appointment'}
      </h2>
      <dl className="mt-3 grid gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Provider</dt>
          <dd className="font-medium">{provider.name}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Specialist</dt>
          <dd className="font-medium">{specialist ? `${specialist.name} · ${specialist.speciality}` : 'Choose a specialist'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">People</dt>
          <dd className="flex items-center gap-1.5 font-medium">
            <Users aria-hidden="true" className="size-4 text-primary" />
            {people} {people === 1 ? 'person' : 'people'}
          </dd>
        </div>
      </dl>

      {current && (
        <div className="mt-4 rounded-md border border-dashed p-3">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Current appointment</p>
          <div className="line-through decoration-muted-foreground/50">
            <DualTime time={{ date: current.date, startTime: current.startTime, startUtc: current.startUtc }} providerZone={zone} customerZone={customerZone} />
          </div>
        </div>
      )}
      {current && (
        <div className="flex justify-center py-1" aria-hidden="true">
          <ArrowDown className="size-5 text-primary" />
        </div>
      )}
      <div className={cn('rounded-md p-3', current ? 'border-2 border-primary bg-secondary' : 'mt-4 bg-surface')}>
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{current ? 'New appointment' : 'Time'}</p>
        {proposed ? (
          <>
            <DualTime time={proposed} providerZone={zone} customerZone={customerZone} emphasis />
            {people > 1 && proposed.groupTimes && (
              <p className="mt-1 text-sm text-muted-foreground">
                {people} appointments back to back: {proposed.groupTimes.join(', ')}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Choose a date and a time.</p>
        )}
      </div>

      <div className="mt-4 grid gap-3" aria-live="polite">
        {submit.status === 'conflict' && (
          <StatusBox tone="warning" icon={<TriangleAlert aria-hidden="true" className="size-4" />} title={`${submit.takenTime} was just taken`}>
            <p>{submit.message}</p>
            {props.alternatives.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {props.alternatives.map((alt) => (
                  <Button key={alt.startTime} size="sm" variant="outline" onClick={() => props.onPickAlternative(alt.startTime)}>
                    {alt.startTime}
                    {zone !== customerZone && <span className="text-muted-foreground">({formatClock(alt.startUtc, customerZone)} yours)</span>}
                  </Button>
                ))}
              </div>
            ) : (
              <p className="mt-1">No other times left on this day.</p>
            )}
            {props.nextAvailableDate && props.nextAvailableDate !== date && (
              <Button size="sm" variant="link" className="mt-1 h-auto p-0" onClick={() => props.onGoToDate(props.nextAvailableDate as string)}>
                Next available day: {formatDate(props.nextAvailableDate)}
              </Button>
            )}
          </StatusBox>
        )}
        {submit.status === 'failed' && (
          <StatusBox tone="error" icon={<XCircle aria-hidden="true" className="size-4 text-destructive" />} title="Not booked">
            <p>{submit.message}</p>
          </StatusBox>
        )}
        {unknown && (
          <StatusBox tone="warning" icon={<CircleHelp aria-hidden="true" className="size-4" />} title="Checking whether it went through">
            <p>{submit.message}</p>
          </StatusBox>
        )}
        {offline && <p className="text-sm text-muted-foreground">You’re offline. Confirming is paused until you’re back online.</p>}

        {unknown || (submit.status === 'failed' && submit.retryable) ? (
          <Button size="lg" onClick={props.onReplay} disabled={busy || offline}>
            <RotateCw aria-hidden="true" />
            {unknown ? 'Check again' : 'Try again'}
          </Button>
        ) : (
          <Button size="lg" onClick={props.onConfirm} disabled={!proposed || !specialist || busy || offline || submit.status === 'conflict'}>
            {busy && <Loader2 aria-hidden="true" className="motion-safe:animate-spin" />}
            {busy ? 'Confirming…' : current ? 'Move my appointment' : 'Confirm booking'}
          </Button>
        )}
      </div>
    </aside>
  )
}
