import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'framer-motion'],
          'vendor-barcode': ['jsbarcode', 'qrcode.react'],
          'vendor-scanner': ['html5-qrcode'],
          'vendor-bwip': ['bwip-js/browser'],
        },
      },
    },
  },
});
