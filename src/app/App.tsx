import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { HomePage } from './HomePage'
import { Layout } from './Layout'
import { NotFoundPage } from './NotFoundPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        path: 'explorer',
        // Code-split: the explorer (and its filter UI) loads only when visited.
        lazy: () =>
          import('../features/service-explorer/components/ExplorerPage').then((m) => ({ Component: m.ExplorerPage })),
      },
      {
        path: 'cart',
        lazy: () => import('../features/cart-checkout/components/CartPage').then((m) => ({ Component: m.CartPage })),
      },
      {
        path: 'booking',
        lazy: () => import('../features/appointment-booking/components/ProvidersPage').then((m) => ({ Component: m.ProvidersPage })),
      },
      {
        path: 'booking/reschedule/:bookingId',
        lazy: () => import('../features/appointment-booking/components/BookingPage').then((m) => ({ Component: m.BookingPage })),
      },
      {
        path: 'booking/:providerId',
        lazy: () => import('../features/appointment-booking/components/BookingPage').then((m) => ({ Component: m.BookingPage })),
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])

export function App() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { refetchOnWindowFocus: false },
          mutations: { retry: false },
        },
      }),
  )

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
