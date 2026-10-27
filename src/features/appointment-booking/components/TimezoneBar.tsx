import { Globe2, MapPin } from 'lucide-react'
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { NativeSelect } from '@/shared/ui/NativeSelect'
import type { Provider } from '../api/schemas'
import { COMMON_ZONES, zoneLabel } from '../domain/time'

type TimezoneBarProps = {
  provider: Provider
  customerZone: string
  detectedZone: string
  onCustomerZoneChange: (zone: string) => void
}

/** Makes it unmistakable whose clock each time is on. */
export function TimezoneBar({ provider, customerZone, detectedZone, onCustomerZoneChange }: TimezoneBarProps) {
  const id = useId()
  const zones = [...new Set([detectedZone, ...COMMON_ZONES])]
  const same = customerZone === provider.timezone.zone

  return (
    <section aria-label="Time zones" className="grid gap-3 rounded-lg border bg-card p-4 shadow-card sm:grid-cols-2">
      <div className="flex items-start gap-3">
        <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold">Appointment times are in the provider’s time</p>
          <p className="text-sm text-muted-foreground">
            {provider.name}: <strong className="text-foreground">{zoneLabel(provider.timezone.zone)}</strong> — be there at this time.
          </p>
          {provider.timezone.note && <p className="mt-1 text-xs text-warning-foreground">{provider.timezone.note}</p>}
        </div>
      </div>
      <div className="flex items-start gap-3">
        <Globe2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-teal" />
        <div className="grid flex-1 gap-1">
          <Label htmlFor={`${id}-tz`} className="text-sm font-semibold">
            Your time zone
          </Label>
          <NativeSelect
            id={`${id}-tz`}
            value={customerZone}
            onChange={(e) => onCustomerZoneChange(e.target.value === detectedZone ? '' : e.target.value)}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zoneLabel(zone)}
                {zone === detectedZone ? ' — detected' : ''}
              </option>
            ))}
          </NativeSelect>
          <p className="text-xs text-muted-foreground">
            {same ? 'You are in the same time zone as the provider.' : 'Shown next to each time as “your time”.'}
          </p>
        </div>
      </div>
    </section>
  )
}
