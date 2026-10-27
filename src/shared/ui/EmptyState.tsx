import { SearchX, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: ReactNode
  icon?: LucideIcon
  headingId?: string
  children?: ReactNode
}

/** Friendly "nothing here" panel with room for recovery actions. */
export function EmptyState({ title, description, icon: Icon = SearchX, headingId, children }: EmptyStateProps) {
  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col items-center gap-3 rounded-lg border border-dashed bg-card px-6 py-12 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
        <Icon aria-hidden="true" className="size-6" />
      </span>
      <h2 id={headingId} className="text-lg font-semibold">
        {title}
      </h2>
      {description && <div className="max-w-md text-sm text-muted-foreground">{description}</div>}
      {children}
    </section>
  )
}
