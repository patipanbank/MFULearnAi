import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      // Socket.IO WebSocket proxy — MUST be before /api
      '/socket.io': {
        target: 'http://gateway:80',
        changeOrigin: true,
        ws: true  // Enable WebSocket proxying
      },
      // REST API proxy (no longer needs SSE selfHandleResponse)
      '/api': {
        target: 'http://gateway:80',
        changeOrigin: true,
        secure: false
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 5500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('vue') || id.includes('pinia') || id.includes('axios') || id.includes('socket.io')) {
              return 'vendor';
            }
            if (id.includes('@coreui')) {
              return 'ui-core';
            }
            if (id.includes('marked') || id.includes('highlight.js')) {
              return 'markdown';
            }
            if (id.includes('pdfjs-dist') || id.includes('vue-pdf-embed')) {
              return 'pdf';
            }
            if (id.includes('chart.js') || id.includes('vue-chartjs')) {
              return 'charts';
            }
            if (id.includes('lucide') || id.includes('@heroicons')) {
              return 'icons';
            }
            return 'modules';
          }
        }
      }
    }
  }
})
