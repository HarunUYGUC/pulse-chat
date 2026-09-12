import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err, _req, res) => {
            const isConnRefused = (err as { code?: string }).code === 'ECONNREFUSED';
            if (isConnRefused && res && 'writeHead' in res && !(res as { headersSent?: boolean }).headersSent) {
              (res as { writeHead: (code: number, headers: Record<string, string>) => void; end: (data: string) => void }).writeHead(503, {
                'Content-Type': 'application/json',
              });
              (res as { writeHead: (code: number, headers: Record<string, string>) => void; end: (data: string) => void }).end(
                JSON.stringify({ message: 'Backend is initializing, please retry shortly.' })
              );
            }
          });
        },
      },
      '/hubs': {
        target: 'http://localhost:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', () => {
            // Gracefully silence websocket handshake errors during initial startup
          });
        },
      },
    },
  },
});
