import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': new URL('./shared', import.meta.url).pathname,
      '@': new URL('./web/src', import.meta.url).pathname,
    },
  },
  build: { outDir: '../dist/web', emptyOutDir: true },
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:9000' },
  },
});
