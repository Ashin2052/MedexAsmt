import { AlertTriangle, RotateCw } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'
import { Button } from '@/components/ui/button'

type ErrorStateProps = {
  title: string
  message: string
  onRetry: () => void
  retrying?: boolean
}

/** Failure panel with a retry action; focus moves here so keyboard users notice. */
export function ErrorState({ title, message, onRetry, retrying = false }: ErrorStateProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    headingRef.current?.focus()
  }, [])

  return (
    <section
      role="alert"
      aria-labelledby={titleId}
      className="flex flex-col items-center gap-3 rounded-lg border border-destructive/30 bg-destructive-soft px-6 py-10 text-center"
    >
      <span className="flex size-12 items-center justify-center rounded-full bg-card text-destructive shadow-sm">
        <AlertTriangle aria-hidden="true" className="size-6" />
      </span>
      <h2 id={titleId} ref={headingRef} tabIndex={-1} className="text-lg font-semibold">
        {title}
      </h2>
      <p className="max-w-md text-sm text-muted-foreground">{message}</p>
      <Button onClick={onRetry} disabled={retrying} className="mt-2">
        <RotateCw aria-hidden="true" className={retrying ? 'motion-safe:animate-spin' : undefined} />
        {retrying ? 'Retrying…' : 'Try again'}
      </Button>
    </section>
  )
}
