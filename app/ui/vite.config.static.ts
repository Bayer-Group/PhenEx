/**
 * Vite config for building a single-file static report HTML.
 *
 * Usage:
 *   npx vite build --config vite.config.static.ts
 *
 * Produces: dist-static/static-report.html (all JS/CSS inlined).
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist-static',
    rollupOptions: {
      input: path.resolve(__dirname, 'static-report.html'),
    },
  },
});
