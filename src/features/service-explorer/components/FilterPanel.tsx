// Facet controls. Used by the desktop sidebar (changes apply immediately) and
// by the mobile drawer (changes apply to a draft until "Show results").
//
// Zero-result options stay visible but disabled (decision D-06): the list does
// not jump around as other filters change, customers can still see that the
// option exists, and an option that is already selected is never disabled so
// it can always be undone.
import { Search } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { CURRENCIES, CURRENCY_NAMES, isCurrency } from '@/shared/lib/money'
import { NativeSelect } from '@/shared/ui/NativeSelect'
import type { FacetCounts } from '../domain/facets'
import { SERVICE_TYPES, SERVICE_TYPE_LABELS, type ExplorerFilters, type ExplorerIndex } from '../types'
import { PriceRange } from './PriceRange'

type FilterPanelProps = {
  index: ExplorerIndex
  filters: ExplorerFilters
  counts: FacetCounts
  onChange: (patch: Partial<ExplorerFilters>) => void
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
}

function FacetGroup({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-b pb-5 last:border-b-0 last:pb-0">
      <legend className="mb-2 text-sm font-semibold">{title}</legend>
      {hint && <p className="mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </fieldset>
  )
}

function Count({ value }: { value: number }) {
  return (
    <span className="ml-auto pl-2 text-xs text-muted-foreground tabular-nums">
      <span className="sr-only">, </span>
      {value.toLocaleString('en-US')}
      <span className="sr-only"> {value === 1 ? 'result' : 'results'}</span>
    </span>
  )
}

type OptionProps = {
  label: ReactNode
  count: number
  checked: boolean
  onToggle: () => void
  nested?: boolean
}

function CheckboxOption({ label, count, checked, onToggle, nested = false }: OptionProps) {
  const id = useId()
  const disabled = count === 0 && !checked
  return (
    <div className={cn('flex min-h-9 items-center gap-2.5', nested && 'pl-6')}>
      <Checkbox id={id} checked={checked} disabled={disabled} onCheckedChange={onToggle} />
      <Label htmlFor={id} className="min-w-0 flex-1 cursor-pointer py-1 leading-snug font-normal">
        <span className={cn('min-w-0', disabled && 'line-through decoration-muted-foreground/60')}>{label}</span>
        <Count value={count} />
      </Label>
    </div>
  )
}

function CategoryFacet({ index, filters, counts, onChange }: FilterPanelProps) {
  const toggleCategory = (id: string) => {
    const category = index.categoryById.get(id)
    const childIds = new Set(category?.children.map((c) => c.id) ?? [])
    const selected = filters.categoryIds.includes(id)
    onChange({
      categoryIds: toggle(filters.categoryIds, id),
      // Unselecting a category also drops its subcategories.
      subCategoryIds: selected ? filters.subCategoryIds.filter((s) => !childIds.has(s)) : filters.subCategoryIds,
    })
  }

  return (
    <FacetGroup title="Category" hint="Choose a category to narrow by subcategory.">
      <ul>
        {index.categories.map((category) => {
          const selected = filters.categoryIds.includes(category.id)
          return (
            <li key={category.id}>
              <CheckboxOption
                label={
                  <>
                    {category.title}{' '}
                    <span className="text-xs text-muted-foreground">{SERVICE_TYPE_LABELS[category.type]}</span>
                  </>
                }
                count={counts.category.get(category.id) ?? 0}
                checked={selected}
                onToggle={() => toggleCategory(category.id)}
              />
              {selected && category.children.length > 0 && (
                <ul aria-label={`${category.title} subcategories`}>
                  {category.children.map((sub) => (
                    <li key={sub.id}>
                      <CheckboxOption
                        nested
                        label={sub.title}
                        count={counts.category.get(sub.id) ?? 0}
                        checked={filters.subCategoryIds.includes(sub.id)}
                        onToggle={() => onChange({ subCategoryIds: toggle(filters.subCategoryIds, sub.id) })}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </FacetGroup>
  )
}

function ProviderFacet({ index, filters, counts, onChange }: FilterPanelProps) {
  const [search, setSearch] = useState('')
  const inputId = useId()
  const needle = search.trim().toLowerCase()
  const matching = index.providers.filter((p) => !needle || p.name.toLowerCase().includes(needle))
  // Selected providers stay at the top so they can always be unselected.
  const ordered = [
    ...matching.filter((p) => filters.providerIds.includes(p.id)),
    ...matching.filter((p) => !filters.providerIds.includes(p.id)),
  ]

  return (
    <FacetGroup title="Provider">
      <div className="relative mb-2">
        <Label htmlFor={inputId} className="sr-only">
          Search providers
        </Label>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={inputId}
          type="search"
          className="pl-9"
          placeholder="Search providers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>
      {/* Focusable so the list can be scrolled by keyboard even when every option is disabled (WCAG 2.1.1). */}
      <ul aria-label="Providers" tabIndex={0} className="max-h-64 overflow-y-auto rounded-sm pr-1">
        {ordered.map((provider) => (
          <li key={provider.id}>
            <CheckboxOption
              label={provider.name}
              count={counts.provider.get(provider.id) ?? 0}
              checked={filters.providerIds.includes(provider.id)}
              onToggle={() => onChange({ providerIds: toggle(filters.providerIds, provider.id) })}
            />
          </li>
        ))}
        {ordered.length === 0 && <li className="py-2 text-xs text-muted-foreground">No provider matches “{search}”.</li>}
      </ul>
    </FacetGroup>
  )
}

function LocationFacet({ index, filters, counts, onChange }: FilterPanelProps) {
  const selectId = useId()
  const value =
    filters.location?.kind === 'city'
      ? `city:${filters.location.slug}`
      : filters.location?.kind === 'country'
        ? `country:${filters.location.code}`
        : ''

  const handleChange = (raw: string) => {
    const [kind, key] = raw.split(':')
    if (kind === 'city') onChange({ location: { kind: 'city', slug: key } })
    else if (kind === 'country') onChange({ location: { kind: 'country', code: key } })
    else onChange({ location: null })
  }

  return (
    <FacetGroup title="City or country">
      <Label htmlFor={selectId} className="sr-only">
        City or country
      </Label>
      <NativeSelect id={selectId} value={value} onChange={(e) => handleChange(e.target.value)}>
        <option value="">Anywhere</option>
        {index.countries.map((country) => {
          const countryCount = counts.country.get(country.code) ?? 0
          return (
            <optgroup key={country.code} label={country.name}>
              <option value={`country:${country.code}`} disabled={countryCount === 0 && value !== `country:${country.code}`}>
                All of {country.name} ({countryCount})
              </option>
              {country.cities.map((city) => {
                const cityCount = counts.city.get(city.slug) ?? 0
                return (
                  <option key={city.slug} value={`city:${city.slug}`} disabled={cityCount === 0 && value !== `city:${city.slug}`}>
                    {city.name} ({cityCount})
                  </option>
                )
              })}
            </optgroup>
          )
        })}
      </NativeSelect>
    </FacetGroup>
  )
}

function PriceFacet({ filters, counts, onChange }: FilterPanelProps) {
  const id = useId()
  return (
    <FacetGroup
      title="Price"
      hint="Prices are in each provider's own currency and are never converted. Pick a currency to set a range."
    >
      <RadioGroup
        value={filters.currency ?? 'any'}
        onValueChange={(value) => onChange({ currency: isCurrency(value) ? value : null })}
        className="gap-0"
      >
        <div className="flex min-h-9 items-center gap-2.5">
          <RadioGroupItem id={`${id}-any`} value="any" />
          <Label htmlFor={`${id}-any`} className="flex-1 cursor-pointer font-normal">
            Any currency
          </Label>
        </div>
        {CURRENCIES.map((currency) => {
          const count = counts.currency.get(currency) ?? 0
          const disabled = count === 0 && filters.currency !== currency
          return (
            <div key={currency} className="flex min-h-9 items-center gap-2.5">
              <RadioGroupItem id={`${id}-${currency}`} value={currency} disabled={disabled} />
              <Label htmlFor={`${id}-${currency}`} className="min-w-0 flex-1 cursor-pointer py-1 leading-snug font-normal">
                <span className={cn(disabled && 'line-through decoration-muted-foreground/60')}>
                  {currency} <span className="text-xs text-muted-foreground">{CURRENCY_NAMES[currency]}</span>
                </span>
                <Count value={count} />
              </Label>
            </div>
          )
        })}
      </RadioGroup>
      {filters.currency && (
        <PriceRange
          key={`${filters.currency}:${filters.min}:${filters.max}`}
          currency={filters.currency}
          min={filters.min}
          max={filters.max}
          onApply={(min, max) => onChange({ min, max })}
        />
      )}
    </FacetGroup>
  )
}

export function FilterPanel(props: FilterPanelProps) {
  const { filters, counts, onChange } = props
  return (
    <div className="grid gap-5">
      <FacetGroup title="Service type">
        <ul>
          {SERVICE_TYPES.map((type) => (
            <li key={type}>
              <CheckboxOption
                label={SERVICE_TYPE_LABELS[type]}
                count={counts.type.get(type) ?? 0}
                checked={filters.types.includes(type)}
                onToggle={() => onChange({ types: toggle(filters.types, type) })}
              />
            </li>
          ))}
        </ul>
      </FacetGroup>
      <CategoryFacet {...props} />
      <LocationFacet {...props} />
      <PriceFacet {...props} />
      <FacetGroup title="Convenience">
        <CheckboxOption
          label="Available as a home test"
          count={counts.home}
          checked={filters.homeTest}
          onToggle={() => onChange({ homeTest: !filters.homeTest })}
        />
      </FacetGroup>
      <ProviderFacet {...props} />
    </div>
  )
}
