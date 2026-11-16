import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && mode === 'production') {
    if (!env.VITE_API_BASE_URL) {
      throw new Error('VITE_API_BASE_URL must be set to the deployed API base URL (including /api) for production builds.')
    }

    if (env.VITE_API_BASE_URL !== '/api') {
      let apiUrl
      try {
        apiUrl = new URL(env.VITE_API_BASE_URL)
      } catch {
        throw new Error('VITE_API_BASE_URL must be /api or an absolute URL for production builds.')
      }

      if (apiUrl.protocol !== 'https:' && apiUrl.protocol !== 'http:') {
        throw new Error('VITE_API_BASE_URL must use http: or https: for production builds.')
      }
    }
  }

  return {
    plugins: [react()],
  }
})
