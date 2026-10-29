import { FlaskConical } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/button'
import { clearMockRules, getMockRules, subscribeMockRules } from '../api/mockFlags'
import { PageContainer } from './PageContainer'

/** Shown while ?mock= rules are armed, so nobody mistakes a simulated failure for a real one. */
export function MockFlagsBanner() {
  const rules = useSyncExternalStore(subscribeMockRules, getMockRules)
  if (!rules.length) return null
  return (
    <div className="border-b bg-warning-soft text-sm text-warning-foreground">
      <PageContainer className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <FlaskConical aria-hidden="true" className="size-4 shrink-0" />
        <span className="font-semibold">Test mode:</span>
        <span>
          {rules
            .map((r) => `${r.target}${r.nth > 1 ? ` #${r.nth}` : ''} → ${r.effect === 'lost' ? 'reply lost' : r.effect}`)
            .join(', ')}
        </span>
        <Button variant="link" size="sm" className="h-auto p-0 text-warning-foreground" onClick={clearMockRules}>
          Turn off
        </Button>
      </PageContainer>
    </div>
  )
}
