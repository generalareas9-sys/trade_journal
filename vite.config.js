import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/node_modules/@supabase/') || normalizedId.includes('/node_modules/iceberg-js/')) return 'supabase'
          if (/\/node_modules\/(recharts|recharts-scale|victory-vendor|d3-[^/]+)\//.test(normalizedId)) return 'recharts'
          if (/\/node_modules\/(react|react-dom|react-router|scheduler)\//.test(normalizedId)) return 'react-vendor'
          return undefined
        },
      },
    },
  },
})
