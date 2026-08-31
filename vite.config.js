import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy emailer calls server-side so the browser makes a same-origin
      // request (the emailer API at email.tanwir.institute sends no CORS headers).
      '/emailer': {
        target: 'https://email.tanwir.institute/api',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/emailer/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 800 // Increased from default 500kb
  }
})
