import { ChevronDown, House, MapPin, Star } from 'lucide-react'
import { useId, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/shared/lib/money'
import type { ProviderGroup } from '../domain/grouping'
import { SERVICE_TYPE_LABELS, type ProviderView, type ServiceView } from '../types'
import { PriceTag } from './PriceTag'
import { ServiceTypeIcon } from '@/shared/ui/ServiceTypeIcon'

const PREVIEW_COUNT = 3

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

function Rating({ provider }: { provider: ProviderView }) {
  if (provider.rating === null) {
    return <span className="rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground italic">No ratings yet</span>
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm font-semibold whitespace-nowrap">
      <Star aria-hidden="true" className="size-4 fill-star text-star" />
      <span className="sr-only">Rated </span>
      {provider.rating.toFixed(1)}
      <span className="sr-only"> out of 5</span>
      <span className="font-normal text-muted-foreground">· {provider.reviewCount.toLocaleString('en-US')} reviews</span>
    </span>
  )
}

function ServiceCard({ service }: { service: ServiceView }) {
  const category = [service.categoryTitle, service.subCategoryTitle].filter(Boolean).join(' › ')
  const discounted = service.price.kind === 'fixed' && service.price.original !== null

  return (
    <li className="flex flex-col gap-3 rounded-md border bg-card p-4 transition-colors hover:border-primary/30">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          <ServiceTypeIcon type={service.type} aria-hidden="true" />
          {SERVICE_TYPE_LABELS[service.type]}
        </Badge>
        {discounted && <Badge className="bg-discount text-discount-foreground">Discount</Badge>}
      </div>
      <div className="min-w-0 flex-1">
        <h4 className="leading-snug font-semibold break-words">{service.title}</h4>
        {category && <p className="mt-1 text-xs text-muted-foreground">{category}</p>}
      </div>
      {service.testAtHome && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-success">
          <House aria-hidden="true" className="size-3.5 shrink-0" />
          Home test available
          {service.homeTestCharge ? ` (+${formatMoney(service.homeTestCharge)} visit)` : ''}
        </p>
      )}
      <PriceTag price={service.price} className="border-t pt-3" />
    </li>
  )
}

export function ProviderCard({ group }: { group: ProviderGroup }) {
  const { provider, services } = group
  const [expanded, setExpanded] = useState(false)
  const listId = useId()
  const visible = expanded ? services : services.slice(0, PREVIEW_COUNT)
  const hiddenCount = services.length - PREVIEW_COUNT

  return (
    <article aria-labelledby={`${listId}-name`} className="rounded-lg border bg-card p-4 shadow-card transition-shadow hover:shadow-card-hover sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-secondary font-bold text-secondary-foreground"
          >
            {initials(provider.name)}
          </span>
          <div className="min-w-0">
            <h3 id={`${listId}-name`} className="text-lg leading-tight font-semibold">
              {provider.name}
            </h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" className="size-3.5" />
                {provider.city.name}, {provider.country.name}
              </span>
              <span>Prices in {provider.currency}</span>
            </p>
          </div>
        </div>
        <Rating provider={provider} />
      </header>

      <p className="mt-4 text-sm font-medium text-muted-foreground">
        {services.length} matching {services.length === 1 ? 'service' : 'services'}
      </p>
      <ul id={listId} className="mt-2 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </ul>

      {hiddenCount > 0 && (
        <Button
          variant="outline"
          className="mt-4 w-full sm:w-auto"
          aria-expanded={expanded}
          aria-controls={listId}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? 'Show fewer services' : `View all ${services.length} services`}
          <span className="sr-only"> from {provider.name}</span>
          <ChevronDown aria-hidden="true" className={cn('transition-transform', expanded && 'rotate-180')} />
        </Button>
      )}
    </article>
  )
}
