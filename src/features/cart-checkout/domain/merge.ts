// Customer-facing wording for each guest-cart merge outcome.
import type { MergeChange } from '../types'

type MergeMessage = { tone: 'added' | 'combined' | 'attention' | 'skipped'; title: string; detail: string }

export function describeMergeChange(change: MergeChange): MergeMessage {
  const name = change.title ?? 'A service you saved'
  if (change.outcome === 'skipped') {
    return {
      tone: 'skipped',
      title: name,
      detail: 'Not added: this service is no longer available from the provider.',
    }
  }

  const wellness = change.wellness
  const wellnessNote =
    wellness?.status === 'applied'
      ? ` Your ${wellness.durationInMinutes}-minute choice was applied.`
      : wellness?.status === 'kept-account-choice'
        ? ` We kept the ${wellness.durationInMinutes}-minute duration already in your account cart.`
        : wellness?.status === 'needs-choice'
          ? ' Choose a duration before checking out.'
          : ''
  const tone = wellness?.status === 'needs-choice' ? 'attention' : change.outcome === 'added' ? 'added' : 'combined'

  if (change.outcome === 'added') {
    return { tone, title: name, detail: `Added (quantity ${change.to}).${wellnessNote}` }
  }
  const capped = change.capped ? ' (the maximum is 20)' : ''
  return {
    tone,
    title: name,
    detail: `Quantities combined: ${change.from} already in your cart + ${change.added} from this device = ${change.to}${capped}.${wellnessNote}`,
  }
}
