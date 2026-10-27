import { useId, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Currency } from '@/shared/lib/money'

type PriceRangeProps = {
  currency: Currency
  min: number | null
  max: number | null
  onApply: (min: number | null, max: number | null) => void
}

function toInput(value: number | null): string {
  return value === null ? '' : String(value)
}

function toAmount(value: string): number | null | 'invalid' {
  if (value.trim() === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 ? amount : 'invalid'
}

/** Min/max in one currency, applied explicitly so each keystroke isn't a new filter. */
export function PriceRange({ currency, min, max, onApply }: PriceRangeProps) {
  const id = useId()
  const [minText, setMinText] = useState(toInput(min))
  const [maxText, setMaxText] = useState(toInput(max))
  const [error, setError] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const nextMin = toAmount(minText)
    const nextMax = toAmount(maxText)
    if (nextMin === 'invalid' || nextMax === 'invalid') {
      setError('Enter amounts as numbers, for example 5000.')
      return
    }
    if (nextMin !== null && nextMax !== null && nextMin > nextMax) {
      setError('The minimum is higher than the maximum.')
      return
    }
    setError('')
    onApply(nextMin, nextMax)
  }

  return (
    <form className="mt-3 grid gap-3" onSubmit={submit} noValidate aria-describedby={error ? `${id}-error` : undefined}>
      <div className="grid grid-cols-2 gap-2">
        <div className="grid gap-1">
          <Label htmlFor={`${id}-min`} className="text-xs text-muted-foreground">
            Min ({currency})
          </Label>
          <Input
            id={`${id}-min`}
            inputMode="decimal"
            value={minText}
            onChange={(e) => setMinText(e.target.value)}
            placeholder="0"
            aria-invalid={Boolean(error)}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${id}-max`} className="text-xs text-muted-foreground">
            Max ({currency})
          </Label>
          <Input
            id={`${id}-max`}
            inputMode="decimal"
            value={maxText}
            onChange={(e) => setMaxText(e.target.value)}
            placeholder="Any"
            aria-invalid={Boolean(error)}
          />
        </div>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" variant="outline" className="border-primary text-primary">
        Apply price range
      </Button>
    </form>
  )
}
