import { AlertTriangle, Ban, CheckCircle2, Merge, PlusCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { describeMergeChange } from '../domain/merge'
import type { GuestCartItem, MergeChange } from '../types'

type GuestMergeNoticeProps = {
  pendingItems: GuestCartItem[]
  changes: MergeChange[] | null
  merging: boolean
  error: string
  onMerge: () => void
  onDismiss: () => void
}

const TONE_ICONS = { added: PlusCircle, combined: CheckCircle2, attention: AlertTriangle, skipped: Ban }

/** Offer to merge the guest cart, then explain exactly what changed. */
export function GuestMergeNotice({ pendingItems, changes, merging, error, onMerge, onDismiss }: GuestMergeNoticeProps) {
  if (changes) {
    return (
      <section aria-labelledby="merge-summary-title" className="rounded-lg border border-primary/20 bg-secondary/50 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 id="merge-summary-title" className="font-semibold">
            We added the items you saved before signing in
          </h2>
          <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Dismiss merge summary">
            <X aria-hidden="true" />
          </Button>
        </div>
        <ul className="mt-3 grid gap-2">
          {changes.map((change) => {
            const message = describeMergeChange(change)
            const Icon = TONE_ICONS[message.tone]
            return (
              <li key={change.productId} className="flex items-start gap-2 text-sm">
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 size-4 shrink-0',
                    message.tone === 'skipped' && 'text-muted-foreground',
                    message.tone === 'attention' && 'text-warning-foreground',
                    (message.tone === 'added' || message.tone === 'combined') && 'text-success',
                  )}
                />
                <span>
                  <span className="font-medium">{message.title}:</span> {message.detail}
                </span>
              </li>
            )
          })}
        </ul>
      </section>
    )
  }

  if (pendingItems.length === 0) return null
  const count = pendingItems.reduce((n, item) => n + item.quantity, 0)
  return (
    <section aria-labelledby="merge-offer-title" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-surface p-4">
      <div>
        <h2 id="merge-offer-title" className="font-semibold">
          You have {count} {count === 1 ? 'item' : 'items'} saved on this device
        </h2>
        <p className="text-sm text-muted-foreground">Added while you were signed out. Merge them into this cart?</p>
        {error && (
          <p role="alert" className="mt-1 text-sm text-destructive">
            {error}
          </p>
        )}
      </div>
      <Button onClick={onMerge} disabled={merging}>
        <Merge aria-hidden="true" />
        {merging ? 'Merging…' : 'Merge into my cart'}
      </Button>
    </section>
  )
}
