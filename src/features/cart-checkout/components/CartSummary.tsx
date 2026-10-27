import { Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatMoney, type Money } from '@/shared/lib/money'
import { describeOrder } from '../domain/checkout'
import type { CartView, CheckoutRecord } from '../types'

type CartSummaryProps = {
  cart: CartView
  readyCount: number
  busy: boolean
  offline: boolean
  placed: Extract<CheckoutRecord, { status: 'placed' }>[]
  onCheckoutAll: () => void
  onClearFinished: () => void
}

function MoneyList({ amounts }: { amounts: Money[] }) {
  return (
    <ul className="grid gap-1">
      {amounts.map((money) => (
        <li key={money.currency} className="flex items-baseline justify-between gap-4 tabular-nums">
          <span className="text-sm text-muted-foreground">In {money.currency}</span>
          <span className="text-lg font-bold">{formatMoney(money)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * What the customer will pay, per currency, and how many separate orders that
 * is. There is deliberately no grand total: currencies are never added.
 */
export function CartSummary({ cart, readyCount, busy, offline, placed, onCheckoutAll, onClearFinished }: CartSummaryProps) {
  return (
    <aside aria-labelledby="cart-summary-title" className="rounded-lg border bg-card p-5 shadow-card lg:sticky lg:top-20">
      <h2 id="cart-summary-title" className="flex items-center gap-2 text-lg font-semibold">
        <Receipt aria-hidden="true" className="size-5 text-primary" />
        Summary
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Each group is a separate order with its own payment. Totals are shown per currency and never combined.
      </p>

      <div className="mt-4 border-t pt-4">
        {cart.totalsByCurrency.length > 0 ? (
          <MoneyList amounts={cart.totalsByCurrency} />
        ) : (
          <p className="text-sm text-muted-foreground">No priced items.</p>
        )}
        {(cart.unpricedCount > 0 || cart.unavailableCount > 0) && (
          <p className="mt-3 text-xs text-muted-foreground">
            Not included:{' '}
            {[
              cart.unpricedCount > 0 && `${cart.unpricedCount} without a price yet`,
              cart.unavailableCount > 0 && `${cart.unavailableCount} unavailable`,
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </p>
        )}
      </div>

      <Button size="lg" className="mt-5 w-full" disabled={readyCount === 0 || busy || offline} onClick={onCheckoutAll}>
        {readyCount > 1 ? `Check out all ${readyCount} ready groups` : readyCount === 1 ? 'Check out the ready group' : 'Nothing ready to check out'}
      </Button>
      <p className="mt-2 text-xs text-muted-foreground">
        Groups are ordered one after another. If one fails, the others are not affected and you can retry just that one.
      </p>

      {placed.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Orders placed</h3>
            <Button variant="link" size="sm" className="h-auto p-0" onClick={onClearFinished}>
              Clear
            </Button>
          </div>
          <ul className="mt-2 grid gap-2">
            {placed.map((record) => (
              <li key={record.intent.attemptId} className="rounded-md bg-surface p-3 text-sm">
                <p className="font-medium">{record.intent.groupLabel}</p>
                <p className="text-muted-foreground">
                  <span className="font-mono text-xs">{record.orderId}</span> · {describeOrder(record)}
                </p>
                <p className="text-muted-foreground tabular-nums">{record.intent.totals.map(formatMoney).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
