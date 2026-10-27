import { WifiOff } from 'lucide-react'
import { useOnlineStatus } from '../lib/useOnlineStatus'

export function OfflineBanner({ detail }: { detail: string }) {
  const online = useOnlineStatus()
  return (
    <div role="status" aria-live="polite">
      {!online && (
        <p className="mb-4 flex items-start gap-2 rounded-lg bg-warning-soft px-4 py-3 text-sm font-medium text-warning-foreground">
          <WifiOff aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>You're offline. {detail}</span>
        </p>
      )}
    </div>
  )
}
