import { ArrowLeft, CalendarX2, Info, Loader2 } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { describeApiError } from '@/shared/api/client'
import { useDelayedFlag } from '@/shared/lib/useDelayedFlag'
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { NativeSelect } from '@/shared/ui/NativeSelect'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { PageContainer } from '@/shared/ui/PageContainer'
import { RefreshButton } from '@/shared/ui/RefreshButton'
import type { CalendarDay, DayAvailability, Provider } from '../api/schemas'
import { nearestAlternatives } from '../domain/alternatives'
import { nextAvailableDay } from '../domain/calendar'
import { formatDate, weekdayName } from '../domain/time'
import { useBooking, useCalendar, useDay, useProvider } from '../hooks/useBookingData'
import { useBookingSelection } from '../hooks/useBookingSelection'
import { useBookingSubmit } from '../hooks/useBookingSubmit'
import { BookingSummary } from './BookingSummary'
import { CalendarGrid } from './CalendarGrid'
import { SlotPicker } from './SlotPicker'
import { SpecialistPicker } from './SpecialistPicker'
import { TimezoneBar } from './TimezoneBar'

/** Explain why the specialist's advertised hours are not all bookable on this day. */
function WindowNote({ day, provider, specialistName }: { day: DayAvailability; provider: Provider; specialistName: string }) {
  const { consultation, opening, bookable } = day.window
  if (!opening || !bookable) return null
  // Only when the specialist's advertised hours actually extend past opening hours.
  if (consultation.start >= opening.start && consultation.end <= opening.end) return null
  const weekday = weekdayName(day.date)
  return (
    <p className="flex items-start gap-2 rounded-md border-l-4 border-brand-teal bg-surface px-3 py-2 text-sm text-muted-foreground">
      <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-teal" />
      <span>
        {specialistName} consults {consultation.start}–{consultation.end}, but {provider.name} is open {opening.start}–{opening.end} on{' '}
        {weekday}s, so only appointments between {bookable.start} and {bookable.end} can be booked.
      </span>
    </p>
  )
}

function SectionSkeleton({ label, className }: { label: string; className: string }) {
  return (
    <div role="status" className={className}>
      <span className="sr-only">{label}</span>
      <Skeleton className="size-full" />
    </div>
  )
}

