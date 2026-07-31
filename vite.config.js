import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/htmldrop-clone/',
  plugins: [react()],
  define: {
    // Point API to the Netlify Functions endpoint
    __API_BASE__: JSON.stringify('https://htmldrop2.netlify.app'),
  },
  server: {
    port: 3000,
    proxy: {
      '/.netlify/functions': {
        target: 'http://localhost:9999',
        changeOrigin: true
      }
    }
  }
})
