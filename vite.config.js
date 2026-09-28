import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cloudflare Pages: build command `npm run build`, output directory `dist`
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
});
