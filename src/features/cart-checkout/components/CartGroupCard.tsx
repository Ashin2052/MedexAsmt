import { CreditCard, RotateCw, Store } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/shared/lib/money'
import { ServiceTypeIcon } from '@/shared/ui/ServiceTypeIcon'
import { isCheckoutReady } from '../domain/cart'
import type { CartGroupView, CheckoutRecord, PaymentMethod } from '../types'
import { CartLineItem } from './CartLineItem'
import { CheckoutStatus } from './CheckoutStatus'

type CartGroupCardProps = {
  group: CartGroupView
  record: CheckoutRecord | undefined
  paymentMethod: PaymentMethod
  onPaymentMethodChange: (method: PaymentMethod) => void
  savingLineIds: ReadonlySet<string>
  removingLineIds: ReadonlySet<string>
  choosingLineIds: ReadonlySet<string>
  lineErrors: Record<string, string>
  offline: boolean
  onQuantityChange: (lineId: string, desired: number) => void
  onRemove: (lineId: string) => void
  onChooseDuration: (lineId: string, optionId: string) => void
  onCheckout: () => void
}

const PAYMENT_OPTIONS: { value: PaymentMethod; label: string; hint: string; icon: typeof CreditCard }[] = [
  { value: 'card', label: 'Card', hint: 'Pay now', icon: CreditCard },
  { value: 'pay_at_clinic', label: 'Pay at clinic', hint: 'Pay on the day', icon: Store },
]

export function CartGroupCard(props: CartGroupCardProps) {
  const { group, record, paymentMethod, offline } = props
  const id = useId()
  const busy = record?.status === 'submitting' || record?.status === 'unknown'
  const savingInGroup = group.lines.some((l) => props.savingLineIds.has(l.id) || props.choosingLineIds.has(l.id))
  const ready = isCheckoutReady(group)
  const locked = busy // lines can't change while this group's order is being placed
  const canCheckout = ready && !busy && !savingInGroup && !offline
  const isRetry = record?.status === 'failed' && record.retryable

  const actionLabel =
    record?.status === 'unknown'
      ? 'Check order status'
      : isRetry
        ? `Try again: ${paymentMethod === 'card' ? 'pay by card' : 'pay at clinic'}`
        : paymentMethod === 'card'
          ? `Pay for ${group.label.toLowerCase()} by card`
          : `Book ${group.label.toLowerCase()}, pay at clinic`

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-lg border bg-card p-4 shadow-card sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-title`} tabIndex={-1} data-group-heading={group.type} className="flex items-center gap-2 text-lg font-semibold focus:outline-none">
          <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">
            <ServiceTypeIcon type={group.type} aria-hidden="true" className="size-5" />
          </span>
          {group.label}
        </h2>
        <span className="text-sm text-muted-foreground">
          {group.itemCount} {group.itemCount === 1 ? 'item' : 'items'} · separate order
        </span>
      </header>

      <ul className="mt-4 grid gap-3">
        {group.lines.map((line) => (
          <CartLineItem
            key={line.id}
            line={line}
            saving={props.savingLineIds.has(line.id)}
            removing={props.removingLineIds.has(line.id)}
            choosingDuration={props.choosingLineIds.has(line.id)}
            error={props.lineErrors[line.id]}
            disabled={locked || offline}
            onQuantityChange={(desired) => props.onQuantityChange(line.id, desired)}
            onRemove={() => props.onRemove(line.id)}
            onChooseDuration={(optionId) => props.onChooseDuration(line.id, optionId)}
          />
        ))}
      </ul>

      <div className="mt-5 grid gap-4 border-t pt-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold">Subtotal</h3>
          {group.subtotals.length > 0 ? (
            <ul className="mt-1 grid gap-0.5">
              {group.subtotals.map((money) => (
                <li key={money.currency} className="text-lg font-bold text-foreground tabular-nums">
                  {formatMoney(money)}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No priced items yet</p>
          )}
          {group.subtotals.length > 1 && (
            <p className="mt-1 text-xs text-muted-foreground">Shown per currency — currencies are never added together.</p>
          )}
          {group.unpricedCount > 0 && (
            <p className="mt-1 text-xs text-warning-foreground">
              {group.unpricedCount} {group.unpricedCount === 1 ? 'item has' : 'items have'} no price yet and {group.unpricedCount === 1 ? 'is' : 'are'} not included.
            </p>
          )}
        </div>

        {ready ? (
          <fieldset disabled={busy}>
            <legend className="text-sm font-semibold">Payment for this order</legend>
            {/* `disabled` here too: Radix doesn't see the fieldset's, and would keep an unfocusable group as a tab stop. */}
            <RadioGroup
              value={paymentMethod}
              disabled={busy}
              onValueChange={(value) => props.onPaymentMethodChange(value === 'pay_at_clinic' ? 'pay_at_clinic' : 'card')}
              className="mt-2 grid grid-cols-2 gap-2"
            >
              {PAYMENT_OPTIONS.map(({ value, label, hint, icon: OptionIcon }) => (
                <Label
                  key={value}
                  htmlFor={`${id}-${value}`}
                  className={cn(
                    'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2.5 font-normal',
                    paymentMethod === value ? 'border-primary bg-secondary' : 'hover:border-primary/40',
                  )}
                >
                  <RadioGroupItem id={`${id}-${value}`} value={value} />
                  <OptionIcon aria-hidden="true" className="size-4 text-primary" />
                  <span>
                    <span className="block font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </Label>
              ))}
            </RadioGroup>
          </fieldset>
        ) : (
          <div className="rounded-md bg-warning-soft p-3 text-sm text-warning-foreground">
            <p className="font-semibold">Can't check out this group yet</p>
            <ul className="mt-1 list-disc pl-5">
              {group.blockers.map((blocker) => (
                <li key={blocker}>{blocker}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {record && (
        <div className="mt-4">
          <CheckoutStatus record={record} />
        </div>
      )}

      {(ready || record?.status === 'unknown') && (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          {offline && <p className="text-sm text-muted-foreground">You're offline — checkout is paused.</p>}
          {savingInGroup && <p className="text-sm text-muted-foreground">Saving your changes…</p>}
          <Button
            size="lg"
            onClick={props.onCheckout}
            disabled={record?.status === 'unknown' ? offline : !canCheckout}
            className="w-full sm:w-auto"
          >
            {(isRetry || record?.status === 'unknown') && <RotateCw aria-hidden="true" />}
            {record?.status === 'submitting' ? 'Placing order…' : actionLabel}
          </Button>
        </div>
      )}
    </section>
  )
}
