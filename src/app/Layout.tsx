import { CalendarDays, HeartPulse, Search, ShoppingCart } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/utils'
import { MockFlagsBanner } from '@/shared/ui/MockFlagsBanner'
import { PageContainer } from '@/shared/ui/PageContainer'

const NAV_ITEMS = [
  { to: '/explorer', label: 'Explore services', icon: Search },
  { to: '/booking', label: 'Book', icon: CalendarDays },
  { to: '/cart', label: 'Cart', icon: ShoppingCart },
]

export function Layout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-30 border-b bg-white/95 shadow-xs backdrop-blur supports-backdrop-filter:bg-white/85">
        <PageContainer className="flex h-16 items-center justify-between gap-4">
          <NavLink to="/" className="flex items-center gap-2 rounded-md text-xl font-extrabold tracking-tight">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <HeartPulse aria-hidden="true" className="size-5" />
            </span>
            <span className="text-primary">
              Med<span className="text-brand-magenta">Ex</span>
            </span>
          </NavLink>
          <nav aria-label="Main">
            <ul className="flex items-center gap-1">
              {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold transition-colors hover:bg-accent',
                        isActive ? 'bg-secondary text-secondary-foreground' : 'text-foreground',
                      )
                    }
                  >
                    <Icon aria-hidden="true" className="size-4" />
                    <span className="sr-only sm:not-sr-only">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </PageContainer>
      </header>
      <MockFlagsBanner />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <footer className="border-t bg-surface py-8 text-sm text-muted-foreground">
        <PageContainer>MedEx — fictional data for a frontend assessment.</PageContainer>
      </footer>
    </div>
  )
}
