import { CalendarClock, CalendarDays, Globe2, Stethoscope } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { describeApiError } from '@/shared/api/client'
import { ErrorState } from '@/shared/ui/ErrorState'
import { PageContainer } from '@/shared/ui/PageContainer'
import { RefreshButton } from '@/shared/ui/RefreshButton'
import { formatDate, zoneLabel } from '../domain/time'
import { useBooking, useProviders } from '../hooks/useBookingData'

const COUNTRY_NAMES: Record<string, string> = { TH: 'Thailand', NP: 'Nepal', IN: 'India' }

/** Choose a provider, or reschedule the existing booking. */
export function ProvidersPage() {
  const providers = useProviders()
  const existing = useBooking('existing')
  const existingProvider = providers.data?.find((p) => p.id === existing.data?.providerId)

  return (
    <>
      <section className="border-b bg-surface">
        <PageContainer className="py-8 sm:py-10">
          <h1 className="text-3xl font-bold tracking-tight">Book an appointment</h1>
          <p className="mt-2 text-muted-foreground">Times are always shown in the provider’s time zone, with your own time alongside.</p>
        </PageContainer>
      </section>
      <PageContainer className="grid gap-6 py-6 sm:py-8">
        {existing.data && existingProvider && (
          <section aria-labelledby="existing-title" className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-primary/25 bg-secondary/50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <CalendarClock aria-hidden="true" className="mt-0.5 size-6 text-primary" />
              <div>
                <h2 id="existing-title" className="font-semibold">
                  Your upcoming appointment
                </h2>
                <p className="text-sm text-muted-foreground">
                  {existingProvider.name} · {formatDate(existing.data.date, 'long')} at {existing.data.startTime} (
                  {zoneLabel(existing.data.timezone)})
                </p>
              </div>
            </div>
            <Button asChild variant="outline">
              <Link to={`/booking/reschedule/${existing.data.bookingId}`}>Reschedule</Link>
            </Button>
          </section>
        )}

        <div className="flex justify-end">
          <RefreshButton queryKey={['booking']} />
        </div>

        {providers.isError ? (
          <ErrorState title="We couldn't load providers" message={describeApiError(providers.error)} onRetry={() => void providers.refetch()} />
        ) : !providers.data ? (
          <div role="status" className="grid gap-4 sm:grid-cols-2">
            <span className="sr-only">Loading providers…</span>
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {providers.data.map((provider) => (
              <li key={provider.id} className="flex flex-col rounded-lg border bg-card p-5 shadow-card">
                <h2 className="text-lg font-semibold">{provider.name}</h2>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Globe2 aria-hidden="true" className="size-4" />
                  {COUNTRY_NAMES[provider.country] ?? provider.country} · {zoneLabel(provider.timezone.zone)}
                </p>
                {provider.timezone.source === 'country-fallback' && (
                  <p className="mt-1 text-xs text-warning-foreground">{provider.timezone.note}</p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-sm">
                  <Stethoscope aria-hidden="true" className="size-4 text-primary" />
                  {provider.specialists.map((s) => s.speciality).join(', ')}
                </p>
                <Button asChild className="mt-4 self-start">
                  <Link to={`/booking/${provider.id}`}>
                    <CalendarDays aria-hidden="true" />
                    Book at {provider.name}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </PageContainer>
    </>
  )
}
