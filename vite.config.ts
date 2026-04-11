import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/deployments': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
      },
      // Same API origin as deployments; getTemplates() hits GET /templates (not under /deployments).
      '/templates': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
})
