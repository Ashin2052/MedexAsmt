import { AlertCircle, CheckCircle2, CircleHelp, Clock, Loader2, XCircle } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { describeOrder } from '../domain/checkout'
import type { CheckoutRecord } from '../types'

/** One group's checkout state, announced to screen readers when it changes. */
export function CheckoutStatus({ record }: { record: CheckoutRecord }) {
  const ref = useRef<HTMLDivElement>(null)
  const needsAttention = record.status === 'failed' || record.status === 'unknown'

  // Move focus to a problem so keyboard and screen-reader users notice it.
  useEffect(() => {
    if (needsAttention) ref.current?.focus()
  }, [needsAttention, record.status])

  const view = (() => {
    switch (record.status) {
      case 'submitting':
        return { icon: Loader2, spin: true, tone: 'info', title: 'Placing your order…', body: 'Please keep this page open.' }
      case 'unknown':
        return { icon: CircleHelp, spin: false, tone: 'warning', title: 'Checking whether this order went through', body: record.message }
      case 'failed':
        return { icon: XCircle, spin: false, tone: 'error', title: 'This group was not ordered', body: record.message }
      case 'placed': {
        const label = describeOrder(record)
        const failed = record.orderStatus === 'failed'
        return {
          icon: failed ? AlertCircle : record.orderStatus === 'paid' || record.intent.paymentMethod === 'pay_at_clinic' ? CheckCircle2 : Clock,
          spin: false,
          tone: failed ? 'error' : 'success',
          title: `Order ${record.orderId}: ${label}`,
          body: failed
            ? 'The order was created but the card payment failed. Contact the provider to pay another way.'
            : 'This order is saved. You will receive a confirmation for it separately.',
        }
      }
    }
  })()

  const Icon = view.icon
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={needsAttention ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-3 rounded-md border p-3 text-sm focus:outline-none focus-visible:outline-2',
        view.tone === 'success' && 'border-brand-teal/40 bg-success-soft',
        view.tone === 'error' && 'border-destructive/30 bg-destructive-soft',
        view.tone === 'warning' && 'border-warning-foreground/30 bg-warning-soft',
        view.tone === 'info' && 'bg-surface',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          'mt-0.5 size-4 shrink-0',
          view.spin && 'motion-safe:animate-spin',
          view.tone === 'success' && 'text-success',
          view.tone === 'error' && 'text-destructive',
          view.tone === 'warning' && 'text-warning-foreground',
        )}
      />
      <div>
        <p className="font-semibold">{view.title}</p>
        <p className="text-muted-foreground">{view.body}</p>
      </div>
    </div>
  )
}
