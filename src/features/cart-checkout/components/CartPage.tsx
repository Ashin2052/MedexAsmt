import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ShoppingCart } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { describeApiError } from '@/shared/api/client'
import { useOnlineStatus } from '@/shared/lib/useOnlineStatus'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { OfflineBanner } from '@/shared/ui/OfflineBanner'
import { PageContainer } from '@/shared/ui/PageContainer'
import { RefreshButton } from '@/shared/ui/RefreshButton'
import { chooseWellnessOption, fetchCart, removeLine } from '../api/cartApi'
import type { RawCart } from '../api/schemas'
import { buildCartView, isCheckoutReady } from '../domain/cart'
import { activeRecordFor } from '../domain/checkout'
import { useCheckout } from '../hooks/useCheckout'
import { useGuestCart } from '../hooks/useGuestCart'
import { useQuantityQueue } from '../hooks/useQuantityQueue'
import type { CheckoutRecord, PaymentMethod } from '../types'
import { CartGroupCard } from './CartGroupCard'
import { CartSummary } from './CartSummary'
import { GuestMergeNotice } from './GuestMergeNotice'

function CartSkeleton() {
  return (
    <div role="status" className="grid gap-4">
      <span className="sr-only">Loading your cart…</span>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} aria-hidden="true" className="rounded-lg border bg-card p-6 shadow-card">
          <Skeleton className="h-6 w-40" />
          <div className="mt-4 grid gap-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

function toggleIn(set: ReadonlySet<string>, id: string, on: boolean): Set<string> {
  const next = new Set(set)
  if (on) next.add(id)
  else next.delete(id)
  return next
}

export function CartPage() {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['cart'], queryFn: ({ signal }) => fetchCart(signal), retry: false })
  // Stable on purpose: the quantity queue captures it once.
  const setCart = useCallback((next: RawCart) => queryClient.setQueryData(['cart'], next), [queryClient])
  const refreshCart = () => queryClient.invalidateQueries({ queryKey: ['cart'] })
  const online = useOnlineStatus()
  const queue = useQuantityQueue(setCart)
  const checkout = useCheckout()
  const guest = useGuestCart(setCart)
  const [methods, setMethods] = useState<Record<string, PaymentMethod>>({})
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set())
  const [choosing, setChoosing] = useState<ReadonlySet<string>>(new Set())
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({})
  const [checkingOutAll, setCheckingOutAll] = useState(false)
  const pendingFocus = useRef<string | null>(null)

  const cart = query.data ? buildCartView(query.data, queue.overrides) : null
  const methodFor = (type: string): PaymentMethod => methods[type] ?? 'card'

  // After a removal, move focus to the next line (or the group / page heading).
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    const el =
      document.querySelector<HTMLElement>(`[data-line-heading="${target}"]`) ??
      document.querySelector<HTMLElement>(`[data-group-heading="${target}"]`) ??
      document.getElementById('cart-title')
    el?.focus()
  }, [query.data])

  const handleRemove = async (lineId: string) => {
    if (!cart) return
    const group = cart.groups.find((g) => g.lines.some((l) => l.id === lineId))
    const index = group?.lines.findIndex((l) => l.id === lineId) ?? -1
    const neighbour = group && (group.lines[index + 1] ?? group.lines[index - 1])
    setRemoving((s) => toggleIn(s, lineId, true))
    try {
      await removeLine(lineId)
      // Next line in the group; else the group heading (if the group remains); else the page heading.
      pendingFocus.current = neighbour?.id ?? group?.type ?? 'page'
      await refreshCart()
    } catch (error) {
      setLineErrors((e) => ({ ...e, [lineId]: `Couldn't remove this item. ${describeApiError(error)}` }))
    } finally {
      setRemoving((s) => toggleIn(s, lineId, false))
    }
  }

  const handleChooseDuration = async (lineId: string, optionId: string) => {
    setChoosing((s) => toggleIn(s, lineId, true))
    try {
      setCart(await chooseWellnessOption(lineId, optionId))
      setLineErrors((e) => {
        const next = { ...e }
        delete next[lineId]
        return next
      })
    } catch (error) {
      setLineErrors((e) => ({ ...e, [lineId]: `Couldn't save the duration. ${describeApiError(error)}` }))
    } finally {
      setChoosing((s) => toggleIn(s, lineId, false))
    }
  }

  const readyGroups = cart
    ? cart.groups.filter((g) => {
        const record = activeRecordFor(checkout.records, g.type)
        return isCheckoutReady(g) && record?.status !== 'submitting' && record?.status !== 'unknown'
      })
    : []
  const placed = checkout.records.filter((r): r is Extract<CheckoutRecord, { status: 'placed' }> => r.status === 'placed')
  const savingLineIds = queue.pendingLineIds

  const handleCheckoutAll = async () => {
    setCheckingOutAll(true)
    try {
      await checkout.checkoutAll(readyGroups, Object.fromEntries(readyGroups.map((g) => [g.type, methodFor(g.type)])))
    } finally {
      setCheckingOutAll(false)
    }
  }

  return (
    <>
      <section className="border-b bg-surface">
        <PageContainer className="py-8 sm:py-10">
          <h1 id="cart-title" tabIndex={-1} className="flex items-center gap-3 text-3xl font-bold tracking-tight focus:outline-none">
            <ShoppingCart aria-hidden="true" className="size-7 text-primary" />
            Your cart
          </h1>
          <p className="mt-2 text-muted-foreground" aria-live="polite">
            {cart
              ? `${cart.totalItems} ${cart.totalItems === 1 ? 'item' : 'items'} in ${cart.groups.length} ${cart.groups.length === 1 ? 'group' : 'groups'} — each group is paid and booked separately.`
              : 'Loading…'}
          </p>
        </PageContainer>
      </section>

      <PageContainer className="py-6 sm:py-8">
        <OfflineBanner detail="You can review your cart, but changes and checkout are paused until you're back online." />

        <div className="mb-6 empty:hidden">
          <GuestMergeNotice
            pendingItems={guest.pendingItems}
            changes={guest.changes}
            merging={guest.merging}
            error={guest.error}
            onMerge={() => void guest.merge()}
            onDismiss={guest.dismissSummary}
          />
        </div>

        {query.isError && !cart ? (
          <ErrorState
            title="We couldn't load your cart"
            message={describeApiError(query.error)}
            onRetry={() => void query.refetch()}
            retrying={query.isFetching}
          />
        ) : !cart ? (
          <CartSkeleton />
        ) : cart.groups.length === 0 && placed.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="Your cart is empty" description="Find a check-up, lab test or treatment to add.">
            <Button asChild>
              <Link to="/explorer">Explore services</Link>
            </Button>
          </EmptyState>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="grid gap-6">
              <div className="flex justify-end">
                <RefreshButton queryKey={['cart']} />
              </div>
              {cart.groups.length === 0 && (
                <EmptyState icon={ShoppingCart} title="Everything in your cart has been ordered" description="Your orders are listed in the summary." />
              )}
              {cart.groups.map((group) => (
                <CartGroupCard
                  key={group.type}
                  group={group}
                  record={activeRecordFor(checkout.records, group.type)}
                  paymentMethod={methodFor(group.type)}
                  onPaymentMethodChange={(method) => setMethods((m) => ({ ...m, [group.type]: method }))}
                  savingLineIds={savingLineIds}
                  removingLineIds={removing}
                  choosingLineIds={choosing}
                  lineErrors={{ ...lineErrors, ...queue.errors }}
                  offline={!online}
                  onQuantityChange={(lineId, desired) => {
                    const serverLine = query.data?.groups.flatMap((g) => g.items).find((i) => i.id === lineId)
                    queue.changeQuantity(lineId, serverLine?.quantity ?? desired, desired)
                  }}
                  onRemove={(lineId) => void handleRemove(lineId)}
                  onChooseDuration={(lineId, optionId) => void handleChooseDuration(lineId, optionId)}
                  onCheckout={() => void checkout.checkoutGroup(group, methodFor(group.type))}
                />
              ))}
            </div>
            <CartSummary
              cart={cart}
              readyCount={readyGroups.length}
              busy={checkingOutAll}
              offline={!online}
              placed={placed}
              onCheckoutAll={() => void handleCheckoutAll()}
              onClearFinished={checkout.clearFinished}
            />
          </div>
        )}
      </PageContainer>
    </>
  )
}
