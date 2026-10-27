import { ArrowRight, FlaskConical, Package, Sparkles } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/shared/ui/PageContainer'

const HIGHLIGHTS = [
  { icon: Package, title: 'Health packages', text: 'Compare check-ups from hospitals side by side.' },
  { icon: FlaskConical, title: 'Lab tests', text: 'Find tests, including ones you can take at home.' },
  { icon: Sparkles, title: 'Wellness', text: 'Massages and treatments, priced by duration.' },
]

export function HomePage() {
  return (
    <>
      <section className="border-b bg-surface">
        <PageContainer className="py-16 sm:py-24">
          <p className="text-sm font-semibold tracking-wide text-brand-magenta uppercase">Healthcare marketplace</p>
          <h1 className="mt-3 max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Find care that <span className="text-primary">fits.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-muted-foreground">
            Clinics, hospitals and labs across Thailand, Nepal and India — compared in one place.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/explorer">
              Explore services
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </PageContainer>
      </section>
      <PageContainer className="grid gap-4 py-12 sm:grid-cols-3">
        {HIGHLIGHTS.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-lg border bg-card p-6 shadow-card">
            <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon aria-hidden="true" className="size-5" />
            </span>
            <h2 className="mt-4 font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </PageContainer>
    </>
  )
}
