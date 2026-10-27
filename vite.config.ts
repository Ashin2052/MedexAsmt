import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

// The mock replication API (mock-api/, JSON Server + custom routes) runs as a
// separate process on http://localhost:4010 by default. The browser calls
// same-origin /api/*, and the dev/preview server forwards those requests to
// MOCK_API_URL, so no CORS setup is needed and the port can change freely.
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const mockApiUrl = env.MOCK_API_URL || 'http://localhost:4010'
  const proxy = {
    '/api': { target: mockApiUrl, changeOrigin: true },
    '/health': { target: mockApiUrl, changeOrigin: true },
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    server: { proxy },
    preview: { proxy },
  }
})
