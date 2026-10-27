import { useIsFetching, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Re-requests the page's data from the API. The queries keep their current
 * keys, so the refreshed data is fetched for (and filtered by) the selections
 * already on screen. Stays focusable while refreshing; extra clicks are ignored.
 */
export function RefreshButton({ queryKey, className }: { queryKey: QueryKey; className?: string }) {
  const queryClient = useQueryClient()
  const refreshing = useIsFetching({ queryKey }) > 0

  return (
    <Button
      variant="outline"
      className={className}
      aria-busy={refreshing}
      onClick={() => {
        if (!refreshing) void queryClient.refetchQueries({ queryKey, type: 'active' })
      }}
    >
      <RefreshCw aria-hidden="true" className={cn(refreshing && 'motion-safe:animate-spin')} />
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </Button>
  )
}
