import { AlertTriangle, Clock, Loader2, Minus, PackageX, Plus, Trash2 } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/shared/lib/money'
import type { CartLineView, WellnessOption } from '../types'

const MAX_QUANTITY = 20

type CartLineItemProps = {
  line: CartLineView
  saving: boolean
  removing: boolean
  choosingDuration: boolean
  error?: string
  disabled: boolean
  onQuantityChange: (desired: number) => void
  onRemove: () => void
  onChooseDuration: (optionId: string) => void
}

function QuantityStepper({
  title,
  quantity,
  saving,
  disabled,
  onChange,
}: {
  title: string
  quantity: number
  saving: boolean
  disabled: boolean
  onChange: (next: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="inline-flex items-center rounded-md border bg-card" role="group" aria-label={`Quantity of ${title}`}>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Decrease quantity of ${title}`}
          disabled={disabled || quantity <= 1}
          onClick={() => onChange(quantity - 1)}
        >
          <Minus aria-hidden="true" />
        </Button>
        <output aria-live="polite" className="w-9 text-center font-semibold tabular-nums">
          {quantity}
        </output>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Increase quantity of ${title}`}
          disabled={disabled || quantity >= MAX_QUANTITY}
          onClick={() => onChange(quantity + 1)}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      <span className="min-w-14 text-xs text-muted-foreground" aria-live="polite">
        {saving ? (
          <span className="inline-flex items-center gap-1">
            <Loader2 aria-hidden="true" className="size-3 motion-safe:animate-spin" />
            Saving…
          </span>
        ) : null}
      </span>
    </div>
  )
}

function DurationPicker({
  title,
  options,
  selectedId,
  busy,
  disabled,
  onChoose,
}: {
  title: string
  options: WellnessOption[]
  selectedId: string | null
  busy: boolean
  disabled: boolean
  onChoose: (id: string) => void
}) {
  const id = useId()
  return (
    <fieldset className="mt-3" disabled={disabled || busy}>
      <legend className="mb-2 flex items-center gap-1.5 text-sm font-medium">
        <Clock aria-hidden="true" className="size-4 text-primary" />
        Duration for {title}
        {busy && <Loader2 aria-label="Saving" className="size-3.5 motion-safe:animate-spin" />}
      </legend>
      <RadioGroup value={selectedId ?? ''} onValueChange={onChoose} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Label
            key={option.id}
            htmlFor={`${id}-${option.id}`}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-2 font-normal transition-colors',
              selectedId === option.id ? 'border-primary bg-secondary' : 'hover:border-primary/40',
            )}
          >
            <RadioGroupItem id={`${id}-${option.id}`} value={option.id} />
            <span className="font-medium">{option.durationInMinutes} min</span>
            <span className="text-muted-foreground tabular-nums">{formatMoney(option.price)}</span>
          </Label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

export function CartLineItem({
  line,
  saving,
  removing,
  choosingDuration,
  error,
  disabled,
  onQuantityChange,
  onRemove,
  onChooseDuration,
}: CartLineItemProps) {
  const headingId = useId()

  if (line.kind === 'unavailable') {
    return (
      <li aria-labelledby={headingId} className="rounded-md border border-dashed border-destructive/40 bg-destructive-soft p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <PackageX aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-destructive" />
            <div>
              <h4 id={headingId} tabIndex={-1} data-line-heading={line.id} className="font-semibold">
                {line.title ?? 'Service no longer available'}
              </h4>
              <p className="text-sm text-muted-foreground">
                The provider has removed this service. It can't be checked out and isn't included in any total.
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={onRemove} disabled={removing || disabled}>
            <Trash2 aria-hidden="true" />
            {removing ? 'Removing…' : 'Remove'}
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li aria-labelledby={headingId} className="rounded-md border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h4 id={headingId} tabIndex={-1} data-line-heading={line.id} className="leading-snug font-semibold focus:outline-none">
            {line.title}
          </h4>
          {line.providerName && <p className="text-sm text-muted-foreground">{line.providerName}</p>}
        </div>
        <div className="text-right tabular-nums">
          {line.kind === 'priced' ? (
            <>
              <p className="text-lg font-bold text-primary">{formatMoney(line.lineTotal)}</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(line.unitPrice)} each
                {line.wellness ? ` · ${line.wellness.options.find((o) => o.id === line.wellness?.selectedId)?.durationInMinutes} min` : ''}
              </p>
            </>
          ) : (
            <p className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-sm font-semibold text-warning-foreground">
              <AlertTriangle aria-hidden="true" className="size-3.5" />
              Price unknown
            </p>
          )}
        </div>
      </div>

      {line.kind === 'needs-duration' && (
        <p className="mt-2 text-sm text-warning-foreground">
          Choose a duration to see the price. Until then this treatment isn't priced and its group can't be checked out.
        </p>
      )}
      {(line.kind === 'needs-duration' || line.wellness) && (
        <DurationPicker
          title={line.title}
          options={line.kind === 'needs-duration' ? line.options : (line.wellness?.options ?? [])}
          selectedId={line.kind === 'priced' ? (line.wellness?.selectedId ?? null) : null}
          busy={choosingDuration}
          disabled={disabled}
          onChoose={onChooseDuration}
        />
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <QuantityStepper
          title={line.title}
          quantity={line.quantity}
          saving={saving}
          disabled={disabled || removing}
          onChange={(next) => onQuantityChange(Math.min(MAX_QUANTITY, Math.max(1, next)))}
        />
        <Button variant="ghost" size="sm" onClick={onRemove} disabled={removing || disabled} className="text-muted-foreground">
          <Trash2 aria-hidden="true" />
          {removing ? 'Removing…' : 'Remove'}
          <span className="sr-only"> {line.title}</span>
        </Button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </li>
  )
}