/** Book a new appointment (/booking/:providerId) or reschedule one (/booking/reschedule/:bookingId). */
export function BookingPage() {
  const params = useParams()
  const rescheduleId = params.bookingId ?? null
  const existing = useBooking(rescheduleId)
  const providerId = rescheduleId ? (existing.data?.providerId ?? null) : Number(params.providerId)
  const providerQuery = useProvider(Number.isInteger(providerId) ? providerId : null)
  const provider = providerQuery.data

  const { selection, update, customerZone, detectedZone } = useBookingSelection()
  const submit = useBookingSubmit()
  const online = useOnlineStatus()
  const [dayNotice, setDayNotice] = useState<CalendarDay | null>(null)
  const peopleId = useId()

  const current = existing.data ?? null
  // Rescheduling keeps the specialist and party size of the existing booking.
  const specialistId = current?.specialistId ?? (selection.specialistId || provider?.specialists[0]?.id || '')
  const people = current?.numberOfPeople ?? selection.people
  const specialist = provider?.specialists.find((s) => s.id === specialistId)

  const availability = provider && specialistId ? { providerId: provider.id, specialistId, people, excludeBookingId: rescheduleId ?? undefined } : null
  const calendar = useCalendar(availability)
  const days = calendar.data?.days ?? []
  const firstAvailable = nextAvailableDay(days)
  const date = selection.date || current?.date || firstAvailable?.date || ''
  const day = useDay(availability && date ? { ...availability, date } : null)
  const slots = useMemo(() => day.data?.slots ?? [], [day.data])
  const selectedSlot = slots.find((s) => s.startTime === selection.time && s.state === 'free' && !s.isCurrentBooking)

  const locked = submit.state.status === 'submitting' || submit.state.status === 'unknown'
  const slowCalendar = useDelayedFlag(calendar.isFetching)
  const slowDay = useDelayedFlag(day.isFetching)

  const alternatives = useMemo(
    () => (submit.state.status === 'conflict' ? nearestAlternatives(slots, submit.state.takenTime) : []),
    [slots, submit.state],
  )

  const change = (patch: Parameters<typeof update>[0]) => {
    if (locked) return
    if (submit.state.status !== 'idle') submit.reset()
    setDayNotice(null)
    update(patch)
  }

  const confirm = () => {
    if (!provider || !specialist || !selectedSlot) return
    if (rescheduleId) void submit.send({ kind: 'reschedule', bookingId: rescheduleId, date, startTime: selectedSlot.startTime })
    else void submit.send({ kind: 'book', providerId: provider.id, specialistId: specialist.id, date, startTime: selectedSlot.startTime, people })
  }

  const pageError = existing.error ?? providerQuery.error
  if (pageError) {
    return (
      <PageContainer className="py-10">
        <ErrorState
          title="We couldn't load this booking page"
          message={describeApiError(pageError)}
          onRetry={() => {
            void existing.refetch()
            void providerQuery.refetch()
          }}
        />
      </PageContainer>
    )
  }

  return (
    <>
      <section className="border-b bg-surface">
        <PageContainer className="py-8">
          <Button asChild variant="link" className="h-auto p-0">
            <Link to="/booking">
              <ArrowLeft aria-hidden="true" /> All providers
            </Link>
          </Button>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            {rescheduleId ? 'Reschedule your appointment' : provider ? `Book at ${provider.name}` : 'Book an appointment'}
          </h1>
          {rescheduleId && current && (
            <p className="mt-1 text-muted-foreground">
              Booking <span className="font-mono text-sm">{current.bookingId}</span> · pick a new date and time below.
            </p>
          )}
        </PageContainer>
      </section>

      <PageContainer className="grid gap-6 py-6 sm:py-8">
        <OfflineBanner detail="You can look at times, but booking is paused until you're back online." />
        {!provider ? (
          <SectionSkeleton label="Loading provider…" className="h-40" />
        ) : (
          <>
            <TimezoneBar
              provider={provider}
              customerZone={customerZone}
              detectedZone={detectedZone}
              onCustomerZoneChange={(zone) => update({ tzOverride: zone })}
            />

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-6">
                {!rescheduleId && (
                  <section aria-label="Specialist and party size" className="grid gap-4 rounded-lg border bg-card p-4 shadow-card sm:p-5">
                    <SpecialistPicker
                      specialists={provider.specialists}
                      value={specialistId}
                      disabled={locked}
                      onChange={(id) => change({ specialistId: id, time: '' })}
                    />
                    <div className="grid max-w-xs gap-1">
                      <Label htmlFor={peopleId}>Number of people</Label>
                      <NativeSelect
                        id={peopleId}
                        value={people}
                        disabled={locked}
                        onChange={(e) => change({ people: Number(e.target.value), time: '' })}
                      >
                        {[1, 2, 3, 4].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'person' : 'people'}
                          </option>
                        ))}
                      </NativeSelect>
                      {people > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {people} appointments back to back with the same specialist. Only start times with {people} free times in a row are offered.
                        </p>
                      )}
                    </div>
                  </section>
                )}

                <section aria-labelledby="date-heading" className="grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 id="date-heading" className="text-lg font-semibold">
                      1. Choose a date <span className="text-sm font-normal text-muted-foreground">(next 90 days, {provider.name} calendar)</span>
                    </h2>
                    {/* Re-fetches availability for the current specialist, party size and date. */}
                    <RefreshButton queryKey={['booking']} />
                  </div>
                  {calendar.isError ? (
                    <ErrorState title="Couldn't load available dates" message={describeApiError(calendar.error)} onRetry={() => void calendar.refetch()} />
                  ) : !calendar.data ? (
                    <SectionSkeleton label="Loading calendar…" className="aspect-[7/6] max-h-96" />
                  ) : (
                    <>
                      {slowCalendar && <p className="text-sm text-muted-foreground">Still loading the calendar…</p>}
                      <CalendarGrid
                        days={days}
                        selected={date}
                        onSelect={(d) => change({ date: d, time: '' })}
                        onUnavailable={(d) => setDayNotice(d)}
                      />
                      <p aria-live="polite" className="min-h-5 text-sm text-muted-foreground">
                        {dayNotice ? `${formatDate(dayNotice.date, 'long')}: ${dayNotice.message}` : ''}
                      </p>
                      {!firstAvailable && specialist && (
                        <EmptyState
                          icon={CalendarX2}
                          title={`No free times with ${specialist.name} in the next 90 days`}
                          description={people > 1 ? 'Try fewer people, or another specialist.' : 'Try another specialist.'}
                        />
                      )}
                    </>
                  )}
                </section>

                {date && (
                  <section aria-labelledby="time-heading" className="grid gap-3">
                    <h2 id="time-heading" className="text-lg font-semibold">
                      2. Choose a time on {formatDate(date, 'long')}
                    </h2>
                    {day.isError ? (
                      <ErrorState title="Couldn't load times" message={describeApiError(day.error)} onRetry={() => void day.refetch()} />
                    ) : !day.data ? (
                      <SectionSkeleton label="Loading times…" className="h-48" />
                    ) : (
                      <div className="grid gap-3 rounded-lg border bg-card p-4 shadow-card sm:p-5" aria-busy={day.isFetching}>
                        {slowDay && (
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 aria-hidden="true" className="size-4 motion-safe:animate-spin" /> Updating times…
                          </p>
                        )}
                        {specialist && <WindowNote day={day.data} provider={provider} specialistName={specialist.name} />}
                        {day.data.status === 'available' || day.data.slots.length > 0 ? (
                          <SlotPicker
                            date={date}
                            slots={day.data.slots}
                            selected={selection.time}
                            providerZone={provider.timezone.zone}
                            customerZone={customerZone}
                            people={people}
                            disabled={locked}
                            onSelect={(time) => change({ time })}
                          />
                        ) : null}
                        {day.data.status !== 'available' && (
                          <div className="rounded-md bg-surface p-3 text-sm">
                            <p className="font-medium">{day.data.message}</p>
                            {firstAvailable && firstAvailable.date !== date && (
                              <Button variant="link" className="h-auto p-0" onClick={() => change({ date: firstAvailable.date, time: '' })}>
                                Go to the next available day: {formatDate(firstAvailable.date)}
                              </Button>
                            )}
                            {!rescheduleId && provider.specialists.length > 1 && <p className="text-muted-foreground">Or choose another specialist above.</p>}
                          </div>
                        )}
                      </div>
                    )}
                  </section>
                )}
              </div>

              <BookingSummary
                provider={provider}
                specialist={specialist}
                people={people}
                slot={selectedSlot}
                date={date}
                customerZone={customerZone}
                current={current}
                submit={submit.state}
                offline={!online}
                alternatives={alternatives}
                nextAvailableDate={nextAvailableDay(days, date)?.date ?? null}
                onConfirm={confirm}
                onReplay={submit.replay}
                onPickAlternative={(time) => change({ time })}
                onGoToDate={(d) => change({ date: d, time: '' })}
              />
            </div>
          </>
        )}
      </PageContainer>
    </>
  )
}
