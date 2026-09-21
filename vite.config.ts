import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Each portal/exam route is lazy-loaded, so a 600 KB ceiling is fine.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('react-router')) return 'router';
          if (id.includes('framer-motion')) return 'motion';
          if (id.includes('lucide-react')) return 'icons';
          if (id.includes('react-dom') || id.includes('react/') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          return 'vendor';
        },
      },
    },
  },
})