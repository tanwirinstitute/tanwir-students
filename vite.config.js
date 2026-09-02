import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { approveFinancialAid } from './netlify/functions/lib/financialAid.mjs'

// Dev-only mirror of netlify/functions/approve-financial-aid.mts so `npm run dev`
// can exercise the financial-aid approval relay without running `netlify dev`.
// `env` is the full .env set (no prefix filter) and stays server-side here — it
// is never handed to the client bundle.
function financialAidDevRelay(env) {
  return {
    name: 'financial-aid-dev-relay',
    configureServer(server) {
      server.middlewares.use('/api/approve-financial-aid', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ success: false, message: 'Method not allowed' }))
          return
        }
        try {
          const chunks = []
          for await (const chunk of req) chunks.push(chunk)
          const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          const { code } = await approveFinancialAid(body, env)
          res.statusCode = 200
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ success: true, code }))
        } catch (error) {
          console.error('approve-financial-aid (dev) failed:', error)
          res.statusCode = 502
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ success: false, message: error.message }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), financialAidDevRelay(env)],
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
  }
})
