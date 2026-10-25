import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (command === 'build' && mode === 'production') {
    if (!env.VITE_API_BASE_URL) {
      throw new Error('VITE_API_BASE_URL must be set to the deployed API base URL (including /api) for production builds.')
    }

    let apiUrl
    try {
      apiUrl = new URL(env.VITE_API_BASE_URL)
    } catch {
      throw new Error('VITE_API_BASE_URL must be an absolute HTTPS URL for production builds.')
    }

    if (apiUrl.protocol !== 'https:') {
      throw new Error('VITE_API_BASE_URL must use HTTPS for production builds.')
    }
  }

  return {
    plugins: [react()],
  }
})
