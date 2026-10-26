import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@diagrammer/shared': path.resolve(__dirname, '../../packages/shared/src'),
      '@diagrammer/engine': path.resolve(__dirname, '../../packages/engine/src'),
    },
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
});
