import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import { buildProxies } from './src/proxy.config'

// Use relative asset URLs so the same build can be mounted under any subpath
// (tailscale serve `/dashboard`, cloudflare tunnel, etc.). Runtime base
// path is injected into index.html as `window.__BASE_PATH__`.
export default defineConfig({
  base: './',
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    host: true, // allow access from external hosts
    port: 5173,
    strictPort: true,
    allowedHosts: ['t1.insuit.cz', 'welcome.insuit.cz'],
    proxy: buildProxies('/'),
  },
})
