import { cn } from '@/lib/utils'
import { formatMoney } from '@/shared/lib/money'
import type { PriceInfo } from '../types'

/** Customer-facing price: final amount, struck original when discounted, honest labels otherwise. */
export function PriceTag({ price, className }: { price: PriceInfo; className?: string }) {
  const wrapper = cn('flex flex-col tabular-nums', className)
  switch (price.kind) {
    case 'fixed':
      return (
        <p className={wrapper}>
          <span className="text-lg font-bold text-primary">{formatMoney(price.final)}</span>
          {price.original && (
            <s className="text-sm text-muted-foreground">
              <span className="sr-only">Original price </span>
              {formatMoney(price.original)}
            </s>
          )}
        </p>
      )
    case 'free':
      return (
        <p className={wrapper}>
          <span className="text-lg font-bold text-success">Free</span>
        </p>
      )
    case 'from': {
      const { lowest, options } = price
      return (
        <p className={wrapper}>
          <span className="text-lg font-bold text-primary">
            <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">From </span>
            {formatMoney(lowest.final)}
          </span>
          <span className="text-xs text-muted-foreground">
            {lowest.durationInMinutes} min
            {options.length > 1 ? ` · ${options.length} durations, price depends on the one you pick` : ''}
          </span>
        </p>
      )
    }
    case 'invalid':
      return (
        <p className={wrapper}>
          <span className="font-semibold text-muted-foreground">Price unavailable</span>
          <span className="text-xs text-muted-foreground">Ask the provider for a quote</span>
        </p>
      )
  }
}
