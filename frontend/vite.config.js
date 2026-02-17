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
      '/api': {
        target: 'http://gateway:80',
        changeOrigin: true,
        secure: false,
        // selfHandleResponse: prevent http-proxy from buffering SSE responses
        selfHandleResponse: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            const contentType = proxyRes.headers['content-type'] || '';
            const isSSE = contentType.includes('text/event-stream');

            // Write status + headers
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);

            if (isSSE) {
              // SSE: disable buffering, stream events immediately
              res.flushHeaders();
              proxyRes.on('data', (chunk) => {
                res.write(chunk);
                // Force flush each chunk for real-time delivery
                if (typeof res.flush === 'function') res.flush();
              });
              proxyRes.on('end', () => { res.end(); });
            } else {
              // Non-SSE: pipe normally
              proxyRes.pipe(res);
            }
          });
        }
      }
    }
  }
})


