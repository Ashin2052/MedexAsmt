import { Stethoscope } from 'lucide-react'
import { useId } from 'react'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import type { Specialist } from '../api/schemas'

type SpecialistPickerProps = {
  specialists: Specialist[]
  value: string
  disabled?: boolean
  onChange: (id: string) => void
}

export function SpecialistPicker({ specialists, value, disabled, onChange }: SpecialistPickerProps) {
  const id = useId()
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-semibold">Specialist</legend>
      <RadioGroup value={value} onValueChange={onChange} className="grid gap-2 sm:grid-cols-2">
        {specialists.map((s) => (
          <Label
            key={s.id}
            htmlFor={`${id}-${s.id}`}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-md border bg-card p-3 font-normal transition-colors',
              value === s.id ? 'border-primary bg-secondary' : 'hover:border-primary/40',
            )}
          >
            <RadioGroupItem id={`${id}-${s.id}`} value={s.id} className="mt-0.5" />
            <span className="grid gap-0.5">
              <span className="flex items-center gap-1.5 font-semibold">
                <Stethoscope aria-hidden="true" className="size-4 text-primary" />
                {s.name}
              </span>
              <span className="text-sm text-muted-foreground">{s.speciality}</span>
              <span className="text-xs text-muted-foreground">
                Consults {s.consultation.startTime}–{s.consultation.endTime} · {s.consultation.durationInMinutes} min
                {s.consultation.bufferInMinutes ? ` + ${s.consultation.bufferInMinutes} min break` : ''}
              </span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}
