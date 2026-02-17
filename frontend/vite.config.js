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
  }
})
