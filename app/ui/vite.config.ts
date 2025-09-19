import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  // following ensures that files are included into bundle
  assetsInclude: ['**/*.json', '**/*.txt'],

  // following serves as reverse proxy of /api -> Backend API when serving in DEV mode
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8001', // backend API
        changeOrigin: true,
        rewrite: path => path.replace(/^\/api/, '')
      }
    }
  }
});
