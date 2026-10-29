import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/shared/ui/EmptyState'
import { PageContainer } from '@/shared/ui/PageContainer'

export function NotFoundPage() {
  return (
    <PageContainer className="py-16">
      <title>Page not found · MedEx</title>
      <EmptyState title="Page not found" description="This page doesn't exist.">
        <Button asChild>
          <Link to="/explorer">Explore services</Link>
        </Button>
      </EmptyState>
    </PageContainer>
  )
}
